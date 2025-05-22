import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    feature: {
      type: DataTypes.TEXT,
    },
    quantity: {
      type: DataTypes.INTEGER,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(15, 2),
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 2),
    },
  },
  {
    tableName: "Products",
    timestamps: true,
  }
);

export default Product;
