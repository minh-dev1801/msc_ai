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
    categoryId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Categories",
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
    tableName: "ProductCategories",
    timestamps: true,
  }
);

export default ProductCategory;
