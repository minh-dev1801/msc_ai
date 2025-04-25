import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

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
];

function selectChartType({ description }) {
  if (description.includes("tròn") || description.includes("pie")) {
    return "pie";
  } else if (description.includes("line") || description.includes("hàng")) {
    return "line";
  } else if (description.includes("bar") || description.includes("cột")) {
    return "bar";
  } else {
    return "area";
  }
}

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
        "Sử dụng công cụ selectChartType để chọn loại biểu đồ phù hợp.",
      ],
    ]);

    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      if (toolCall.name === "selectChartType") {
        const args = toolCall.args;
        const result = selectChartType(args);
        res.json({ type: result });
      } else {
        res.status(400).json({ error: "Công cụ không được hỗ trợ" });
      }
    } else {
      res.json({ type: "pie" });
    }
  } catch (err) {
    console.error("[LangChain Error]", err);
    res.status(500).json({ error: "Lỗi AI xử lý prompt" });
  }
});

export default router;
