import { DataTypes } from "sequelize";
import sequelize from "../database/db.js";

const Bid = sequelize.define(
  "Bid",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bidName: { type: DataTypes.STRING },
    bidCloseDate: { type: DataTypes.DATE },
    year: { type: DataTypes.INTEGER },
    isClosed: { type: DataTypes.BOOLEAN },
    hasWinner: { type: DataTypes.BOOLEAN },
    investorName: { type: DataTypes.STRING },
    bidPrice: { type: DataTypes.FLOAT },
    fieldGroup: { type: DataTypes.STRING, allowNull: true },
    fieldCategory: { type: DataTypes.STRING },
    vendors: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "Bids",
    timestamps: true,
  }
);

export default Bid;
