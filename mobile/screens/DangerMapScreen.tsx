import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { useCameraConfig } from "../context/CameraConfigContext";
import { DangerMapView, MapFocus, MapRoute } from "../components/DangerMapView";
import { DangerZone, DangerZonesResponse, RiskLevel, TimeOfDay, fetchDangerZones } from "../services/api";
import {
  LatLng,
  analyzeRoute,
  distanceM,
  formatDistanceM,
  mapsDirectionsUrl,
  EXPOSURE_RADIUS_M,
} from "../services/routeSafety";

const RANGES = [7, 30, 90];
const NEARBY_RADIUS_M = 2000;

const TYPE_FILTERS = [
  { key: "physical_altercation", label: "Fight" },
  { key: "road_accident", label: "Accident" },
  { key: "fire_smoke", label: "Fire" },
  { key: "person_fall", label: "Fall" },
];

// Dhaka-time windows, sent to the server as "from-to" (wraps past midnight)
const PERIODS = [
  { key: "any", label: "Any time", hours: null as string | null },
  { key: "morning", label: "Morning 5–12", hours: "5-12" },
  { key: "afternoon", label: "Afternoon 12–5", hours: "12-17" },
  { key: "evening", label: "Evening 5–10", hours: "17-22" },
  { key: "night", label: "Night 10–5", hours: "22-5" },
];

const TYPE_LABELS: Record<string, string> = {
  physical_altercation: "Physical altercation",
  road_accident: "Road accident",
  fire_smoke: "Fire / smoke",
  person_fall: "Person fall",
};

const RISK_LABEL: Record<RiskLevel, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };
const RISK_BG: Record<RiskLevel, string> = { high: "#dc2626", medium: "#f59e0b", low: "#334155" };
const RISK_FG: Record<RiskLevel, string> = { high: "#ffffff", medium: "#111827", low: "#e2e8f0" };
const RANK_BG = ["#dc2626", "#ea580c", "#f59e0b"];
const LEGEND = ["#fbe4e3", "#f0a8a4", "#e34948", "#c22f2f", "#7d1c1c"];

// ---- Dhaka time helpers (Bangladesh is UTC+6, no daylight saving) ----
const dhakaHourNow = () => new Date(Date.now() + 6 * 3600 * 1000).getUTCHours();

function hour12(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12} ${hh < 12 ? "AM" : "PM"}`;
}

function formatHourRange(start: number, end: number): string {
  const a = hour12(start);
  const b = hour12(end);
  return a.slice(-2) === b.slice(-2) && start < end ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/** Is `hour` inside [start, end), wrapping past midnight? */
function inWindow(hour: number, start: number, end: number): boolean {
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (60 * 24))}d ago`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------

