import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const ContractorBid = sequelize.define(
  "ContractorBid",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    contractorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Contractors",
        key: "id",
      },
    },
    bidId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Bids",
        key: "id",
      },
    },
    status: {
      // type: DataTypes.ENUM("participated", "won", "rejected", "pending"),
      type: DataTypes.STRING,
      allowNull: false,
      // defaultValue: "participated",
    },
  },
  {
    tableName: "ContractorBids",
    timestamps: true,
  }
);

export default ContractorBid;
