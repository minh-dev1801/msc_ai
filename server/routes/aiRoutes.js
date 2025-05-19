import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import Product from "../../data_scrape/models/product.js";
import Bid from "../models/bidModel.js";
import { Sequelize } from "../database/db.js";

dotenv.config();

const router = express.Router();


// Hàm lấy dữ liệu giá vendor - nâng cấp để hỗ trợ so sánh tốt hơn
async function getVendorPriceData({ vendors = [], year, compareType = "all" }) {
  const whereClause = {};
  if (year) whereClause.year = year;

  // Đảm bảo chỉ tìm kiếm các vendor được đề cập
  let vendorWhereClause = {};
  if (vendors.length > 0) {
    vendorWhereClause = { 
      name: { [Sequelize.Op.in]: vendors.map(v => v.trim()) } 
    };
  }

  const vendorData = await Product.findAll({
    attributes: ["name", "unitPrice", "totalAmount"],
    where: {
      ...whereClause,
      ...vendorWhereClause
    },
    order: [["totalAmount", "DESC"]]
  });

  // Xử lý dữ liệu dựa trên loại so sánh
  let processedData = vendorData.map(v => ({
    name: v.name,
    unitPrice: v.unitPrice,
    totalAmount: v.totalAmount
  }));
  
  // Lọc dữ liệu theo compareType
  if (compareType === "unitPrice") {
    processedData = processedData.map(item => ({
      name: item.name,
      unitPrice: item.unitPrice,
      totalAmount: null // Ẩn tổng giá trị
    }));
  } else if (compareType === "totalAmount") {
    processedData = processedData.map(item => ({
      name: item.name,
      unitPrice: null, // Ẩn đơn giá
      totalAmount: item.totalAmount
    }));
  }

  return processedData;
}

