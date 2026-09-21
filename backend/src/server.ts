import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { initSocket } from "./sockets/io";

import authRoutes from "./routes/auth";
import cameraRoutes from "./routes/cameras";
import incidentRoutes from "./routes/incidents";
import responseRoutes from "./routes/responses";
import analyticsRoutes from "./routes/analytics";
import publicRoutes from "./routes/public";
import reportRoutes from "./routes/reports";
import { Camera } from "./models";
import { getIO } from "./sockets/io";
import { SOCKET_EVENTS } from "./types";

async function main() {
  await connectDB();

  const app = express();
  app.use(cors({ origin: env.corsOrigin === "*" ? "*" : env.corsOrigin.split(",") }));
  app.use(express.json({ limit: "10mb" })); // frames arrive as base64 JSON
  app.use(morgan("dev"));
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "safecity-backend" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/cameras", cameraRoutes);
  app.use("/api/incidents", incidentRoutes);
  app.use("/api/responses", responseRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/reports", reportRoutes);

  app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`[server] SafeCity AI backend listening on port ${env.port}`);
    console.log(`[server] AI service target: ${env.aiServiceUrl}`);
  });

  // Mark cameras offline if no frame/heartbeat received for 15s (mobile app sends frames ~1/sec)
  const STALE_MS = 15000;
  setInterval(async () => {
    const cutoff = new Date(Date.now() - STALE_MS);
    const staleCameras = await Camera.find({ status: "online", lastSeen: { $lt: cutoff } });
    for (const cam of staleCameras) {
      cam.status = "offline";
      await cam.save();
      getIO().emit(SOCKET_EVENTS.CAMERA_OFFLINE, cam.toObject());
    }
  }, 5000);
}

main().catch((err) => {
  console.error("[server] fatal startup error", err);
  process.exit(1);
});
