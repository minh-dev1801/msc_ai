import express from "express";
import Product from "../../data_scrape/models/product.js";
import { Sequelize } from "../database/db.js";

const router = express.Router();

// Lấy danh sách các sản phẩm kèm lọc theo categoryId nếu có
router.get("/vendor/summary", async (req, res) => {
  const { categoryId, vendors, year, id } = req.query;

  try {
    const whereClause = {};
    
  
    if (categoryId || id) {
      whereClause.categoryId = categoryId || id;
    }
    
    // Thêm điều kiện lọc theo year
    if (year) {
      whereClause.year = year;
    }
    
    // Thêm điều kiện lọc theo vendors 
    if (vendors) {
      const vendorList = Array.isArray(vendors) ? vendors : vendors.split(',');
      whereClause.name = { [Sequelize.Op.in]: vendorList };
    }

    const products = await Product.findAll({
      attributes: ["name","vendor", "unitPrice", "totalAmount", "categoryId"],
      where: whereClause,
      order: [["totalAmount", "DESC"]]
    });

    res.json(products);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách vendors:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});



export default router;