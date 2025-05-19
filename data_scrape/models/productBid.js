import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const ProductBid = sequelize.define(
  "ProductBid",
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
    productId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Products",
        key: "id",
      },
    },
  },
  {
    tableName: "ProductBids",
    timestamps: true,
  }
);

export default ProductBid;
