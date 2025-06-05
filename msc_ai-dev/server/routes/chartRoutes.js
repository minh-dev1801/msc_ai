import express from "express";
import db from "../database/db.js";

const router = express.Router();

router.post("/charts", async (req, res) => {
  const { prompt, type } = req.body;
  try {
    await db.query(
      "INSERT INTO SavedCharts (prompt, type, createdAt) VALUES (:prompt, :type, GETDATE())",
      {
        replacements: { prompt, type },
        type: db.QueryTypes.INSERT,
      }
    );
    res.status(201).json({ message: "Biểu đồ đã lưu" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lưu khi lỗi biểu đồ" });
  }
});

router.get("/charts", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM SavedCharts ORDER BY createdAt DESC"
    );
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.json(500).json({ error: "Lỗi khi lấy danh sách biểu đồ" });
  }
});

export default router;
