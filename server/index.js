import { connectToSQLServer } from "./database/db.js";
import pivotChartRoutes from "./routes/pivotChartRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import fieldRoutes from "./routes/fieldRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import Keycloak from "keycloak-connect";

dotenv.config();

const app = express();
const memoryStore = new session.MemoryStore();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
  })
);

const keycloak = new Keycloak({ store: memoryStore });

app.use(keycloak.middleware());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/ai", aiRoutes);

app.use("/api/fields",  fieldRoutes);

app.use("/api/bids/pivot",  pivotChartRoutes);

app.use("/api", vendorRoutes);

app.use("/api/categories", categoryRoutes);

connectToSQLServer().catch((err) => {
  console.error("Database connection failed", err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
