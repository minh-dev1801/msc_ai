import { Sequelize } from "sequelize";
import dotenv from "dotenv/config";

if (
  !process.env.DB_HOST ||
  !process.env.DB_NAME ||
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD
) {
  throw new Error("Thiếu biến môi trường cơ sở dữ liệu!");
}

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
    await sequelize.sync({ force: false });
  } catch (error) {
    console.error("Lỗi kết nối hoặc đồng bộ:", error);
  }
};

export { sequelize, Sequelize };
