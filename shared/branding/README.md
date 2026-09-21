# SafeCity AI branding

`logo-mark.svg` is the single source of truth for the logo: a **shield**
(safety) around a **camera lens** (cameras) with a **heart** as the pupil
(care) — "Turning Cameras into Care". It has a transparent background and
works from ~20px up.

Where it is used (keep these in sync with the SVG if the mark changes):

| Where | File |
|---|---|
| Dashboard sidebar + login page | `dashboard/src/components/Logo.tsx` (inline copy of the SVG) |
| Browser tab icon | `dashboard/public/favicon.svg` |
| Android app icon | `mobile/assets/icon.png` (1024×1024, opaque, navy gradient background) |
| Android adaptive icon | `mobile/assets/adaptive-icon.png` (1024×1024, transparent; mark kept inside the ~61% safe zone) — background colour is `#0a1128` in `mobile/app.json` |

The PNGs were rendered from the SVG with headless Chrome
(`--headless=new --window-size=1024,1024 --screenshot=...`, plus
`--default-background-color=00000000` for the transparent one). After
changing the icon, rebuild the APK — the installed app's icon only changes
with a new build.
