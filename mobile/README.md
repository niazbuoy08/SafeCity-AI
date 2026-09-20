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

## Demo Mode

A clearly separated, red-accented **Demo Scenario** panel provides:

- Simulate Fight
- Simulate Accident
- Simulate Fire
- Simulate Person Fall

These call `POST /api/cameras/:id/simulate`, which goes through the real
backend → AI service → incident-grouping → Socket.IO pipeline — the *only*
thing that's simulated is the detection result itself, guaranteeing the full
demo works even if the live camera doesn't happen to catch a real event at
presentation time.

## Default demo camera

Camera ID `CAM-124`, name "Camera 124", location "Mohammadpur, Dhaka" — matches
the seeded backend camera used in the main demo script.
