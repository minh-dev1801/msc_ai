import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const Contractor = sequelize.define(
  "Contractor",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "Contractors",
    timestamps: true,
    indexes: [
      {
        fields: ["name"],
      },
    ],
  }
);

export default Contractor;
