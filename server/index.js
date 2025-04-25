import { connectToSQLServer } from "./database/db.js";
import pivotChartRoutes from "./routes/pivotChartRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import fieldRoutes from "./routes/fieldRoutes.js";
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

app.get("/api/public", (req, res) => {
  res.send("Public route");
});

app.get("/api/protected", keycloak.protect(), (req, res) => {
  const userInfo = req.kauth.grant.access_token.content;

  res.send({
    message: "This is a protected endpoint",
    user: {
      username: userInfo.preferred_username,
      email: userInfo.email,
      roles: userInfo.realm_access?.roles || [],
    },
  });
});

app.post("/api/ai", keycloak.protect(), aiRoutes);

app.use("/api/fields", keycloak.protect(), fieldRoutes);

app.use("/api/bids/pivot", keycloak.protect(), pivotChartRoutes);

connectToSQLServer().catch((err) => {
  console.error("Database connection failed", err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
