import express from "express";
import Bid from "../models/bidModel.js";
import { json, Sequelize } from "sequelize";

const router = express.Router();

// // Lấy danh sách vendors
// router.get("/", async (req, res) => {
//   try {
//     const bids = await Bid.findAll({ attributes: ["vendors"] });

//     const vendorCount = {};
//     let totalVendorOccurrences = 0;

//     bids.forEach(bid => {
//       let vendorObj = {};

//       try {
//         if (typeof bid.vendors === "string" && bid.vendors.trim()) {
//           vendorObj = JSON.parse(bid.vendors);
//         }
//       } catch (e) {
//         console.warn("Lỗi parse JSON:", bid.vendors);
//         return;
//       }

//       for (const vendor in vendorObj) {
//         const name = vendor.trim().toLowerCase(); // chuẩn hóa
//         vendorCount[name] = (vendorCount[name] || 0) + 1;
//         totalVendorOccurrences += 1; // mỗi lần 1 vendor xuất hiện
//       }
//     });

//     const formatted = Object.entries(vendorCount)
//       .map(([name, count]) => ({
//         name,
//         value: count,
//         percent: ((count / totalVendorOccurrences) * 100).toFixed(2) + "%"
//       }))
//       .sort((a, b) => b.value - a.value); // sắp xếp giảm dần

//     res.json({
//       totalVendors: totalVendorOccurrences,
//       data: formatted
//     });
//   } catch (error) {
//     console.error("Lỗi thống kê vendor", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

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
