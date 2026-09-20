import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "frames");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Persists a base64-encoded JPEG frame to local disk and returns a
 * relative URL servable by the backend's static file middleware.
 * Swappable later for S3 / GCS without touching call sites.
 */
export function saveFrame(cameraId: string, imageBase64: string): string {
  const filename = `${cameraId}_${Date.now()}_${uuid().slice(0, 8)}.jpg`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(imageBase64, "base64"));
  return `/uploads/frames/${filename}`;
}

