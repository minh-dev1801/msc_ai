import { NETWORK_CATEGORIES } from "../constants/constants.js";
import { Category, sequelize } from "../models/index.js";
import { connectToSQLServer } from "../database/db.js";

async function initializeCategories() {
  await connectToSQLServer();
  try {
    const existingCategories = await Category.findAll();
    if (existingCategories.length > 0) {
      console.log("Categories already initialized");
      return;
    }

    await Category.bulkCreate(NETWORK_CATEGORIES);
    console.log("All categories initialized successfully");
  } catch (error) {
    console.error("Error initializing categories:", error);
  } finally {
    await sequelize.close();
  }
}

initializeCategories();
