import express from "express";
import Bid from "../models/bidModel.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const bidStats = await Bid.findAll({
      attributes: [
        "fieldCategory",
        [Bid.sequelize.fn("SUM", Bid.sequelize.col("bidPrice")), "totalPrice"],
      ],
      group: ["fieldCategory"],
    });

    const investorStats = await Bid.findAll({
      attributes: [
        "investorName",
        [Bid.sequelize.fn("SUM", Bid.sequelize.col("bidPrice")), "totalPrice"],
      ],
      group: ["investorName"],
      order: [[Bid.sequelize.fn("SUM", Bid.sequelize.col("bidPrice")), "DESC"]],
      limit: 10,
    });

    const vendors = await Bid.findAll({
      attributes: ["vendors"],
    });

    const vendorCounts = {};
    const vendorPrices = {};

    vendors.forEach((record) => {
      let vendorsData = record.vendors;

      if (vendorsData && typeof vendorsData === "string") {
        try {
          vendorsData = JSON.parse(vendorsData);
        } catch (error) {
          vendorsData = {};
        }
      }

      if (
        vendorsData &&
        typeof vendorsData === "object" &&
        Object.keys(vendorsData).length > 0
      ) {
        Object.keys(vendorsData).forEach((vendor) => {
          vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
          vendorPrices[vendor] =
            (vendorPrices[vendor] || 0) + (vendorsData[vendor] || 1);
        });
      }
    });

    const bidsWithVendors = await Bid.findAll({
      attributes: ["vendors", "bidPrice"],
    });

    const vendorTotalPrices = {};
    bidsWithVendors.forEach((bid) => {
      let vendorsData = bid.vendors;
      if (typeof vendorsData === "string") {
        try {
          vendorsData = JSON.parse(vendorsData);
        } catch (error) {
          vendorsData = {};
        }
      }

      if (vendorsData && typeof vendorsData === "object") {
        Object.keys(vendorsData).forEach((vendor) => {
          vendorTotalPrices[vendor] =
            (vendorTotalPrices[vendor] || 0) + bid.bidPrice;
        });
      }
    });

    const vendorStats = Object.entries(vendorCounts)
      .map(([name, count]) => ({
        vendorName: name,
        count,
        totalPrice: vendorTotalPrices[name] || 0,
      }))
      .sort((a, b) => b.totalPrice - a.totalPrice);

    res.json({
      bidStats,
      investorStats,
      vendorStats,
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
});

export default router;
