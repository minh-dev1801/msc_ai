import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const ProductCategory = sequelize.define(
  "ProductCategory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "ProductCategories",
    timestamps: true,
  }
);

export default ProductCategory;
