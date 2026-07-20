# MorphoGenix — Native Dev Build (real BLE) Guide

This guide takes you from a clean checkout to a **native development build**
running on your iPhone, streaming real data from the XIAO nRF52840 Sense over
`react-native-ble-plx`.

Everything here runs from **your own machine** (Wes). The migration work is
committed; the actual EAS builds and TestFlight submissions are yours to run —
CI/agents do **not** run `eas build` or `eas submit`.

---

## Why a dev build (and not Expo Go)

Expo Go cannot load custom native modules. Real BLE needs `react-native-ble-plx`,
which is a native module, so we build a **custom dev client**. Once installed,
you iterate with normal fast-refresh over Wi‑Fi — you only rebuild when native
deps or native config change.

- **iOS deployment target:** 15.1
- **Bundle identifier:** `ai.morphogenix.app` (locked)
- **Version / build:** `0.1.0` / `1`
- **BLE device name (from firmware):** `MorphoGenixSOD`
- **Service:** Nordic UART Service `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`

---

## Prerequisites

- Node + this repo installed: `npm install --legacy-peer-deps`
- An [Expo account](https://expo.dev) (free)
- Apple Developer Program membership (for a device build + TestFlight)
- EAS CLI:

  ```bash
  npm install -g eas-cli
  eas --version   # needs >= 12 (see eas.json cli.version)
  ```

---

## 1. Log in and initialize the EAS project

```bash
eas login
# From the repo root:
eas init
```

`eas init` links this local project to an EAS project on your account and writes
the `extra.eas.projectId` into `app.json`. Commit that change. (The `slug` stays
`morphogenix-app`.)

---

## 2. Register your iPhone

A development build (`distribution: internal`) is signed for **specific
devices**. Register your iPhone's UDID once:

```bash
eas device:create
```

Pick "Register a new device" and follow the prompts — the easiest path is the
QR-code / profile install on the phone itself. Confirm it landed:

```bash
eas device:list
```

You must re-run `eas device:create` for any new phone before it can install a
development or preview build.

---

## 3. Build the dev client for iOS

```bash
eas build --profile development --platform ios
```

- On the first run EAS will offer to **create iOS credentials** (distribution
  cert + provisioning profile) — let it manage these for you.
- The `development` profile (see `eas.json`) sets `developmentClient: true`,
  `distribution: internal`, and `ios.simulator: false` (a real-device build).
- When it finishes, EAS prints a build page URL with an **install QR code**.

---

## 4. Install the dev build on your iPhone

- Open the build page URL (or `eas build:list` → latest) on the phone.
- Tap **Install**; iOS installs the MorphoGenix dev client.
- First launch: **Settings → General → VPN & Device Management** → trust the
  developer profile if prompted.

---

## 5. Iterate with fast refresh

Start the dev server and open it from the installed dev client:

```bash
npx expo start --dev-client
```

- Scan the QR with the phone's camera, or pick the running bundler inside the
  dev client's launcher.
- Edit JS → save → the app hot-reloads. **No rebuild needed** for JS changes.
- Rebuild (`eas build`) only when you change native deps or native config
  (`app.json` plugins, `Info.plist`, deployment target, etc.).

### Connecting to the device

1. Power on the XIAO (it advertises as **MorphoGenixSOD**).
2. On the Home screen tap **Connect device**.
3. Grant the Bluetooth prompt on first connect.
4. On success you'll see the device name, a live raw readout, and **Rezero** /
   **IMU diag** buttons (which send `z` / `i` over the NUS RX characteristic).

If you see:
- **"No device found"** — the 15s scan timed out; check the device is on/nearby.
- **"Turn on Bluetooth"** — the radio is off.
- **"Bluetooth permission required"** — tap **Open Settings** and enable it.

---

## 6. Preview build → TestFlight

When you want a shareable internal build:

```bash
eas build --profile preview --platform ios
```

Then submit it to TestFlight (this creates/uses your App Store Connect app —
do that step manually in App Store Connect first if it doesn't exist yet):

```bash
eas submit --profile production --platform ios --latest
```

> Note: `eas.json` defines a `production` submit profile. `eas submit` uploads
> the binary to App Store Connect / TestFlight; you still manage tester groups
> and export-compliance answers there. `ITSAppUsesNonExemptEncryption` is
> already set to `false` in `app.json` to skip the encryption prompt.

---

## Android (optional)

The same flow works for Android; the config already declares the BLE +
`ACCESS_FINE_LOCATION` permissions:

```bash
eas build --profile development --platform android
```

Install the resulting `.apk` directly on the device (internal distribution).

---

## Troubleshooting

- **`eas build` complains about credentials** — let EAS manage them, or run
  `eas credentials` to inspect.
- **Build fails on the deployment target** — confirm `expo-build-properties`
  is in `app.json` plugins with `ios.deploymentTarget: "15.1"`.
- **App installs but BLE never connects** — verify the firmware is the phase3
  binary v2 sketch and still advertising `MorphoGenixSOD`.
- **Sanity check config** — `npx expo doctor`.
