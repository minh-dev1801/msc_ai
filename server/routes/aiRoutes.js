import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import Bid from "../models/bidModel.js";
import { Sequelize } from "../database/db.js";

dotenv.config();

const router = express.Router();

async function getFieldCategoryData() {
  const fields = await Bid.findAll({
    attributes: [
      "fieldCategory",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    group: ["fieldCategory"],
  });

  return fields
    .map((item) => ({
      name: item.fieldCategory,
      value: parseInt(item.get("count")) || 0,
    }))
    .filter((item) => item.name);
}

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.3,
});

const tools = [
  {
    type: "function",
    function: {
      name: "selectChartType",
      description: "Chọn loại biểu đồ phù hợp dựa trên mô tả dữ liệu",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Mô tả dữ liệu" },
        },
        required: ["description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "selectChartData",
      description:
        "Chọn các lĩnh vực và giá trị tương ứng dựa trên danh sách tên lĩnh vực được nêu rõ trong prompt. Chỉ sử dụng các lĩnh vực được đề cập chính xác như 'an ninh mạng', 'mạng máy tính', v.v.",
      parameters: {
        type: "object",
        properties: {
          fieldCategories: {
            type: "array",
            items: { type: "string" },
            description:
              "Danh sách các tên lĩnh vực được nêu rõ trong prompt, ví dụ: ['an ninh mạng', 'mạng máy tính']",
          },
        },
        required: ["fieldCategories"],
      },
    },
  },
];

function selectChartType({ description }) {
  if (description.includes("pie") || description.includes("tròn")) {
    return "pie";
  } else if (description.includes("line") || description.includes("hàng")) {
    return "line";
  } else if (description.includes("bar") || description.includes("cột")) {
    return "bar";
  } else {
    return "area";
  }
}

function selectChartData({ fieldCategories }, fieldCategoryData) {
  console.log("fieldCategoryData: ", fieldCategoryData);
  console.log("fieldCategories: ", fieldCategories);

  if (!Array.isArray(fieldCategories) || fieldCategories.length === 0) {
    return [{ name: "an ninh mạng", value: 0 }];
  }

  const result = fieldCategories
    .map((category) => {
      const item = fieldCategoryData.find(
        (data) => data.name.toLowerCase() === category.toLowerCase()
      );
      return item ? { name: item.name, value: item.value } : null;
    })
    .filter(Boolean);

  return result.length > 0 ? result : [{ name: "an ninh mạng", value: 0 }];
}

router.post("/interpret", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "Prompt không hợp lệ hoặc thiếu" });
  }

  try {
    const fieldCategoryData = await getFieldCategoryData();

    const modelWithTools = model.bind({ tools });

    const response = await modelWithTools.invoke([
      ["human", prompt],
      [
        "system",
        `Sử dụng công cụ selectChartType để chọn loại biểu đồ dựa trên mô tả về loại biểu đồ (như 'tròn', 'cột', 'hàng'). Sử dụng công cụ selectChartData để chọn danh sách các lĩnh vực được nêu rõ trong prompt (ví dụ: 'an ninh mạng', 'mạng máy tính'). Chỉ truyền các lĩnh vực được đề cập chính xác trong prompt vào fieldCategories, không suy ra hoặc thêm các lĩnh vực khác như 'Mạng LAN', 'Mạng WAN', v.v.`,
      ],
    ]);

    if (response.tool_calls && response.tool_calls.length > 0) {
      const results = {};

      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "selectChartType") {
          const args = toolCall.args;
          results.chartType = selectChartType(args);
        } else if (toolCall.name === "selectChartData") {
          const args = toolCall.args;
          console.log("selectChartData args: ", args);
          results.fieldCategories = selectChartData(args, fieldCategoryData);
        } else {
          return res.status(400).json({ error: "Công cụ không được hỗ trợ" });
        }
      }

      console.log("results: ", results);
      res.status(200).json(results);
    } else {
      res.status(200).json({
        chartType: "pie",
        fieldCategories: [{ name: "an ninh mạng", value: 0 }],
      });
    }
  } catch (err) {
    console.error("[LangChain Error]", err);
    res.status(500).json({ error: "Lỗi AI xử lý prompt" });
  }
});

export default router;
