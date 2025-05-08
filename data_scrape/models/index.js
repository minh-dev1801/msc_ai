import sequelize from "../database/db.js";
import Vendor from "./vendor.js";
import Bid from "./bidModel.js";
import VendorBid from "./vendorBid.js";
import { Op } from "sequelize";

Bid.belongsToMany(Vendor, {
  through: VendorBid,
  foreignKey: "bidId",
  otherKey: "vendorId",
});

Vendor.belongsToMany(Bid, {
  through: VendorBid,
  foreignKey: "vendorId",
  otherKey: "bidId",
});

export { sequelize, Vendor, Bid, VendorBid, Op };
