import express from "express";
import Bid from "../models/bidModel.js";
import { Sequelize } from "sequelize";

const router = express.Router();

// Lấy danh sách lĩnh vực
router.get("/", async (req, res) => {
  try {
    const fields = await Bid.findAll({
      attributes: [
        "fieldCategory",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]
      ],
      group: ["fieldCategory"]
    });

    const formatted = fields
      .map((item) => ({
        name: item.fieldCategory,
        value: parseInt(item.get("count")) || 0
      }))
      .filter(item => item.name);

    res.json(formatted);
  } catch (error) {
    console.error("Lỗi lấy danh sách lĩnh vực", error);
    res.status(500).json({ error: "Error" });
  }
});

// Thêm lĩnh vực mới
router.post("/", async (req, res) => {
  const { name, value } = req.body;
  try {
    const total = await Bid.sum("value") || 0;
    if (total + parseFloat(value) > 100) {
      return res.status(400).json({ error: "Tổng tỉ trọng vượt quá 100%" });
    }
    const newField = await Bid.create({ fieldCategory: name, value });
    res.status(201).json(newField);
  } catch (error) {
    console.error("Lỗi thêm lĩnh vực:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Xoá lĩnh vực
router.delete("/:name", async (req, res) => {
  try {
    const fieldName = req.params.name;
    const deleted = await Bid.destroy({ where: { fieldCategory: fieldName } });
    if (deleted === 0)
      return res.status(404).json({ error: "Không tìm thấy lĩnh vực" });
    res.json({ message: "Đã xoá lĩnh vực" });
  } catch (err) {
    console.error("Lỗi xoá lĩnh vực:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ✅ Lấy danh sách vendor theo field
router.get("/:fieldCategory/vendors", async (req, res) => {
  try {
    const { fieldCategory } = req.params;
    const vendors = await Bid.findAll({
      where: { fieldCategory },
      attributes: ["vendorName"],
      group: ["vendorName"]
    });

    const uniqueVendors = vendors
      .map((v) => v.vendorName)
      .filter((v) => v !== null);

    res.json(uniqueVendors);
  } catch (error) {
    console.error("Lỗi khi lấy vendor theo lĩnh vực:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
