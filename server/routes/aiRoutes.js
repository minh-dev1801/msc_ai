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
  try {
    const whereClause = {};
    if (year) {
      whereClause[Sequelize.Op.and] = [
        Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('createdAt')), year)
      ];
    }

    if (vendors.length > 0) {
      whereClause.vendor = { [Sequelize.Op.in]: vendors.map((v) => v => trim()) };
    }

    const vendorData = await Product.findAll({
      attributes: ["vendor", "unitPrice", "totalAmount"],
      where: {
        vendor: {
          [Sequelize.Op.ne]: null,
          [Sequelize.Op.ne]: ''
        },
        ...whereClause,
      },
      order: [["totalAmount", "DESC"]],
    });
    let processData = vendorData.map((v) => ({
      name: v.vendor,
      unitPrice: parseFloat(v.unitPrice) || 0,
      totalAmount: parseFloat(v.totalAmount) || 0,
    }));
    if (compareType == "unitPrice") {
      processData = processData.map((item) => ({
        name: item.name,
        unitPrice: item.unitPrice,
        totalAmount: null,
      }));
    } else if (compareType === "totalAmount") {
      processData = processData.map((item) => ({
        name: item.name,
        unitPrice: null,
        totalAmount: item.totalAmount,
      }));
    }
    return processData;
  } catch (error) {
    console.error("Error getVendorPriceData", error);
    throw error;
  }
}

// Hàm lấy dữ liệu thống kê lĩnh vực
async function getFieldCategoryData({ year, vendor, top }) {
  try {
    const whereClause = {};
    if (year) {
      whereClause[Sequelize.Op.and] = [
        Sequelize.where(Sequelize.fn('Year', Sequelize.col('createAt')), year)
      ];
    }

    const products = await Product.findAll({
      attributes: ["vendor"],
      where: {
        vendor: {
          [Sequelize.Op.ne]: null,
          [Sequelize.Op.ne]: '',
        },
        ...whereClause,
      },
    });

    const vendorCount = {};
    let totalVendorOccurrences = 0;

    products.forEach((product) => {
      const vendorName = product.vendor;
      if (vendorName && vendorName.trim()) {
        const normalized = vendorName.trim();

        if (vendor && !normalized.toLowerCase().includes(vendor.trim().toLowerCase)) {
          return;
        }
        vendorCount[normalized] = (vendorCount[normalized] || 0) + 1;
        totalVendorOccurrences += 1;
      }
    });
    let result = Object.entries(vendorCount).map(([name, count]) => ({
      name,
      value: count,
    }))
      .sort((a, b) => b.value - a.value);
    if (top) {
      result = result.slice(0, top);
    }
    return result;
  } catch (error) {
    console.error("Error in getFieldCategoryData", error);
    throw error;
  }
}


//
async function getVendorStatisticsData({ year, top }) {
  try {
    const whereClause = {};
    if (year) {
      whereClause[Sequelize.Op.and] = [
        Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('createdAt')), year)
      ];
    }

    // FIXED: Lấy trực tiếp từ Product model
    const products = await Product.findAll({
      attributes: ["vendor"],
      where: {
        vendor: {
          [Sequelize.Op.ne]: null,
          [Sequelize.Op.ne]: ''
        },
        ...whereClause,
      },
    });

    const vendorCount = {};
    let totalVendorOccurrences = 0;

    products.forEach(product => {
      const vendorName = product.vendor;
      if (vendorName && vendorName.trim()) {
        const normalized = vendorName.trim();
        vendorCount[normalized] = (vendorCount[normalized] || 0) + 1;
        totalVendorOccurrences += 1;
      }
    });

    let result = Object.entries(vendorCount).map(([name, frequency]) => ({
      name,
      frequency,
      percentage: totalVendorOccurrences > 0 ?
        ((frequency / totalVendorOccurrences) * 100).toFixed(2) : "0.00"
    })).sort((a, b) => b.frequency - a.frequency);

    if (top) {
      result = result.slice(0, top);
    }

    return result;
  } catch (error) {
    console.error("Error in getVendorStatisticsData:", error);
    throw error;
  }
}

