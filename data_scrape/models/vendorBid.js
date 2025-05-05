import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const VendorBid = sequelize.define(
  "VendorBid",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bidId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Bids",
        key: "id",
      },
    },
    vendorId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Vendors",
        key: "id",
      },
    },
  },
  {
    tableName: "VendorBids",
    timestamps: true,
  }
);

export default VendorBid;
