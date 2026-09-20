import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Camera } from "../types";

export default function Settings() {
  const { user } = useAuth();
  const [cameras, setCameras] = useState<Camera[]>([]);

  const load = useCallback(async () => {
    const res = await api.get("/cameras");
    setCameras(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleMonitoring(camera: Camera) {
    await api.patch(`/cameras/${camera.cameraId}`, { aiMonitoring: !camera.aiMonitoring });
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <header>
        <h1 className="text-xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-slate-500">Account, camera monitoring, and system configuration.</p>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Account</h2>
        <div className="text-sm space-y-1">
          <div><span className="text-slate-500">Name:</span> <span className="font-medium">{user?.name}</span></div>
          <div><span className="text-slate-500">Email:</span> <span className="font-medium">{user?.email}</span></div>
          <div><span className="text-slate-500">Role:</span> <span className="font-medium uppercase">{user?.role}</span></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Camera AI Monitoring</h2>
        <div className="divide-y divide-slate-100">
          {cameras.map((cam) => (
            <div key={cam.cameraId} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm font-medium text-navy-900">{cam.name}</div>
                <div className="text-xs text-slate-500">{cam.cameraId} · {cam.location}</div>
              </div>
              <button
                onClick={() => toggleMonitoring(cam)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  cam.aiMonitoring
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-slate-100 text-slate-500 border-slate-300"
                }`}
              >
                {cam.aiMonitoring ? "AI Monitoring ON" : "AI Monitoring OFF"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Detection Thresholds</h2>
        <p className="text-sm text-slate-600">
          Configured via backend environment variables (<code>CONFIDENCE_IGNORE_BELOW</code>,{" "}
          <code>CONFIDENCE_HIGH_ABOVE</code>) and the AI service's own settings. Detections below the ignore
          threshold are dropped; detections between the two thresholds are treated as potential incidents; anything
          above the high threshold is treated as high confidence.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Product Principle</h2>
        <p className="text-sm text-slate-600">
          SafeCity AI provides AI-assisted incident detection and response. AI detects potential incidents, humans
          verify them, and authorities respond. Historical data supports preventive planning. SafeCity AI does not
          claim to prevent crime with certainty, and does not perform facial recognition or identity tracking.
        </p>
      </div>
    </div>
  );
}
