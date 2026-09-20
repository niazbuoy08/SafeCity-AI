import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { CameraCard } from "../components/CameraCard";
import { Camera, SOCKET_EVENTS } from "../types";

export default function LiveCameras() {
  const socket = useSocket();
  const [cameras, setCameras] = useState<Camera[]>([]);

  const load = useCallback(async () => {
    const res = await api.get("/cameras");
    setCameras(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on(SOCKET_EVENTS.CAMERA_ONLINE, refresh);
    socket.on(SOCKET_EVENTS.CAMERA_OFFLINE, refresh);
    socket.on(SOCKET_EVENTS.CAMERA_FRAME, refresh);
    socket.on(SOCKET_EVENTS.INCIDENT_DETECTED, refresh);
    return () => {
      socket.off(SOCKET_EVENTS.CAMERA_ONLINE, refresh);
      socket.off(SOCKET_EVENTS.CAMERA_OFFLINE, refresh);
      socket.off(SOCKET_EVENTS.CAMERA_FRAME, refresh);
      socket.off(SOCKET_EVENTS.INCIDENT_DETECTED, refresh);
    };
  }, [socket, load]);

  const onlineCount = cameras.filter((c) => c.status === "online").length;

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Live Cameras</h1>
          <p className="text-sm text-slate-500">
            {onlineCount} of {cameras.length} cameras online
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cameras.map((cam) => (
          <CameraCard key={cam.cameraId} camera={cam} />
        ))}
      </div>
    </div>
  );
}
