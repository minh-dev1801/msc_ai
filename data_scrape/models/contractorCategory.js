import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const ContractorCategory = sequelize.define(
  "ContractorCategory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    contractorId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Contractors",
        key: "id",
      },
    },
    categoryId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Categories",
        key: "id",
      },
    },
  },
  {
    tableName: "ContractorCategories",
    timestamps: true,
  }
);

export default ContractorCategory;
