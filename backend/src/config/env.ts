import dotenv from "dotenv";
dotenv.config();

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/safecity",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",
  aiProvider: (process.env.AI_PROVIDER || "demo") as "demo" | "real",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  incidentGroupingWindowSeconds: num(process.env.INCIDENT_GROUPING_WINDOW_SECONDS, 30),
  confidenceIgnoreBelow: num(process.env.CONFIDENCE_IGNORE_BELOW, 60),
  confidenceHighAbove: num(process.env.CONFIDENCE_HIGH_ABOVE, 80),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@safecity.ai",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "admin123",
  seedOperatorEmail: process.env.SEED_OPERATOR_EMAIL || "operator@safecity.ai",
  seedOperatorPassword: process.env.SEED_OPERATOR_PASSWORD || "operator123",
};
