import { connectToSQLServer } from "../database/db.js";
import sequelize from "../database/db.js";

const dropTables = async () => {
  await connectToSQLServer();
  try {
    await sequelize.query("DROP TABLE IF EXISTS [MSC].[dbo].[ProductBids]");
    await sequelize.query("DROP TABLE IF EXISTS [MSC].[dbo].[ContractorBids]");
    await sequelize.query("DROP TABLE IF EXISTS [MSC].[dbo].[Bids]");
    await sequelize.query("DROP TABLE IF EXISTS [MSC].[dbo].[Products]");
    await sequelize.query("DROP TABLE IF EXISTS [MSC].[dbo].[Categories]");
    await sequelize.query("DROP TABLE IF EXISTS [MSC].[dbo].[Contractors]");

    console.log("Tables dropped successfully");
  } catch (error) {
    console.error("Error dropping tables:", error);
  } finally {
    await sequelize.close();
  }
};

dropTables();
