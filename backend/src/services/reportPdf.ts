import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { Writable } from "stream";
import { WeeklyReport } from "./reportService";
import { formatDhaka, formatDuration } from "../utils/dhakaTime";

/**
 * Renders the weekly summary as an A4 PDF using pdfkit (pure JS — no browser
 * needed). Bengali text (camera locations are often reverse-geocoded into
 * Bengali) needs an embedded font: the built-in PDF fonts have no Bengali
 * glyphs and would print blanks. Each string that contains Bengali characters
 * uses Hind Siliguri (OFL) — chosen because it covers Bengali AND Latin, so a
 * line mixing both ("Highest-volume area: মোহাম্মদপুর, ঢাকা") renders whole;
 * a Bengali-only font prints boxes for the English letters and the comma.
 * Everything else uses the built-in Helvetica.
 */

const ASSETS = path.join(__dirname, "..", "..", "assets");
const LOGO = path.join(ASSETS, "logo.png");
const FONT_BN = path.join(ASSETS, "fonts", "HindSiliguri-Regular.ttf");

const NAVY = "#0f1b3d";
const BLUE = "#2a4d8a";
const LIGHT_BLUE = "#bfdbfe";
const INK = "#1e293b";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ZEBRA = "#f8fafc";
const RED = "#dc2626";
const SEVERITY_COLOR: Record<string, string> = { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a" };
const RISK_COLOR: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#64748b" };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const CW = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 72; // leave room for the footer
const MAX_LOG_ROWS = 120;

const BENGALI = /[ঀ-৿]/;

type Doc = InstanceType<typeof PDFDocument>;

interface TextOpts {
  size?: number;
  color?: string;
  bold?: boolean;
  width?: number;
  align?: "left" | "right" | "center";
  oneLine?: boolean;
}

function t(doc: Doc, text: string, x: number, y: number, o: TextOpts = {}) {
  const size = o.size ?? 9;
  doc.font(BENGALI.test(text) ? "bn" : o.bold ? "Helvetica-Bold" : "Helvetica");
  doc.fontSize(size).fillColor(o.color ?? INK);
  const opts: Record<string, unknown> = { width: o.width, align: o.align ?? "left" };
  // One-line cells: a height under two lines makes pdfkit cut the text with an ellipsis
  if (o.oneLine) Object.assign(opts, { height: size * 2, ellipsis: true });
  doc.text(text, x, y, opts);
}

function runningHeader(doc: Doc, report: WeeklyReport) {
  t(doc, `SafeCity AI — Weekly Safety Summary · ${report.period.label}`, M, 28, { size: 8, color: MUTED });
  doc.moveTo(M, 42).lineTo(M + CW, 42).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.y = 58;
  doc.x = M;
}

function need(doc: Doc, height: number) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

function sectionTitle(doc: Doc, title: string, minBodyHeight = 60) {
  need(doc, 30 + minBodyHeight);
  const y = doc.y + 10;
  t(doc, title, M, y, { size: 12, bold: true, color: NAVY });
  doc.moveTo(M, y + 17).lineTo(M + CW, y + 17).lineWidth(1).strokeColor(BLUE).stroke();
  doc.y = y + 26;
  doc.x = M;
}

function delta(now: number, prev: number, hasPrev: boolean): string {
  if (!hasPrev) return "no earlier data";
  if (now === prev) return "same as previous 7 days";
  return `${now > prev ? "+" : "-"}${Math.abs(now - prev)} vs previous 7 days`;
}

function kpi(doc: Doc, x: number, y: number, w: number, label: string, value: string, sub: string) {
  doc.roundedRect(x, y, w, 64, 6).lineWidth(0.8).strokeColor(LINE).fillAndStroke("#ffffff", LINE);
  t(doc, label.toUpperCase(), x + 8, y + 8, { size: 6.5, color: MUTED, bold: true, width: w - 16 });
  t(doc, value, x + 8, y + 21, { size: 19, bold: true, color: NAVY, width: w - 16 });
  t(doc, sub, x + 8, y + 49, { size: 6.5, color: MUTED, width: w - 16 });
}

function drawHeader(doc: Doc, report: WeeklyReport) {
  doc.rect(0, 0, PAGE_W, 88).fill(NAVY);
  if (fs.existsSync(LOGO)) doc.image(LOGO, M, 20, { width: 46 });
  t(doc, "SafeCity AI", M + 58, 22, { size: 21, bold: true, color: "#ffffff" });
  t(doc, "Weekly Safety Summary", M + 58, 50, { size: 11, color: LIGHT_BLUE });
  t(doc, report.period.label, M, 26, { size: 13, bold: true, color: "#ffffff", width: CW, align: "right" });
  t(doc, `Generated ${formatDhaka(new Date(report.generatedAt))} (Dhaka time)`, M, 48, {
    size: 7.5,
    color: LIGHT_BLUE,
    width: CW,
    align: "right",
  });
  t(doc, "Prepared for: responsible authorities", M, 62, { size: 7.5, color: LIGHT_BLUE, width: CW, align: "right" });
  doc.y = 106;
  doc.x = M;
}

function drawKpis(doc: Doc, r: WeeklyReport) {
  const hasPrev = r.previous.detections > 0 || r.previous.confirmed > 0;
  const gap = 8;
  const w = (CW - gap * 4) / 5;
  const y = doc.y;
  kpi(doc, M, y, w, "AI detections", String(r.totals.detections), delta(r.totals.detections, r.previous.detections, hasPrev));
  kpi(doc, M + (w + gap), y, w, "Verified incidents", String(r.totals.confirmed), delta(r.totals.confirmed, r.previous.confirmed, hasPrev));
  kpi(
    doc,
    M + (w + gap) * 2,
    y,
    w,
    "False alarms",
    String(r.totals.falseAlarms),
    r.totals.falseAlarmRatePct === null ? "none reviewed" : `${r.totals.falseAlarmRatePct}% of reviewed`
  );
  kpi(
    doc,
    M + (w + gap) * 3,
    y,
    w,
    "Time to decision",
    formatDuration(r.timings.avgReviewSec),
    r.timings.reviewN ? `average, ${r.timings.reviewN} reviewed` : "no reviews yet"
  );
  kpi(
    doc,
    M + (w + gap) * 4,
    y,
    w,
    "Dispatch to on scene",
    formatDuration(r.timings.avgResponseSec),
    r.timings.responseN ? `average, ${r.timings.responseN} response(s)` : "no arrivals recorded"
  );
  doc.y = y + 64;
}

function drawObservations(doc: Doc, r: WeeklyReport) {
  sectionTitle(doc, "Key observations", 40);
  for (const line of r.highlights) {
    doc.font(BENGALI.test(line) ? "bn" : "Helvetica").fontSize(9.5);
    const h = doc.heightOfString(line, { width: CW - 14 });
    need(doc, h + 6);
    const y = doc.y;
    doc.circle(M + 3, y + 5, 2).fill(BLUE);
    t(doc, line, M + 14, y, { size: 9.5, width: CW - 14 });
    doc.y = y + h + 5;
    doc.x = M;
  }
}

function drawByType(doc: Doc, r: WeeklyReport) {
  sectionTitle(doc, "Verified incidents by type", 50);
  if (r.byType.length === 0) {
    t(doc, "No verified incidents in this period.", M, doc.y, { size: 9, color: MUTED });
    doc.y += 16;
    return;
  }
  const max = Math.max(...r.byType.map((b) => b.count));
  const barMax = CW - 190;
  let y = doc.y;
  for (const row of r.byType) {
    need(doc, 22);
    y = doc.y;
    t(doc, row.label, M, y + 3, { size: 9, width: 130, oneLine: true });
    const w = Math.max(3, (row.count / max) * barMax);
    doc.roundedRect(M + 140, y, w, 14, 2).fill(BLUE);
    t(doc, String(row.count), M + 140 + w + 6, y + 3, { size: 9, bold: true, color: NAVY });
    doc.y = y + 21;
  }
}

function drawByDay(doc: Doc, r: WeeklyReport) {
  sectionTitle(doc, "Incidents by day", 130);
  const top = doc.y;
  const chartH = 62;
  const slot = CW / r.byDay.length;
  const max = Math.max(1, ...r.byDay.map((d) => d.detections));
  const barW = 16;
  r.byDay.forEach((d, i) => {
    const x0 = M + slot * i + (slot - barW * 2 - 3) / 2;
    const series: [number, string][] = [
      [d.detections, LIGHT_BLUE],
      [d.confirmed, BLUE],
    ];
    series.forEach(([value, color], k) => {
      const h = (value / max) * chartH;
      const x = x0 + k * (barW + 3);
      if (value > 0) {
        doc.rect(x, top + 12 + chartH - h, barW, h).fill(color);
        t(doc, String(value), x, top + 12 + chartH - h - 10, { size: 7, color: MUTED, width: barW, align: "center" });
      }
    });
    t(doc, d.label, M + slot * i, top + chartH + 16, { size: 7.5, color: MUTED, width: slot, align: "center" });
  });
  doc.moveTo(M, top + 12 + chartH).lineTo(M + CW, top + 12 + chartH).lineWidth(0.5).strokeColor(LINE).stroke();
  // legend
  const ly = top + chartH + 32;
  doc.rect(M, ly, 8, 8).fill(LIGHT_BLUE);
  t(doc, "AI detections", M + 12, ly, { size: 7.5, color: MUTED });
  doc.rect(M + 84, ly, 8, 8).fill(BLUE);
  t(doc, "Verified by operator", M + 96, ly, { size: 7.5, color: MUTED });
  doc.y = ly + 16;
  doc.x = M;
}

function drawTimeOfDay(doc: Doc, r: WeeklyReport) {
  sectionTitle(doc, "Verified incidents by time of day (Dhaka time)", 110);
  const top = doc.y;
  const chartH = 44;
  const slot = CW / 24;
  const hourly = r.timeOfDay.hourly;
  const max = Math.max(1, ...hourly);
  const peak = r.timeOfDay.peak;
  const inPeak = (h: number) => !!peak && Array.from({ length: 4 }, (_, k) => (peak.startHour + k) % 24).includes(h);

  hourly.forEach((v, h) => {
    const barH = v > 0 ? Math.max(2, (v / max) * chartH) : 0;
    if (barH > 0) doc.rect(M + slot * h + 2, top + chartH - barH, slot - 4, barH).fill(inPeak(h) ? RED : "#94a3b8");
  });
  doc.moveTo(M, top + chartH).lineTo(M + CW, top + chartH).lineWidth(0.5).strokeColor(LINE).stroke();
  ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"].forEach((lab, i) => {
    t(doc, lab, M + slot * i * 3, top + chartH + 4, { size: 7, color: MUTED, width: slot * 3, align: "left" });
  });

  const caption = peak
    ? `Busiest stretch: ${r.timeOfDay.peakLabel} — ${peak.incidents} of ${r.timeOfDay.total} verified incidents (${Math.round(peak.share * 100)}%), shown in red.`
    : r.timeOfDay.total < r.timeOfDay.minRequired
    ? `Not enough verified incidents (${r.timeOfDay.total}; at least ${r.timeOfDay.minRequired} needed) to identify a time-of-day pattern.`
    : "No clear time-of-day pattern: incidents are spread across the day.";
  t(doc, caption, M, top + chartH + 20, { size: 8.5, color: MUTED, width: CW });
  doc.y = top + chartH + 38;
  doc.x = M;
}

