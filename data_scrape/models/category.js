import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const Category = sequelize.define(
  "Category",
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
    tableName: "Categories",
    timestamps: true,
  }
);

export default Category;
