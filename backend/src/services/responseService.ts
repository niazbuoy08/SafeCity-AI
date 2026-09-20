import { v4 as uuid } from "uuid";
import { ResponseTeam, Response, Incident } from "../models";
import { ResponseAuthority, SOCKET_EVENTS } from "../types";
import { getIO } from "../sockets/io";

export async function dispatchTeam(params: {
  incidentId: string;
  authority: ResponseAuthority;
  teamId?: string;
}) {
  const incident = await Incident.findOne({ incidentId: params.incidentId });
  if (!incident) throw new Error("Incident not found");

  let team = params.teamId
    ? await ResponseTeam.findOne({ teamId: params.teamId })
    : await ResponseTeam.findOne({ authority: params.authority, status: "available" });

  if (!team) {
    team = await ResponseTeam.findOne({ authority: params.authority }).sort({ updatedAt: 1 });
  }
  if (!team) throw new Error(`No response team available for authority: ${params.authority}`);

  const responseId = `RSP-${Date.now().toString(36).toUpperCase()}-${uuid().slice(0, 4)}`;
  const response = await Response.create({
    responseId,
    incidentId: incident.incidentId,
    teamId: team.teamId,
    authority: params.authority,
    status: "dispatched",
    priority: incident.severity,
    dispatchedAt: new Date(),
  });

  team.status = "dispatched";
  await team.save();

  incident.status = "dispatched";
  incident.assignedAuthority = params.authority;
  incident.responseId = response.responseId;
  await incident.save();

  getIO().emit(SOCKET_EVENTS.RESPONSE_CREATED, serializeResponse(response, team));
  getIO().emit(SOCKET_EVENTS.INCIDENT_UPDATED, incident.toObject());

  return { response, team, incident };
}

export async function updateResponseStatus(responseId: string, status: "responding" | "resolved") {
  const response = await Response.findOne({ responseId });
  if (!response) throw new Error("Response not found");

  response.status = status;
  if (status === "responding") response.arrivedAt = new Date();
  if (status === "resolved") response.resolvedAt = new Date();
  await response.save();

  const incident = await Incident.findOne({ incidentId: response.incidentId });
  if (incident) {
    incident.status = status === "resolved" ? "resolved" : "responding";
    if (status === "resolved") incident.resolvedAt = new Date();
    await incident.save();
  }

  const team = await ResponseTeam.findOne({ teamId: response.teamId });
  if (team && status === "resolved") {
    team.status = "available";
    await team.save();
  }

  getIO().emit(SOCKET_EVENTS.RESPONSE_UPDATED, serializeResponse(response, team));
  if (incident) getIO().emit(SOCKET_EVENTS.INCIDENT_UPDATED, incident.toObject());

  return { response, team, incident };
}

export function serializeResponse(response: any, team: any) {
  const r = response.toObject ? response.toObject() : response;
  return {
    ...r,
    teamName: team?.name ?? null,
    teamBaseLocation: team?.baseLocation ?? null,
  };
}
