# MorphoGenix

**Intraoral biometric wearable + companion app for palatal pressure and head-position sensing.**

MorphoGenix pairs a custom intraoral sensor with a React Native app that visualizes tongue/palatal pressure and head orientation in real time. This repository holds the mobile app and the device firmware.

<!-- add gif at ./docs/demo.gif -->

![Expo SDK 54](https://img.shields.io/badge/Expo%20SDK-54-000020)
![React Native 0.81](https://img.shields.io/badge/React%20Native-0.81-61DAFB)
![Language](https://img.shields.io/badge/JavaScript-ES2022-f7df1e)
![Tests](https://img.shields.io/badge/tests-136%20passing-2ea44f)
![TestFlight](https://img.shields.io/badge/TestFlight-coming%20soon-8A6CFF)

---

## What it is

MorphoGenix is an intraoral biometric wearable and its companion app. The device is a custom-fit upper-arch appliance carrying a sealed force-sensitive-resistor (FSR) array across the palate and molars, plus an on-board 6-axis IMU for head/sleep-position tracking. Sensor data streams over Bluetooth Low Energy (Nordic UART Service) to the app, which renders a live palatal-pressure heatmap, a 0–100 posture score, clench-event detection, and session history. The near-term research focus is bone-remodeling, sleep-posture, and bruxism data collection.

## Screenshots

<img src="./docs/screenshots/home.png" width="240" alt="Home" />
<img src="./docs/screenshots/analytics.png" width="240" alt="Analytics" />
<img src="./docs/screenshots/history.png" width="240" alt="History" />

## Architecture

The firmware samples four FSR channels and the IMU, packs them into a fixed-size 22-byte binary frame, and notifies the app at 10 Hz over the Nordic UART Service. A transport-agnostic protocol module parses and shapes each frame identically across platforms; a thin transport adapter handles the actual BLE link. Session state and settings persist locally on device.

```
┌──────────────────────────────┐      ┌──────────────────────────┐      ┌──────────────┐
│  Firmware                     │      │  Companion App           │      │  Cloud       │
│  Seeed XIAO nRF52840 Sense    │ BLE  │  React Native + Expo     │      │  (future)    │
│  4× FSR + LSM6DS3TR-C IMU     │─────▶│  binary-protocol parser  │─────▶│  sync /      │
│  22-byte binary frame @ 10 Hz │ NUS  │  local persistence       │local │  export      │
└──────────────────────────────┘      └──────────────────────────┘      └──────────────┘
```

## Tech stack

**Mobile**
- React Native `0.81` on Expo SDK `54` (`expo-router`)
- `react-native-reanimated` 4 + `react-native-worklets` (arc fills, count-up, chart draw-on)
- `@shopify/react-native-skia` and `react-native-svg` for custom visuals
- `victory-native` for charts
- `expo-haptics` for tactile feedback
- `zustand` state, persisted via `@react-native-async-storage/async-storage`
- `expo-sqlite` (dependency present; session persistence in progress)
- `@expo-google-fonts/inter` for the Inter type system

**BLE transport**
- Web Bluetooth adapter for the desktop/Android bench build (current)
- Native adapter via `react-native-ble-plx` for the iOS/Android dev client (planned; shares the same parser)

**Firmware**
- C++ (Arduino IDE) on the Seeed XIAO nRF52840 **Sense**
- LSM6DS3TR-C 6-axis IMU over I²C at address `0x6A`, ±2 g / 26 Hz
- 4× FSR on ADC pins A0–A3, per-channel 10k pulldowns, baseline calibration
- Nordic UART Service (Bluefruit `BLEUart`), custom 22-byte binary v2 protocol at 10 Hz

**Backend / infra**
- No app backend yet; the marketing site + waitlist runs on Fly.io ([landing repo](https://github.com/Wesley-Jakob-Gilbert/MorphoGenix-Landing-Page))
- EAS for builds, GitHub Actions for CI, Notion for project docs

## Getting started

Requires Node 18+ and the EAS CLI. The app uses native modules, so a development build (not Expo Go) is needed for full BLE functionality.

```bash
# Install dependencies
npm install --legacy-peer-deps

# Authenticate with Expo
eas login

# Create a development build
eas build --profile development
```

Install the resulting build on a device via the QR code EAS provides, then start the dev server:

```bash
npm start
```

Demo mode is on by default and replays a captured 10 Hz stream, so the UI is fully explorable without hardware.

## Testing

```bash
npm test
```

The suite currently runs **136 tests across 10 suites** (Jest + `jest-expo`), covering the binary protocol parser, head-position math, metric-state color logic, morphoday utilities, haptics, and key components.

## Repository layout

```
morphogenix-app/
├── src/
│   ├── components/      Reusable UI (ScoreRing, cards, palate heatmap)
│   ├── screens/         Home, Analytics, History, Account
│   ├── services/        streamer/ (binary protocol, BLE adapters), headPosition
│   ├── store/           zustand stores (settings)
│   ├── theme/           colors, typography, spacing, metric-state palette
│   ├── hooks/  data/  navigation/  utils/
├── firmware/            Arduino sketches (phase2 → phase3 binary + IMU)
├── hardware/            CAD, scans, print, and reference assets
├── docs/                Roadmaps, UI notes, resume bullets
├── assets/              Icons, splash, demo stream
└── e2e/                 End-to-end scaffolding
```

## Design system

The app uses an Oura / Apple Watch-inspired dark theme with a locked palette and the Inter type family. Metric colors are stateful — teal for optimal, amber for attention, with a state-only red reserved for genuine alerts and a subtle gold reserved for premium affordances. Motion (arc fills, count-up numbers, chart draw-on) respects the system reduce-motion setting and snaps to final state when it is enabled.

| Role | Token | Value |
|---|---|---|
| Background | navy | `#0B1220` |
| Optimal | teal | `#29E0C8` |
| Attention | amber | `#F5B343` |
| Accent | violet | `#8A6CFF` |
| Alert (state only) | red | `#FF6B6B` |
| Premium (accent only) | gold | `#E5C572` |

## Roadmap

| Now | Next | Later |
|---|---|---|
| TestFlight prep | App Store v1.0 | HealthKit integration |
| Native BLE dev client | Session detail views | Cloud sync |
| On-device persistence | Subscription tier | Multi-device support |

## Contributing

This is a solo project. Feedback and bug reports are welcome via GitHub issues.

## License

Proprietary — All Rights Reserved. (License not yet finalized; see Contact.)

## Contact

Wes Gilbert · [wes@morphogenix.ai](mailto:wes@morphogenix.ai) · [morphogenix.ai](https://morphogenix.ai)