async function getVendorStatisticsWithGroupBy({ year, top }) {
  try {
    const whereClause = {};
    if (year) {
      whereClause[Sequelize.Op.and] = [
        Sequelize.where(Sequelize.fn("Year", Sequelize.col("createAt")), year),
      ];
    }

    const vendorStats = await Product.findAll({
      attributes: [
        "vendor",
        [Sequelize.fn("Count", Sequelize.col("id")), "frequency"],
      ],
      where: {
        vendor: {
          [Sequelize.Op.ne]: null,
          [Sequelize.Op.ne]: "",
        },
        whereClause,
      },
      group: ["vendor"],
      order: [[Sequelize.fn("Count", Sequelize.col("id")), "DESC"]],
      raw: true,
    });

    /*
      SELECT vendor, COUNT(id) AS frequency
      FROM Products
      WHERE vendor IS NOT NULL
      AND vendor != ''
      AND categoryId = '123'
      AND YEAR(createAt) = 2023
      AND name IN('VendorA', 'VendorB')
      GROUP BY vendor
      ORDER BY COUNT(id) DESC;
    */

    //Tính tổng để có percentage
    const totalOccurrences = vendorStats.reduce(
      (sum, item) => sum + parseInt(item.frequency),
      0
    );

    let result = vendorStats.map((item) => ({
      name: item.vendor,
      frequency: parseFloat(item.frequency),
      percentage: totalOccurrences
        ? ((parseFloat(item.frequency) / totalOccurrences) * 100).toFixed
        : "0.00",
    }));

    if (top) {
      result = result.slice(0.1);
    }
    return result;
  } catch (error) {
    console.error("Erorr in getVendorStatisticsDataWithGroupBy ");
    return await getVendorStatisticsData({ year, top });
  }
}

// ===== AI MODEL SETUP =====
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.3
});