function tableHeader(doc: Doc, cols: { label: string; x: number; w: number; align?: "left" | "right" }[]) {
  const y = doc.y;
  doc.rect(M, y, CW, 16).fill(NAVY);
  cols.forEach((c) => t(doc, c.label, M + c.x + 4, y + 4.5, { size: 7.5, bold: true, color: "#ffffff", width: c.w - 8, align: c.align }));
  doc.y = y + 16;
}

function drawTopAreas(doc: Doc, r: WeeklyReport) {
  sectionTitle(doc, "Areas with the most verified incidents", 70);
  if (r.topAreas.length === 0) {
    t(doc, "No verified incidents in this period.", M, doc.y, { size: 9, color: MUTED });
    doc.y += 16;
    return;
  }
  const cols = [
    { label: "#", x: 0, w: 24 },
    { label: "Area", x: 24, w: 230 },
    { label: "Incident types", x: 254, w: 141 },
    { label: "Verified", x: 395, w: 45, align: "right" as const },
    { label: "Serious", x: 440, w: 45, align: "right" as const },
    { label: "Risk", x: 485, w: CW - 485 },
  ];
  tableHeader(doc, cols);
  r.topAreas.forEach((a, i) => {
    need(doc, 20);
    const y = doc.y;
    if (i % 2 === 1) doc.rect(M, y, CW, 18).fill(ZEBRA);
    t(doc, String(i + 1), M + 4, y + 5, { size: 8.5, color: MUTED });
    t(doc, a.name, M + 28, y + 5, { size: 8.5, width: 222, oneLine: true });
    t(doc, a.types.map((x) => `${x.label} ×${x.count}`).join(", "), M + 258, y + 5, { size: 7.5, color: MUTED, width: 133, oneLine: true });
    t(doc, String(a.incidents), M + 399, y + 5, { size: 8.5, bold: true, width: 37, align: "right" });
    t(doc, String(a.serious), M + 444, y + 5, { size: 8.5, width: 37, align: "right" });
    t(doc, a.riskLevel.toUpperCase(), M + 489, y + 5, { size: 7.5, bold: true, color: RISK_COLOR[a.riskLevel] ?? MUTED });
    doc.y = y + 18;
  });
  doc.y += 8;
  doc.x = M;
}

