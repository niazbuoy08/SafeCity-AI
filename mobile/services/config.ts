// Change this to your backend's LAN IP when running on a physical device,
// e.g. "http://192.168.1.20:4000". "localhost" only works on emulators/web.
export const DEFAULT_BACKEND_URL = "http://localhost:4000";

export const DEFAULT_CAMERA_CONFIG = {
  cameraId: "CAM-124",
  name: "Camera 124",
  location: "Mohammadpur, Dhaka",
  latitude: 23.7644,
  longitude: 90.3596,
  detectionIntervalMs: 1000,
  backendUrl: DEFAULT_BACKEND_URL,
};

export type CameraConfig = typeof DEFAULT_CAMERA_CONFIG;