// Hàm lấy dữ liệu thống kê lĩnh vực
async function getFieldCategoryData({ year, vendor, top }) {
  const whereClause = {};
  if (year) whereClause.year = year;

  const bids = await Bid.findAll({
    attributes: ["vendors"],
    where: whereClause,
  });

  const vendorCount = {};
  let totalVendorOccurrences = 0;

  bids.forEach(bid => {
    let vendorObj = {};
    try {
      if (typeof bid.vendors === "string" && bid.vendors.trim()) {
        vendorObj = JSON.parse(bid.vendors);
      }
    } catch (e) {
      console.warn("Lỗi parse JSON:", bid.vendors);
      return;
    }

    for (const v in vendorObj) {
      const normalized = v.trim().toLowerCase();
      if (vendor && !normalized.includes(vendor.trim().toLowerCase())) {
        continue;
      }
      vendorCount[normalized] = (vendorCount[normalized] || 0) + 1;
      totalVendorOccurrences += 1;
    }
  });

  let result = Object.entries(vendorCount)
    .map(([name, count]) => ({
      name,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  if (top) {
    result = result.slice(0, top);
  }

  return result;
}

// ===== AI MODEL SETUP =====
const model = new ChatOpenAI({
  modelName: "gpt-4",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.3
});

// Cấu hình tools cho AI - nâng cấp để xử lý so sánh vendor tốt hơn
const tools = [
  {
    type: "function",
    function: {
      name: "selectChartType",
      description: "Chọn loại biểu đồ phù hợp dựa trên mô tả",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Mô tả biểu đồ" }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "selectChartData",
      description: "Lọc dữ liệu biểu đồ theo lĩnh vực, năm, vendor hoặc top N",
      parameters: {
        type: "object",
        properties: {
          fieldCategories: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách lĩnh vực cần lọc"
          },
          year: {
            type: "integer",
            description: "Lọc dữ liệu theo năm"
          },
          top: {
            type: "integer",
            description: "Lọc top N lĩnh vực có giá trị cao nhất"
          },
          vendor: {
            type: "string",
            description: "Lọc dữ liệu theo vendor cụ thể"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "selectPriceComparisonData",
      description: "So sánh giá tiền (đơn giá và tổng tiền) giữa các vendor",
      parameters: {
        type: "object",
        properties: {
          vendors: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách vendor cần so sánh (ví dụ: ['Vendor A', 'Vendor B'])"
          },
          year: {
            type: "integer",
            description: "Lọc dữ liệu theo năm"
          },
          compareType: {
            type: "string", 
            enum: ["all", "unitPrice", "totalAmount"],
            description: "Loại so sánh: 'all' (mặc định), 'unitPrice' (chỉ đơn giá), 'totalAmount' (chỉ tổng tiền)"
          }
        },
        required: ["vendors"]
      }
    }
  }
];

// Helper function
function selectChartType({ description }) {
  const desc = description.toLowerCase();
  if (desc.includes("pie") || desc.includes("tròn")) return "pie";
  if (desc.includes("line") || desc.includes("đường")) return "line";
  if (desc.includes("bar") || desc.includes("cột")) return "bar";
  if (desc.includes("area") || desc.includes("miền")) return "area";
  return "bar";
}

// ===== API ENDPOINTS =====
router.post("/interpret", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "Prompt không hợp lệ hoặc thiếu" });
  }

  try {
    const modelWithTools = model.bind({ tools });

    const response = await modelWithTools.invoke([
      ["human", prompt],
      [
        "system",
        `Phân tích prompt của người dùng và xác định:
        1. Nếu người dùng muốn so sánh giữa các vendor cụ thể (ví dụ: "so sánh giá giữa vendor A và B"), 
           hãy sử dụng selectPriceComparisonData và chỉ định chính xác tên vendor cần so sánh.
        2. Nếu prompt có cụm từ như "đơn giá", "chỉ so sánh đơn giá", "giá đơn vị", hãy đặt compareType="unitPrice".
        3. Nếu prompt có cụm từ như "tổng giá", "tổng tiền", "giá trị tổng", hãy đặt compareType="totalAmount".
        4. Mặc định, sử dụng compareType="all" để so sánh cả đơn giá và tổng giá trị.
        5. Với các yêu cầu khác, sử dụng selectChartType và selectChartData như bình thường.

        Luôn xác định đúng các vendor được đề cập trong prompt, không thêm vendor không được nêu.`
      ]
    ]);

    let chartType = "bar";
    const chartDataParams = {};
    const priceComparisonParams = { compareType: "all" };

    if (response.tool_calls?.length > 0) {
      for (const toolCall of response.tool_calls) {
        const args = toolCall.args;
        if (toolCall.name === "selectChartType") {
          chartType = selectChartType(args);
        } else if (toolCall.name === "selectChartData") {
          Object.assign(chartDataParams, args);
        } else if (toolCall.name === "selectPriceComparisonData") {
          Object.assign(priceComparisonParams, args);
        }
      }
    }

    if (Object.keys(priceComparisonParams).length > 0 && priceComparisonParams.vendors?.length > 0) {
      const priceData = await getVendorPriceData(priceComparisonParams);
      
      // Trả về dữ liệu biểu đồ so sánh giá
      return res.status(200).json({
        chartType: "bar",
        data: priceData,
        comparisonType: "price",
        metadata: {
          description: prompt,
          filteredBy: {
            vendors: priceComparisonParams.vendors || [],
            year: priceComparisonParams.year || null,
            compareType: priceComparisonParams.compareType || "all"
          }
        }
      });
    } else {
      // Trả về dữ liệu biểu đồ thống kê lĩnh vực
      const fieldCategoryData = await getFieldCategoryData(chartDataParams);
      return res.status(200).json({
        chartType,
        data: fieldCategoryData,
        metadata: {
          description: prompt,
          filteredBy: {
            year: chartDataParams.year || null,
            top: chartDataParams.top || null,
            vendor: chartDataParams.vendor || null,
            fieldCategories: chartDataParams.fieldCategories || []
          }
        }
      });
    }
  } catch (err) {
    console.error("[LangChain Error]", err);
    res.status(500).json({ error: "Lỗi AI xử lý prompt" });
  }
});

// API endpoint để lấy danh sách vendor
router.get("/vendors", async (req, res) => {
  try {
    const vendors = await Product.findAll({
      attributes: [
        [Sequelize.fn('DISTINCT', Sequelize.col('name')), 'name']
      ],
      raw: true
    });
    
    res.json(vendors.map(v => v.name));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách vendors:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// API endpoint để so sánh trực tiếp (không qua AI)
router.post("/direct-compare", async (req, res) => {
  const { vendors, compareType = "all", year } = req.body;
  
  if (!vendors || !Array.isArray(vendors) || vendors.length < 2) {
    return res.status(400).json({ error: "Cần cung cấp ít nhất 2 vendor để so sánh" });
  }
  
  try {
    const data = await getVendorPriceData({ vendors, year, compareType });
    
    res.status(200).json({
      chartType: "bar",
      data,
      comparisonType: "price",
      metadata: {
        description: `So sánh ${compareType === "unitPrice" ? "đơn giá" : 
                      compareType === "totalAmount" ? "tổng giá trị" : 
                      "giá"} giữa ${vendors.join(", ")}`,
        filteredBy: {
          vendors,
          year: year || null,
          compareType
        }
      }
    });
  } catch (error) {
    console.error("Lỗi khi so sánh trực tiếp:", error);
    res.status(500).json({ error: "Lỗi khi so sánh vendor" });
  }
});

export default router;
