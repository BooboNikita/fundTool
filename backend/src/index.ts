import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import fundRoutes from "./routes/fundRoutes";
import dingtalkRoutes from "./routes/dingtalkRoutes";
import aiRoutes from "./routes/aiRoutes";
import adminRoutes from "./routes/adminRoutes";
import menuRoutes from "./routes/menuRoutes";
import { initDatabase } from "./models/database";
import { startScheduler } from "./controllers/dingtalkController";

const app = express();
const PORT = process.env.PORT || 3035;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/funds", fundRoutes);
app.use("/api/dingtalk", dingtalkRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/menu", menuRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  try {
    await initDatabase();
    startScheduler();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