function drawResponses(doc: Doc, r: WeeklyReport) {
  sectionTitle(doc, "Response summary", 50);
  const y = doc.y;
  if (r.responses.total === 0) {
    t(doc, "No response teams were dispatched in this period.", M, y, { size: 9, color: MUTED });
    doc.y = y + 16;
    return;
  }
  const byAuth = r.responses.byAuthority.map((a) => `${a.label} ${a.count}`).join("   ·   ");
  t(doc, `${r.responses.total} dispatch(es):  ${byAuth}`, M, y, { size: 9, width: CW });
  const lines = [
    r.timings.responseN ? `Average dispatch to on scene: ${formatDuration(r.timings.avgResponseSec)} (${r.timings.responseN} response(s))` : null,
    r.timings.resolveN ? `Average detection to resolution: ${formatDuration(r.timings.avgResolveSec)} (${r.timings.resolveN} incident(s))` : null,
  ].filter(Boolean) as string[];
  lines.forEach((l, i) => t(doc, l, M, y + 15 + i * 13, { size: 9, color: MUTED, width: CW }));
  doc.y = y + 16 + lines.length * 13;
  doc.x = M;
}

function drawLog(doc: Doc, r: WeeklyReport) {
  // Nothing to list — the sections above already say so; skip rather than add a near-blank page
  if (r.incidents.length === 0) return;
  sectionTitle(doc, "Verified incident log", 60);
  const cols = [
    { label: "Time (Dhaka)", x: 0, w: 88 },
    { label: "Type", x: 88, w: 92 },
    { label: "Severity", x: 180, w: 50 },
    { label: "Location", x: 230, w: 145 },
    { label: "Status", x: 375, w: 62 },
    { label: "Authority", x: 437, w: 78.28 },
  ];
  tableHeader(doc, cols);
  const rows = r.incidents.slice(0, MAX_LOG_ROWS);
  rows.forEach((inc, i) => {
    if (doc.y + 17 > BOTTOM) {
      doc.addPage();
      tableHeader(doc, cols);
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(M, y, CW, 16).fill(ZEBRA);
    t(doc, formatDhaka(new Date(inc.detectedAt)), M + 4, y + 4.5, { size: 7.5, width: 82, oneLine: true });
    t(doc, inc.typeLabel, M + 92, y + 4.5, { size: 7.5, width: 84, oneLine: true });
    doc.circle(M + 184, y + 8, 2.5).fill(SEVERITY_COLOR[inc.severity] ?? MUTED);
    t(doc, inc.severity, M + 191, y + 4.5, { size: 7.5, width: 38, oneLine: true });
    t(doc, inc.location, M + 234, y + 4.5, { size: 7.5, width: 137, oneLine: true });
    t(doc, inc.statusLabel, M + 379, y + 4.5, { size: 7.5, width: 54, oneLine: true });
    t(doc, inc.authority ?? "—", M + 441, y + 4.5, { size: 7.5, width: 70, oneLine: true });
    doc.y = y + 16;
  });
  if (r.incidents.length > MAX_LOG_ROWS) {
    t(doc, `Showing the latest ${MAX_LOG_ROWS} of ${r.incidents.length} verified incidents — export the CSV for the full list.`, M, doc.y + 6, {
      size: 8,
      color: MUTED,
      width: CW,
    });
    doc.y += 22;
  }
  doc.x = M;
}

function drawFooters(doc: Doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing below the bottom margin would make pdfkit add a page; lift it for the footer only
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(M, PAGE_H - 52).lineTo(M + CW, PAGE_H - 52).lineWidth(0.5).strokeColor(LINE).stroke();
    t(
      doc,
      "AI-assisted incident detection: every incident counted as verified was confirmed by a human operator; false alarms are excluded from all statistics. Figures come from a prototype deployment and are indicative, not official statistics.",
      M,
      PAGE_H - 46,
      { size: 6.5, color: MUTED, width: CW - 70 }
    );
    t(doc, `Page ${i - range.start + 1} of ${range.count}`, M, PAGE_H - 46, { size: 7.5, color: MUTED, width: CW, align: "right" });
    doc.page.margins.bottom = saved;
  }
}

export function renderWeeklyReportPdf(report: WeeklyReport, out: Writable): void {
  const doc = new PDFDocument({
    size: "A4",
    margin: M,
    bufferPages: true,
    info: {
      Title: `SafeCity AI — Weekly Safety Summary (${report.period.label})`,
      Author: "SafeCity AI",
      Subject: "Weekly incident summary for authorities",
    },
  });
  if (fs.existsSync(FONT_BN)) doc.registerFont("bn", FONT_BN);
  else doc.registerFont("bn", "Helvetica"); // degrade gracefully if the font file is missing

  doc.pipe(out);
  doc.on("pageAdded", () => runningHeader(doc, report));

  drawHeader(doc, report);
  drawKpis(doc, report);
  drawObservations(doc, report);
  drawByType(doc, report);
  drawByDay(doc, report);
  drawTimeOfDay(doc, report);
  drawTopAreas(doc, report);
  drawResponses(doc, report);
  drawLog(doc, report);
  drawFooters(doc);

  doc.end();
}
