import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ResponseTeam, ResponseRecord, AUTHORITY_LABELS, SOCKET_EVENTS } from "../types";

export default function ResponseTeamsPage() {
  const socket = useSocket();
  const [teams, setTeams] = useState<ResponseTeam[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([api.get("/responses/teams"), api.get("/responses")]);
    setTeams(t.data);
    setResponses(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on(SOCKET_EVENTS.RESPONSE_CREATED, refresh);
    socket.on(SOCKET_EVENTS.RESPONSE_UPDATED, refresh);
    return () => {
      socket.off(SOCKET_EVENTS.RESPONSE_CREATED, refresh);
      socket.off(SOCKET_EVENTS.RESPONSE_UPDATED, refresh);
    };
  }, [socket, load]);

  const statusStyle: Record<string, string> = {
    available: "bg-green-100 text-green-700 border-green-300",
    dispatched: "bg-amber-100 text-amber-700 border-amber-300",
    off_duty: "bg-slate-100 text-slate-500 border-slate-300",
  };

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-navy-900">Response Teams</h1>
        <p className="text-sm text-slate-500">Simulated response units for demonstration purposes.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div key={team.teamId} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-navy-900">{team.name}</div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusStyle[team.status]}`}>
                {team.status.replace("_", " ")}
              </span>
            </div>
            <div className="text-sm text-slate-500 mt-1">{AUTHORITY_LABELS[team.authority]}</div>
            <div className="text-xs text-slate-400 mt-1">Base: {team.baseLocation}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Active & Recent Dispatches</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Incident</th>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-left px-4 py-3">Authority</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Dispatched</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {responses.map((r) => (
                <tr key={r.responseId}>
                  <td className="px-4 py-2 font-medium text-navy-900">{r.incidentId}</td>
                  <td className="px-4 py-2">{teams.find((t) => t.teamId === r.teamId)?.name || r.teamId}</td>
                  <td className="px-4 py-2">{AUTHORITY_LABELS[r.authority]}</td>
                  <td className="px-4 py-2 uppercase text-xs font-semibold">{r.priority}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(r.dispatchedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 capitalize">{r.status}</td>
                </tr>
              ))}
              {responses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No response dispatches yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
