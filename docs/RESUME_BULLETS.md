# Resume Bullets — MorphoGenix

> **How to use:** Choose the variant that fits your resume format. **Bold the technical keywords** Neuralink is likely to search for in ATS: **iOS**, **React Native**, **Bluetooth**, **BLE**, **Swift-adjacent** (React Native / native modules), **embedded C++**, **real-time**, and **hardware/firmware integration**.

---

## MorphoGenix — Founder & Full-Stack Engineer | 2025 – Present
**Albuquerque, NM (remote)**

- Built a cross-platform **iOS** and Android companion app in **React Native** (Expo SDK 54, React Native 0.81) for an intraoral biometric wearable, architected for a native dev client and **TestFlight** distribution via EAS.
- Engineered a **real-time** sensor pipeline that parses a custom 22-byte binary protocol streamed over **Bluetooth Low Energy (BLE)** at **10 Hz**, isolating parsing into a transport-agnostic module shared across web (Web Bluetooth) and native (`react-native-ble-plx`) adapters.
- Implemented on-device data persistence and settings using SQLite (`expo-sqlite`) and an AsyncStorage-backed state layer (Zustand), so session history and preferences survive app restarts offline.
- Designed a custom dark-theme design system (Inter typography, locked palette, stateful metric colors) that mirrors Apple HIG affordances and respects the system **reduce-motion** accessibility setting.
- Built fluid data visualizations with **Reanimated 4** and Skia — animated arc-fill score rings, count-up numerics, and draw-on charts — with a graceful non-animated fallback for reduced-motion users.
- Wrote and maintained a **136-test** Jest suite (10 suites) covering the binary protocol parser, head-position math, metric-state logic, and UI components, run locally and gated in CI.
- Developed the device **firmware** in **embedded C++** (Arduino IDE) for the Seeed XIAO nRF52840 Sense, exposing sensor data over the Nordic UART Service with a versioned binary packet format and `z`/`r`/`i` command interface.
- Integrated an LSM6DS3TR-C 6-axis IMU over **I²C** (address `0x6A`, ±2 g / 26 Hz) for head/sleep-position sensing, with a library-or-raw-register fallback path and on-device pitch/roll computation matching the app-side classifier.
- Designed the sensing hardware — a 4-channel FSR array (molar + palate) with per-channel signal conditioning, 3D-printed enclosures, and Ecoflex/Dragon Skin silicone casting from scanned dental masters.
- Owned full-stack delivery: shipped the marketing site + waitlist API (Python/FastAPI on Fly.io) with GitHub Actions CI/CD (lint, security, and secret scanning) and managed private multi-repo development.
- Incorporated the company as a Delaware C Corp (Stripe Atlas), completed D-U-N-S registration, and enrolled the organization in the Apple Developer Program.

---

## Short variant (4 bullets — for a side-project entry)

**MorphoGenix — Founder & Full-Stack Engineer | 2025 – Present** · Albuquerque, NM (remote)

- Built a cross-platform **iOS**/Android app in **React Native** (Expo SDK 54) for an intraoral biometric wearable, with a **136-test** Jest suite and EAS/**TestFlight** build pipeline.
- Engineered a **real-time** **BLE** pipeline parsing a custom 22-byte binary protocol at **10 Hz**, shared across web and native (`react-native-ble-plx`) transports.
- Wrote device **firmware** in **embedded C++** for the Seeed XIAO nRF52840 Sense (Nordic UART Service, 4× FSR + LSM6DS3TR-C IMU over I²C).
- Delivered full-stack: on-device persistence, a custom accessible design system with Reanimated animations, and a FastAPI landing site on Fly.io with GitHub Actions CI/CD.

---

## Very short (1-line summary / LinkedIn headline)

Founder & full-stack engineer building an intraoral biometric wearable — **iOS**/**React Native** app, **real-time** **BLE** streaming, and **embedded C++** firmware end to end.