function TimeOfDayCard({ tod, nowHour }: { tod: TimeOfDay; nowHour: number }) {
  const { peak, hourly, total, minRequired } = tod;
  const max = Math.max(1, ...hourly);
  const nowInPeak = !!peak && inWindow(nowHour, peak.startHour, peak.endHour);

  return (
    <View style={styles.todCard}>
      <Text style={styles.todTitle}>Time of day</Text>
      {peak ? (
        <Text style={styles.todText}>
          <Text style={styles.todPeak}>Higher risk {formatHourRange(peak.startHour, peak.endHour)}</Text>
          {` · ${Math.round(peak.share * 100)}% of verified incidents (${peak.incidents} of ${total})`}
        </Text>
      ) : total < minRequired ? (
        <Text style={styles.todText}>
          Not enough data yet for a time-of-day pattern ({total} of {minRequired} verified incidents needed).
        </Text>
      ) : (
        <Text style={styles.todText}>No clear time-of-day pattern — incidents are spread across the day.</Text>
      )}
      {nowInPeak && <Text style={styles.todNow}>It's inside that window right now — take extra care.</Text>}

      <View style={styles.todBars}>
        {hourly.map((v, h) => {
          const hot = !!peak && inWindow(h, peak.startHour, peak.endHour);
          return (
            <View key={h} style={styles.todCol}>
              <View
                style={{
                  height: v > 0 ? Math.max(4, (v / max) * 34) : 2,
                  borderRadius: 2,
                  backgroundColor: hot ? "#dc2626" : "#64748b",
                  opacity: v > 0 ? 1 : 0.35,
                }}
              />
              <View style={[styles.todNowMark, h === nowHour && styles.todNowMarkOn]} />
            </View>
          );
        })}
      </View>
      <View style={styles.todAxis}>
        {["12a", "6a", "12p", "6p"].map((l) => (
          <Text key={l} style={styles.todAxisText}>
            {l}
          </Text>
        ))}
      </View>
      <Text style={styles.todFoot}>Dhaka time · blue tick = now · uses your incident-type filter, all hours</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function DangerMapScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { config } = useCameraConfig();
  const [days, setDays] = useState(30);
  const [types, setTypes] = useState<string[]>([]);
  const [period, setPeriod] = useState("any");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [data, setData] = useState<DangerZonesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<LatLng | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const [routeMode, setRouteMode] = useState<"off" | "pick" | "result">("off");
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [travelMode, setTravelMode] = useState<"walking" | "driving">("walking");
  const [routeNote, setRouteNote] = useState<string | null>(null);

  const typesKey = types.join(",");
  const hours = PERIODS.find((p) => p.key === period)?.hours ?? null;
  const nowHour = dhakaHourNow();

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await fetchDangerZones(config.backendUrl, { days, types: typesKey ? typesKey.split(",") : [], hours }));
      } catch {
        setError("Could not reach the SafeCity server. Check your connection and the Backend URL in Settings.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [config.backendUrl, days, typesKey, hours]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) setLocationDenied(true);
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) setUser({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setUser({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // location is optional — the map and board still work without it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const zones = data?.zones ?? [];
  const activeFilters = (types.length ? 1 : 0) + (period !== "any" ? 1 : 0);
  const nowInPeak = !!data?.timeOfDay.peak && inWindow(nowHour, data.timeOfDay.peak.startHour, data.timeOfDay.peak.endHour);

  // ---- safer route: recomputed whenever the zones (i.e. the filters) change ----
  const analysis = useMemo(
    () => (routeMode === "result" && user && destination ? analyzeRoute(user, destination, zones) : null),
    [routeMode, user, destination, zones]
  );

  const mapRoute: MapRoute | null = useMemo(
    () =>
      analysis && destination
        ? {
            destination,
            direct: analysis.directPath,
            detour: analysis.detour ? analysis.detour.path : null,
            via: analysis.detour ? analysis.detour.via : [],
          }
        : null,
    [analysis, destination]
  );

  const startRoute = () => {
    if (!user) {
      setRouteNote(
        locationDenied
          ? "Turn on location to plan a route — it's used as your starting point."
          : "Still finding your location — try again in a moment."
      );
      return;
    }
    setRouteNote(null);
    setDestination(null);
    setRouteMode("pick");
  };

  const clearRoute = () => {
    setRouteMode("off");
    setDestination(null);
    setRouteNote(null);
  };

  const handlePick = (point: LatLng) => {
    if (routeMode !== "pick") return;
    setDestination(point);
    setRouteMode("result");
  };

  const openMaps = (via: LatLng[]) => {
    if (!user || !destination) return;
    Linking.openURL(mapsDirectionsUrl(user, destination, via, travelMode)).catch(() =>
      setRouteNote("Couldn't open a maps app on this phone.")
    );
  };

  const toggleType = (key: string) => setTypes((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  const resetFilters = () => {
    setTypes([]);
    setPeriod("any");
  };

  // ---- nearest zone banner (only when not planning a route) ----
  const nearest = useMemo(() => {
    if (!user || zones.length === 0) return null;
    let best: { zone: DangerZone; meters: number } | null = null;
    for (const zone of zones) {
      const meters = distanceM(user, zone);
      if (!best || meters < best.meters) best = { zone, meters };
    }
    return best;
  }, [user, zones]);

  const banner = (() => {
    if (routeMode !== "off") return null;
    if (nearest && nearest.meters <= NEARBY_RADIUS_M) {
      const { zone, meters } = nearest;
      const n = zone.incidentCount;
      return {
        tone: zone.riskLevel as "high" | "medium" | "low",
        text: `${zone.name} is ${formatDistanceM(meters)} from you — ${RISK_LABEL[zone.riskLevel].toLowerCase()}, ${n} verified incident${n === 1 ? "" : "s"} in the last ${days} days. Consider another route.`,
      };
    }
    if (user && data && zones.length > 0) {
      return { tone: "clear" as const, text: `No reported danger zones within ${NEARBY_RADIUS_M / 1000} km of you.` };
    }
    if (locationDenied) {
      return { tone: "info" as const, text: "Turn on location to see danger zones near you." };
    }
    return null;
  })();

  const bannerColors = {
    high: { bg: "#7f1d1d", border: "#dc2626" },
    medium: { bg: "#78350f", border: "#f59e0b" },
    low: { bg: "#1e293b", border: "#475569" },
    clear: { bg: "#14532d", border: "#16a34a" },
    info: { bg: "#1e293b", border: "#475569" },
  };

  const renderZone = ({ item, index }: { item: DangerZone; index: number }) => {
    const away = user ? formatDistanceM(distanceM(user, item)) : null;
    const typesText = item.types.map((t) => `${TYPE_LABELS[t.type] ?? t.type} ×${t.count}`).join(", ");
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => setFocus({ latitude: item.latitude, longitude: item.longitude, nonce: Date.now() })}
      >
        <View style={[styles.rank, { backgroundColor: RANK_BG[index] ?? "#334155" }]}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.zoneName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.zoneMeta} numberOfLines={2}>
            {typesText}
          </Text>
          <Text style={styles.zoneMeta}>
            Last: {timeAgo(item.lastIncidentAt)}
            {away ? ` · ${away} away` : ""}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.count}>{item.incidentCount}</Text>
          <View style={[styles.riskChip, { backgroundColor: RISK_BG[item.riskLevel] }]}>
            <Text style={[styles.riskChipText, { color: RISK_FG[item.riskLevel] }]}>{RISK_LABEL[item.riskLevel]}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ---- route card ----
  const routeCard = (() => {
    if (routeMode === "pick") {
      return (
        <View style={[styles.banner, { backgroundColor: "#1e293b", borderColor: "#60a5fa" }]}>
          <Text style={styles.bannerText}>Tap your destination on the map.</Text>
          <TouchableOpacity onPress={clearRoute} style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (routeMode !== "result" || !analysis || !user || !destination) return null;

    const names = joinNames(analysis.passesNear.map((z) => z.name));
    const extra = analysis.detour ? formatDistanceM(analysis.detour.extraM) : "";
    const endpointNotes = analysis.endpointZones.map((z) => {
      const atStart = distanceM(z, user) <= EXPOSURE_RADIUS_M;
      return `${atStart ? "You are starting in" : "Your destination is in"} ${z.name} (${RISK_LABEL[z.riskLevel].toLowerCase()}).`;
    });

    const tone = analysis.verdict === "clear" ? "#16a34a" : "#f59e0b";
    return (
      <View style={[styles.routeCard, { borderLeftColor: tone }]}>
        <Text style={styles.routeTitle}>
          {analysis.verdict === "clear"
            ? `✅ No reported danger zones near a direct path (about ${formatDistanceM(analysis.directM)}).`
            : analysis.verdict === "detour"
            ? `⚠ A direct path passes near ${names}. A detour of about +${extra} keeps clear of ${analysis.passesNear.length === 1 ? "it" : "them"}.`
            : `⚠ A direct path passes near ${names}, and I couldn't find a detour that avoids ${analysis.passesNear.length === 1 ? "it" : "them"}. Consider another time, another way of travelling, or extra care.`}
        </Text>
        {endpointNotes.map((n) => (
          <Text key={n} style={styles.routeNote}>
            {n}
          </Text>
        ))}

        <View style={styles.routeRow}>
          {(["walking", "driving"] as const).map((m) => (
            <TouchableOpacity key={m} onPress={() => setTravelMode(m)} style={[styles.chip, travelMode === m && styles.chipActive]}>
              <Text style={[styles.chipText, travelMode === m && styles.chipTextActive]}>{m === "walking" ? "🚶 Walk" : "🚗 Drive"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.routeRow}>
          {analysis.verdict === "detour" && analysis.detour ? (
            <>
              <TouchableOpacity style={[styles.routeBtn, styles.routeBtnGreen]} onPress={() => openMaps(analysis.detour!.via)}>
                <Text style={styles.routeBtnText}>Open safer route in Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.routeBtn, styles.routeBtnGhost]} onPress={() => openMaps([])}>
                <Text style={styles.routeBtnText}>Direct route</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.routeBtn, styles.routeBtnBlue]} onPress={() => openMaps([])}>
              <Text style={styles.routeBtnText}>Open in Maps</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.routeBtn, styles.routeBtnGhost]} onPress={clearRoute}>
            <Text style={styles.routeBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.routeFoot}>
          A hint, not a guarantee: it uses the straight line between you and your destination and the verified incidents
          matching your filters. Real roads differ — check the route in Maps.
        </Text>
      </View>
    );
  })();

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Danger Map</Text>
          <Text style={styles.subtitle}>Areas with operator-verified incidents</Text>
        </View>
        <View style={styles.chips}>
          {RANGES.map((r) => (
            <TouchableOpacity key={r} onPress={() => setDays(r)} style={[styles.chip, days === r && styles.chipActive]}>
              <Text style={[styles.chipText, days === r && styles.chipTextActive]}>{r}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.toolRow}>
        <TouchableOpacity onPress={() => setFiltersOpen((o) => !o)} style={[styles.toolBtn, activeFilters > 0 && styles.toolBtnOn]}>
          <Text style={styles.toolBtnText}>
            Filters {filtersOpen ? "▴" : "▾"}
            {activeFilters > 0 ? `  · ${activeFilters}` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={routeMode === "off" ? startRoute : clearRoute} style={[styles.toolBtn, routeMode !== "off" && styles.toolBtnOn]}>
          <Text style={styles.toolBtnText}>{routeMode === "off" ? "🧭 Safer route" : "✕ Close route"}</Text>
        </TouchableOpacity>
        {nowInPeak && (
          <View style={styles.nowPill}>
            <Text style={styles.nowPillText}>⏰ Higher-risk time now</Text>
          </View>
        )}
      </View>

      {filtersOpen && (
        <View style={styles.filters}>
          <Text style={styles.filterLabel}>Incident type</Text>
          <View style={styles.chipWrap}>
            {TYPE_FILTERS.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => toggleType(t.key)} style={[styles.chip, types.includes(t.key) && styles.chipActive]}>
                <Text style={[styles.chipText, types.includes(t.key) && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.filterLabel}>Time of day (Dhaka time)</Text>
          <View style={styles.chipWrap}>
            {PERIODS.map((p) => (
              <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)} style={[styles.chip, period === p.key && styles.chipActive]}>
                <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {activeFilters > 0 && (
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.resetText}>Reset filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {routeNote && (
        <View style={[styles.banner, { backgroundColor: "#1e293b", borderColor: "#475569" }]}>
          <Text style={styles.bannerText}>{routeNote}</Text>
        </View>
      )}

      {banner && (
        <View style={[styles.banner, { backgroundColor: bannerColors[banner.tone].bg, borderColor: bannerColors[banner.tone].border }]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      {routeCard}

      <View style={styles.mapWrap}>
        <DangerMapView
          zones={zones}
          heatPoints={data?.heatPoints ?? []}
          user={user}
          focus={focus}
          pickMode={routeMode === "pick"}
          route={mapRoute}
          onPick={handlePick}
        />
        {loading && (
          <View style={styles.mapLoading}>
            <ActivityIndicator color="#ffffff" />
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Lower risk</Text>
        {LEGEND.map((c) => (
          <View key={c} style={[styles.legendSwatch, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendText}>Higher risk</Text>
      </View>

      <FlatList
        style={styles.board}
        data={zones}
        keyExtractor={(z) => z.id}
        renderItem={renderZone}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#ffffff" colors={["#2a4d8a"]} />
        }
        ListHeaderComponent={
          <View>
            {data && data.timeOfDay.total > 0 && <TimeOfDayCard tod={data.timeOfDay} nowHour={nowHour} />}
            <Text style={styles.boardTitle}>
              Danger Board · last {days} days{data ? ` · ${data.totalIncidents} verified` : ""}
              {activeFilters > 0 ? " · filtered" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? null : error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{error}</Text>
              <View style={styles.emptyButtons}>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => load(false)}>
                  <Text style={styles.emptyBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyBtn} onPress={onOpenSettings}>
                  <Text style={styles.emptyBtnText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeFilters > 0
                  ? "No verified incidents match these filters. Try widening them."
                  : `No verified incidents in the last ${days} days. Zones appear here once SafeCity operators verify incidents.`}
              </Text>
              {activeFilters > 0 && (
                <TouchableOpacity style={styles.emptyBtn} onPress={resetFilters}>
                  <Text style={styles.emptyBtnText}>Reset filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        ListFooterComponent={
          <Text style={styles.disclaimer}>
            Based on incidents verified by SafeCity operators. This is a planning aid, not a guarantee of safety — stay
            alert everywhere.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1128" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 6, paddingBottom: 6 },
  headerText: { flex: 1 },
  title: { color: "white", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 12, marginTop: 1 },
  chips: { flexDirection: "row", gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: "#111c3d", borderWidth: 1, borderColor: "#1e3a6b" },
  chipActive: { backgroundColor: "#2a4d8a", borderColor: "#60a5fa" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "white" },

  toolRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
  toolBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#111c3d", borderWidth: 1, borderColor: "#1e3a6b" },
  toolBtnOn: { borderColor: "#60a5fa", backgroundColor: "#16284f" },
  toolBtnText: { color: "white", fontSize: 12, fontWeight: "700" },
  nowPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#7f1d1d", borderWidth: 1, borderColor: "#dc2626" },
  nowPillText: { color: "white", fontSize: 11, fontWeight: "700" },

  filters: { marginHorizontal: 14, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: "#0f1b3d", borderWidth: 1, borderColor: "#1e3a6b", gap: 6 },
  filterLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "700", marginTop: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  resetText: { color: "#60a5fa", fontSize: 12, fontWeight: "700", marginTop: 4 },

  banner: { marginHorizontal: 14, marginBottom: 8, padding: 10, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  bannerText: { color: "white", fontSize: 12, lineHeight: 17, fontWeight: "600", flex: 1 },
  bannerBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#334155" },
  bannerBtnText: { color: "white", fontSize: 11, fontWeight: "700" },

  routeCard: { marginHorizontal: 14, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: "#111c3d", borderLeftWidth: 4, gap: 7 },
  routeTitle: { color: "white", fontSize: 12.5, lineHeight: 18, fontWeight: "700" },
  routeNote: { color: "#fcd34d", fontSize: 11.5, lineHeight: 16 },
  routeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  routeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
  routeBtnGreen: { backgroundColor: "#15803d" },
  routeBtnBlue: { backgroundColor: "#2a4d8a" },
  routeBtnGhost: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" },
  routeBtnText: { color: "white", fontSize: 12, fontWeight: "700" },
  routeFoot: { color: "#64748b", fontSize: 10, lineHeight: 14 },

  mapWrap: { flex: 1.15, marginHorizontal: 14, borderRadius: 14, overflow: "hidden", backgroundColor: "#e5e7eb" },
  mapLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,17,40,0.45)", alignItems: "center", justifyContent: "center" },

  legend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 7 },
  legendText: { color: "#94a3b8", fontSize: 10, fontWeight: "600", marginHorizontal: 4 },
  legendSwatch: { width: 26, height: 8, borderRadius: 2 },

  board: { flex: 1, paddingHorizontal: 14 },
  boardTitle: { color: "#cbd5e1", fontSize: 12, fontWeight: "700", marginBottom: 6 },

  todCard: { backgroundColor: "#0f1b3d", borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#1e3a6b" },
  todTitle: { color: "#cbd5e1", fontSize: 12, fontWeight: "800", marginBottom: 3 },
  todText: { color: "#cbd5e1", fontSize: 12, lineHeight: 17 },
  todPeak: { color: "#fca5a5", fontWeight: "800" },
  todNow: { color: "#fca5a5", fontSize: 11, fontWeight: "700", marginTop: 3 },
  todBars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 42, marginTop: 8 },
  todCol: { flex: 1, justifyContent: "flex-end" },
  todNowMark: { height: 3, marginTop: 2, borderRadius: 2, backgroundColor: "transparent" },
  todNowMarkOn: { backgroundColor: "#60a5fa" },
  todAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 1 },
  todAxisText: { color: "#64748b", fontSize: 9 },
  todFoot: { color: "#64748b", fontSize: 9.5, marginTop: 4 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111c3d", borderRadius: 12, padding: 10, marginBottom: 8 },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rankText: { color: "white", fontSize: 12, fontWeight: "800" },
  rowBody: { flex: 1 },
  zoneName: { color: "white", fontSize: 14, fontWeight: "700" },
  zoneMeta: { color: "#94a3b8", fontSize: 11, marginTop: 1 },
  rowRight: { alignItems: "flex-end", gap: 3 },
  count: { color: "white", fontSize: 20, fontWeight: "800" },
  riskChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  riskChipText: { fontSize: 10, fontWeight: "800" },

  empty: { paddingVertical: 18, alignItems: "center", gap: 12 },
  emptyText: { color: "#94a3b8", fontSize: 12, textAlign: "center", lineHeight: 18 },
  emptyButtons: { flexDirection: "row", gap: 10 },
  emptyBtn: { backgroundColor: "#1e3a6b", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  emptyBtnText: { color: "white", fontSize: 12, fontWeight: "700" },

  disclaimer: { color: "#64748b", fontSize: 10, lineHeight: 14, textAlign: "center", paddingVertical: 10 },
});