// Cấu hình tools cho AI
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
            description: "Danh sách vendor cần so sánh"
          },
          year: {
            type: "integer",
            description: "Lọc dữ liệu theo năm"
          },
          compareType: {
            type: "string",
            enum: ["all", "unitPrice", "totalAmount"],
            description: "Loại so sánh: 'all', 'unitPrice', 'totalAmount'"
          }
        },
        required: ["vendors"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "selectVendorStatistics",
      description: "Thống kê số lần xuất hiện của vendor trong các sản phẩm",
      parameters: {
        type: "object",
        properties: {
          year: {
            type: "integer",
            description: "Lọc thống kê theo năm",
          },
          top: {
            type: "integer",
            description: "Lấy top N vendor có tần suất cao nhất"
          }
        },
        required: []
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
        1. Nếu prompt chứa từ khóa "thống kê vendor", "vendor xuất hiện", "tần suất vendor", 
           "số lần vendor", "vendor nào nhiều nhất", hãy sử dụng selectVendorStatistics.
        2. Nếu người dùng muốn so sánh giữa các vendor cụ thể, hãy sử dụng selectPriceComparisonData.
        3. Nếu prompt có cụm từ như "đơn giá", "chỉ so sánh đơn giá", hãy đặt compareType="unitPrice".
        4. Nếu prompt có cụm từ như "tổng giá", "tổng tiền", "giá trị tổng", hãy đặt compareType="totalAmount".
        5. Với các yêu cầu khác, sử dụng selectChartData để hiển thị dữ liệu thông thường.
        
        Luôn xác định đúng các vendor được đề cập trong prompt.`
      ]
    ]);

    let chartType = "bar";
    const chartDataParams = {};
    const priceComparisonParams = { compareType: "all" };
    let vendorStatsParams = {};

    // FIXED: Xử lý tool calls đúng cách
    if (response.tool_calls?.length > 0) {
      for (const toolCall of response.tool_calls) {
        const args = toolCall.args;
        if (toolCall.name === "selectChartType") {
          chartType = selectChartType(args);
        } else if (toolCall.name === "selectChartData") {
          Object.assign(chartDataParams, args);
        } else if (toolCall.name === "selectPriceComparisonData") {
          Object.assign(priceComparisonParams, args);
        } else if (toolCall.name === "selectVendorStatistics") {
          Object.assign(vendorStatsParams, args);
        }
      }
    }

    // FIXED: Kiểm tra vendor statistics request
    if (Object.keys(vendorStatsParams).length > 0 ||
      (prompt.toLowerCase().includes("thống kê") &&
        (prompt.toLowerCase().includes("vendor") ||
          prompt.toLowerCase().includes("xuất hiện") ||
          prompt.toLowerCase().includes("tần suất") ||
          prompt.toLowerCase().includes("nhiều nhất")))) {

      // Extract parameters from prompt if not set by AI
      if (Object.keys(vendorStatsParams).length === 0) {
        const yearMatch = prompt.match(/(\d{4})/);
        const topMatch = prompt.match(/top\s*(\d+)/i);

        if (yearMatch) vendorStatsParams.year = parseInt(yearMatch[1]);
        if (topMatch) vendorStatsParams.top = parseInt(topMatch[1]);
      }

      try {
        // Try GROUP BY first, fallback to manual counting
        const vendorStatsData = await getVendorStatisticsWithGroupBy(vendorStatsParams);

        return res.status(200).json({
          chartType: "pie",
          data: vendorStatsData.map(item => ({
            name: item.name,
            value: item.frequency,
            percentage: parseFloat(item.percentage)
          })),
          comparisonType: "vendor_statistics",
          metadata: {
            description: prompt,
            filteredBy: {
              year: vendorStatsParams.year || null,
              top: vendorStatsParams.top || null
            }
          }
        });
      } catch (error) {
        console.error("Error in vendor statistics:", error);
        return res.status(500).json({ error: "Lỗi khi tạo thống kê vendor" });
      }
    }

    // Price comparison
    if (Object.keys(priceComparisonParams).length > 0 && priceComparisonParams.vendors?.length > 0) {
      const priceData = await getVendorPriceData(priceComparisonParams);

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
    }

    // Default field category data
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

  } catch (err) {
    console.error("[LangChain Error]", err);
    res.status(500).json({ error: "Lỗi AI xử lý prompt" });
  }
});

// FIXED: API endpoint để lấy danh sách vendor
router.get("/vendors", async (req, res) => {
  try {
    const vendors = await Product.findAll({
      attributes: ['vendor'],
      where: {
        vendor: {
          [Sequelize.Op.ne]: null,
          [Sequelize.Op.ne]: ''
        }
      },
      group: ['vendor'],
      raw: true
    });

    res.json(vendors.map(v => v.vendor).filter(v => v && v.trim()));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách vendors:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// API endpoint để so sánh trực tiếp
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

// FIXED: API endpoint để lấy thống kê vendor
router.get("/vendor-statistics", async (req, res) => {
  try {
    const { year, top } = req.query;

    const vendorStats = await getVendorStatisticsWithGroupBy({
      year: year ? parseInt(year) : null,
      top: top ? parseInt(top) : null
    });

    res.json(vendorStats);
  } catch (error) {
    console.error("Lỗi khi lấy thống kê vendor:", error);
    res.status(500).json({ error: "Lỗi server khi lấy thống kê vendor" });
  }
});

// API endpoint để phân tích prompt thống kê vendor
router.post("/interpret-vendor-stats", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt không hợp lệ" });
  }

  try {
    const promptLower = prompt.toLowerCase();

    // Trích xuất năm
    const yearMatch = prompt.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    // Trích xuất số lượng top
    let top = null;
    const topMatch = prompt.match(/top\s*(\d+)/i);
    if (topMatch) {
      top = parseInt(topMatch[1]);
    } else if (promptLower.includes("tất cả")) {
      top = null;
    } else {
      top = 10; // Mặc định top 10
    }

    res.json({
      year,
      top,
      analysis: {
        extractedYear: year,
        extractedTop: top,
        originalPrompt: prompt
      }
    });
  } catch (error) {
    console.error("Lỗi phân tích vendor stats prompt:", error);
    res.status(500).json({ error: "Lỗi phân tích prompt" });
  }
});
export default router;
