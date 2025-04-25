import express from "express";
const router = express.Router();
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const chatModel = new ChatOpenAI({
  temperature: 0,
  openAiApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o-mini",
});

router.post("/interpret", async (req, res) => {
  const { prompt } = req.body;
  try {
    const messages = [
      new SystemMessage(
        "Bạn là trợ lý AI giúp xác định loại biểu đồ phù hợp từ mô tả ngôn ngữ tự nhiên. " +
          'Trả về CHÍNH XÁC một trong các từ sau: "pie", "bar", "line", "area". Không giải thích thêm.'
      ),
      new HumanMessage(prompt),
    ];

    const response = await chatModel.call(messages);
    const reply = response.content.trim().toLowerCase();

    const allowed = ["pie", "bar", "line", "area"];
    const result = allowed.includes(reply) ? reply : "pie";

    res.json({ type: result });
  } catch (err) {
    console.error("[LangChain Error]", err);
    res.status(500).json({ error: "Lỗi AI xử lý prompt" });
  }
});

export default router;
