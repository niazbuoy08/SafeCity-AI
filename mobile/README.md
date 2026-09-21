# SafeCity Camera — Mobile App

React Native + Expo + TypeScript app that turns a phone into a simulated CCTV
camera for the SafeCity AI prototype. Designed so a real RTSP/CCTV camera can
later post to the same backend endpoint this app uses — no backend changes
required.

## Setup

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or run on an emulator. Grant camera
and location permissions when prompted.

## Connecting to the backend

The app defaults to `http://localhost:4000`, which only resolves on an
Android emulator, not a physical phone. On a real device:

1. Find your computer's LAN IP (e.g. `192.168.1.20`) — same Wi-Fi network as
   the phone, backend running on it.
2. Open the app → tap the ⚙ settings icon on the camera screen.
3. Set **Backend URL** to `http://<your-ip>:4000`, tap **Test Connection**,
   then **Save Settings**.

Camera ID, name, location, coordinates, and detection interval are also
editable here and persist across app restarts (AsyncStorage).

## Main screen

- Live camera preview styled as a professional CCTV interface
- Camera ID, location, status, connection status, AI monitoring status, and
  clock overlay
- **Start Monitoring** — begins capturing a frame roughly every
  `detectionIntervalMs` (default 1000ms) and posting it to
  `POST /api/cameras/:id/frame` along with camera ID, timestamp, GPS
  coordinates, location, and a frame ID
- **Stop Monitoring** — stops the capture loop
- Status indicators for Connected / Connection Lost (with automatic retry on
  the next capture cycle), frame sending, and AI monitoring active

## Danger Map (for everyday users)

The second tab, **Danger Map**, is aimed at people who just want to know
which areas to be careful in:

- **Heatmap** — density of incidents, weighted by severity (one red hue,
  light → dark = lower → higher risk), on an OpenStreetMap base map. It is a
  Leaflet page inside a WebView, so it needs no Google Maps API key and works
  in the installed APK.
- **Numbered zone markers** — tap one for its name and incident count.
- **Nearby warning** — if location is allowed, a banner tells you the nearest
  danger zone within 2 km ("Mohammadpur is 600 m from you — high risk…").
- **Danger Board** — zones ranked by volume with incident types, how recent,
  distance from you, and a risk chip. Tap a row to fly the map to it; pull down
  to refresh. 7 / 30 / 90-day chips change the window.
- **Filters** — narrow the map and board by incident type (fight / accident /
  fire / fall, multi-select) and by time of day (morning 5–12, afternoon 12–5,
  evening 5–10, night 10–5, Dhaka time).
- **Time-of-day insight** — a 24-hour chart and a plain sentence such as
  "Higher risk 6–10 PM · 70% of verified incidents". It is only stated when
  there are at least 5 verified incidents *and* the busiest 4-hour stretch holds
  clearly more than an even spread would; otherwise the app says there isn't
  enough data or no clear pattern rather than inventing one. A red "Higher-risk
  time now" pill appears while it is currently inside that window.
- **Safer route hint** — tap **🧭 Safer route**, tap your destination on the map,
  and the app checks whether a direct path passes near danger zones. If so it
  proposes a detour (up to 3 waypoints) and opens it in Google Maps for
  turn-by-turn directions (walk or drive). It is computed on the phone from the
  zones already downloaded, so your destination is never sent to our server and
  no routing service or API key is needed. It is a *hint*: it uses the straight
  line between you and the destination, real roads differ, and when no detour
  helps it says so. It respects the active filters (e.g. "Evening").

**Only operator-verified incidents appear.** Unreviewed AI detections and
false alarms never reach this screen — the public endpoint
(`GET /api/public/danger-zones`) filters them out and also omits camera IDs,
incident IDs, and evidence frames. So the map is empty until an operator
clicks **Confirm Incident** in the dashboard. Requires internet (map tiles and
Leaflet load from CDNs).

## Default demo camera

Camera ID `CAM-124`, name "Camera 124", location "Mohammadpur, Dhaka" — matches
the seeded backend camera used in the main demo script.

## Building a real, installable APK (not just Expo Go)

Running via `npx expo start` + Expo Go is a live dev preview — it needs
Metro running on your PC the whole time. To get an actual app icon on your
phone's home screen that runs standalone, build it with **EAS Build**
(Expo's free cloud build service — no local Android SDK/Studio required):

```bash
cd mobile
npx eas-cli login          # create a free account at expo.dev if you don't have one
npx eas-cli build --platform android --profile preview
```

The first run will ask to link this project to your Expo account (creates a
free `projectId` in `app.json` under `extra.eas`) — accept the defaults.
The build runs in Expo's cloud (several minutes, queue-dependent); when done
it prints a URL and QR code. Open that URL on your phone (or scan the QR)
and tap through to install the APK directly — no Play Store needed.

Notes:
- `preview` profile (`eas.json`) builds a plain installable `.apk`. The
  `production` profile builds an `.aab` (Play Store submission format) and
  auto-increments the version — use that only if actually publishing.
- The app still needs your backend reachable at whatever **Backend URL** you
  set in its Settings screen — that doesn't change with a standalone build.
- If you change `app.json`'s `android.package`, icon, or permissions later,
  just re-run the build command — no other setup needed.
- **Plain `http://` backends:** Android 9+ blocks cleartext HTTP in release
  builds unless the app opts in. `app.json` enables it
  (`expo-build-properties` → `usesCleartextTraffic: true`) so the APK can talk
  to a LAN backend like `http://192.168.x.x:4000`. That is a prototype
  convenience — for a real deployment serve the backend over HTTPS and remove
  it.
