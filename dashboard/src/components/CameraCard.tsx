import { Link } from "react-router-dom";
import { Camera } from "../types";
import { CameraStatusDot } from "./Badges";
import { frameUrl } from "../api/client";

export function CameraCard({ camera }: { camera: Camera }) {
  const img = frameUrl(camera.lastFrameUrl);

  return (
    <Link
      to={`/cameras/${camera.cameraId}`}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow block"
    >
      <div className="aspect-video bg-navy-950 relative flex items-center justify-center">
        {img ? (
          <img src={img} alt={camera.cameraId} className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-500 text-sm">No frame yet</span>
        )}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded">
          {camera.cameraId}
        </div>
        {camera.aiMonitoring && (
          <div className="absolute top-2 right-2 bg-blue-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> AI ACTIVE
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-navy-900 text-sm">{camera.name}</div>
          <CameraStatusDot status={camera.status} />
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{camera.location}</div>
        <div className="text-[11px] text-slate-400 mt-1">
          Last activity: {camera.lastSeen ? new Date(camera.lastSeen).toLocaleTimeString() : "never"}
        </div>
      </div>
    </Link>
  );
}
