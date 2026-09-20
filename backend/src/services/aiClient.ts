import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env";
import { DetectionResult } from "../types";

/**
 * Thin client for the separate Python AI Detection Service.
 * The backend never embeds detection logic itself — it always
 * delegates to this service, which can run "demo", "real", or "gemini"
 * providers behind an identical HTTP contract. Timeout is generous because
 * the "gemini" provider makes a real external API call per frame, which is
 * slower than the local demo/OpenCV providers.
 */
export async function analyzeFrame(params: {
  imageBase64: string;
  cameraId: string;
}): Promise<DetectionResult> {
  const buffer = Buffer.from(params.imageBase64, "base64");
  const form = new FormData();
  form.append("file", buffer, { filename: "frame.jpg", contentType: "image/jpeg" });
  form.append("camera_id", params.cameraId);

  const res = await axios.post<DetectionResult>(`${env.aiServiceUrl}/api/detect`, form, {
    headers: form.getHeaders(),
    timeout: 20000,
  });
  return res.data;
}

/**
 * Ask the AI service to synthesize a realistic detection for a Demo Mode
 * button press (fight / accident / fire / fall), without requiring an
 * actual video frame. Used so demos work even if the live model misses
 * the staged event.
 */
export async function simulateDetection(params: {
  scenario: "fight" | "accident" | "fire" | "fall";
  cameraId: string;
}): Promise<DetectionResult> {
  const res = await axios.post<DetectionResult>(`${env.aiServiceUrl}/api/simulate`, {
    scenario: params.scenario,
    camera_id: params.cameraId,
  });
  return res.data;
}
