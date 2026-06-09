import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { connectDB } from "./config/database";
import courtRoutes from "./routes/courtRoutes";
import caseRoutes from "./routes/caseRoutes";
import statisticsRoutes from "./routes/statisticsRoutes";
import { CaseFlowService } from "./services/caseFlowService";
import { checkAndSeedData } from "./scripts/seedData";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "请求过于频繁，请稍后再试",
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/", limiter);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "河南沿黄巡回法庭环境资源案件集中管辖服务端运行正常",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.use("/api/courts", courtRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/statistics", statisticsRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "接口不存在",
  });
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("服务器错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

const startServer = async () => {
  try {
    await connectDB();
    await checkAndSeedData();

    app.listen(PORT, () => {
      console.log(`
      🚀 服务器启动成功
      📍 服务地址: http://localhost:${PORT}
      📡 API 前缀: http://localhost:${PORT}/api
      🏛️  服务名称: 河南沿黄巡回法庭环境资源案件集中管辖服务端
      `);
    });

    setInterval(
      async () => {
        try {
          const result = await CaseFlowService.checkAndUpdateCaseStatus();
          if (result.notifiedCases.length > 0) {
            console.log(
              `⏰ 审限预警: 已催办 ${result.urgentCount} 个即将到期案件，预警 ${result.overdueCount} 个超审限案件`,
            );
          }
        } catch (error) {
          console.error("审限预警检查失败:", error);
        }
      },
      60 * 60 * 1000,
    );
  } catch (error) {
    console.error("启动服务器失败:", error);
    process.exit(1);
  }
};

startServer();
