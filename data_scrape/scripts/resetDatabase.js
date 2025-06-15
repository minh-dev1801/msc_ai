const { sequelize, Category, Product } = require("../models");
const categories = require("../constants/categories");

const tables = [
  {
    name: "Reviews",
    model: null,
    initData: [],
  },
  {
    name: "Orders",
    model: null,
    initData: [],
  },
  {
    name: "Products",
    model: Product,
    initData: [
      { name: "Router TP-Link AX3000", price: 89.99, categoryId: 1 },
      { name: "Switch Cisco 24-port", price: 199.99, categoryId: 2 },
    ],
  },
  {
    name: "Users",
    model: null,
    initData: [
      { username: "admin", email: "admin@example.com" },
      { username: "user1", email: "user1@example.com" },
    ],
  },
  {
    name: "Categories",
    model: Category,
    initData: categories,
  },
];

async function resetDatabase() {
  let t;
  try {
    t = await sequelize.transaction();

    for (const table of tables) {
      if (table.model) {
        await table.model.destroy({
          where: {},
          truncate: true,
          transaction: t,
        });
        console.log(`Truncated table ${table.name}`);
      } else {
        await sequelize.query(`TRUNCATE TABLE ${table.name}`, {
          transaction: t,
        });
        console.log(`Truncated table ${table.name}`);
      }
    }

    await t.commit();
    console.log("All tables truncated successfully");

    await sequelize.sync({ force: true });
    console.log("Database schema recreated successfully");

    t = await sequelize.transaction();
    for (const table of tables) {
      if (table.model && table.initData.length > 0) {
        await table.model.bulkCreate(table.initData, { transaction: t });
        console.log(`Initialized data for ${table.name}`);
      }
    }
    await t.commit();
    console.log("All tables initialized successfully");
  } catch (error) {
    if (t) await t.rollback();
    console.error("Error resetting database:", error.message);
    throw error;
  }
}

resetDatabase();
