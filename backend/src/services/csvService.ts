import { ReportIncident, ReportResponse, AUTHORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "./reportService";
import { formatDhaka } from "../utils/dhakaTime";

/**
 * CSV export.
 *
 * Two things matter beyond basic quoting:
 *  - Formula injection: several fields (notably `location`, which comes from a
 *    camera's self-reported settings) are free text. A value like
 *    `=HYPERLINK(...)` would EXECUTE when the CSV is opened in Excel/Sheets, so
 *    any text starting with = + - @ (or a tab/CR) is prefixed with an
 *    apostrophe to force it to be read as plain text.
 *  - Excel needs a UTF-8 byte-order mark to display Bengali text correctly.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  header: string;
  get: (row: T) => unknown;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.get(row))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

const dhaka = (d: Date | null) => (d ? formatDhaka(d) : "");
const secondsBetween = (a: Date | null, b: Date) => (a ? Math.round((a.getTime() - b.getTime()) / 1000) : "");

export function incidentsToCsv(incidents: ReportIncident[], responses: ReportResponse[]): string {
  const responseByIncident = new Map(responses.map((r) => [r.incidentId, r]));

  const columns: CsvColumn<ReportIncident>[] = [
    { header: "Incident ID", get: (i) => i.incidentId },
    { header: "Detected (Dhaka time)", get: (i) => dhaka(i.detectedAt) },
    { header: "Detected (UTC)", get: (i) => i.detectedAt },
    { header: "Type", get: (i) => TYPE_LABELS[i.type] ?? i.type },
    { header: "Severity", get: (i) => i.severity },
    { header: "AI confidence %", get: (i) => Math.round(i.confidence) },
    { header: "Status", get: (i) => STATUS_LABELS[i.status] ?? i.status },
    { header: "Camera", get: (i) => i.cameraId },
    { header: "Location", get: (i) => i.location },
    { header: "Latitude", get: (i) => i.latitude },
    { header: "Longitude", get: (i) => i.longitude },
    { header: "Reviewed by", get: (i) => i.verifiedBy },
    { header: "Reviewed (Dhaka time)", get: (i) => dhaka(i.verifiedAt) },
    { header: "Seconds to review", get: (i) => secondsBetween(i.verifiedAt, i.detectedAt) },
    { header: "False alarm reason", get: (i) => i.falseAlarmReason },
    { header: "Assigned authority", get: (i) => (i.assignedAuthority ? AUTHORITY_LABELS[i.assignedAuthority] ?? i.assignedAuthority : "") },
    { header: "Response ID", get: (i) => i.responseId },
    { header: "Dispatched (Dhaka time)", get: (i) => dhaka(responseByIncident.get(i.incidentId)?.dispatchedAt ?? null) },
    { header: "Team on scene (Dhaka time)", get: (i) => dhaka(responseByIncident.get(i.incidentId)?.arrivedAt ?? null) },
    { header: "Resolved (Dhaka time)", get: (i) => dhaka(i.resolvedAt) },
  ];

  return toCsv(columns, incidents);
}
