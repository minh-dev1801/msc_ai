import { Sequelize } from "sequelize";
import dotenv from "dotenv/config";

// Khởi tạo kết nối Sequelize
const sequelize = new Sequelize({
  dialect: "mssql", // Loại cơ sở dữ liệu
  host: process.env.DB_HOST, // Địa chỉ server
  database: process.env.DB_NAME, // Tên cơ sở dữ liệu
  username: process.env.DB_USER, // Tên người dùng
  password: process.env.DB_PASSWORD, // Mật khẩu
  dialectOptions: {
    options: {
      encrypt: false, // Tắt mã hóa nếu không dùng Azure
      trustServerCertificate: true, // Bỏ qua chứng chỉ nếu dùng local
    },
  },
});

// Kiểm tra kết nối
export const connectToSQLServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: false });
  } catch (error) {
    console.error("Lỗi kết nối hoặc đồng bộ:", error);
  }
};

// Xuất sequelize để sử dụng trong model
export default sequelize;
