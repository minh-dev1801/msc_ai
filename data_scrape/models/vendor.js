import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const Vendor = sequelize.define(
  "Vendor",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
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
    tableName: "Vendors",
    timestamps: true,
  }
);

export default Vendor;
