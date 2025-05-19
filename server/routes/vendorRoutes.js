import express from "express";
import Product from "../../data_scrape/models/product.js";
import { Sequelize } from "../database/db.js";

const router = express.Router();

// Lấy danh sách các sản phẩm kèm lọc theo categoryId nếu có
router.get("/vendor/summary", async (req, res) => {
  const { productCategoryId, vendors, year } = req.query;

  try {
    const whereClause = {};
    
    // Thêm điều kiện lọc theo productCategoryId
    if (productCategoryId) {
      whereClause.productCategoryId = productCategoryId;
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
      attributes: ["name", "unitPrice", "totalAmount"],
      where: whereClause,
      order: [["totalAmount", "DESC"]]
    });

    res.json(products);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách vendors:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Lấy thông tin chi tiết về một vendor
router.get("/vendor/:name", async (req, res) => {
  const { name } = req.params;
  
  try {
    const vendorData = await Product.findAll({
      where: { name },
      attributes: ["name", "unitPrice", "totalAmount", "year", "productCategoryId"],
      order: [["year", "DESC"]]
    });
    
    if (!vendorData.length) {
      return res.status(404).json({ error: "Không tìm thấy thông tin vendor" });
    }
    
    res.json(vendorData);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin vendor:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Lấy top vendors theo tổng giá trị
router.get("/top-vendors", async (req, res) => {
  const { limit = 10, year } = req.query;
  
  try {
    const whereClause = {};
    if (year) whereClause.year = year;
    
    const topVendors = await Product.findAll({
      attributes: ["name", "totalAmount"],
      where: whereClause,
      order: [["totalAmount", "DESC"]],
      limit: parseInt(limit)
    });
    
    res.json(topVendors);
  } catch (error) {
    console.error("Lỗi khi lấy top vendors:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;