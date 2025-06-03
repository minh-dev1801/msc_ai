import { Sequelize } from "sequelize";
import dotenv from "dotenv/config";

const sequelize = new Sequelize({
  dialect: "mssql",
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
});

export const connectToSQLServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true, logging: false });
  } catch (error) {
    console.error("Error syncing database:", error);
  }
};

export default sequelize;
