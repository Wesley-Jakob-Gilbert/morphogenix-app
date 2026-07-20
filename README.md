# MorphoGenix App MVP

React Native + Expo companion app for MorphoGenix, built in JavaScript only.

## Run

```bash
npm install
npm start
```

Then open in Expo Go or run:

```bash
npm run ios
npm run android
```

## Development

Expo Go runs the app in **demo mode** (replayed data). Real BLE streaming from
the XIAO nRF52840 needs a **native dev client** because `react-native-ble-plx`
is a native module:

```bash
npm install --legacy-peer-deps
npx expo start --dev-client
```

Building and installing that dev client on a device, plus TestFlight, is
documented step-by-step in **[docs/DEV_BUILD.md](docs/DEV_BUILD.md)**
(`eas login` → `eas init` → `eas device:create` →
`eas build --profile development --platform ios`).

- Bundle identifier: `ai.morphogenix.app`
- iOS deployment target: 15.1
- BLE device name: `MorphoGenixSOD` (Nordic UART Service)
- The streamer auto-selects a transport per platform: native (ble-plx) on
  iOS/Android, Web Bluetooth on the web bench build, and a synthetic mock in
  the simulator/tests.

## MVP status

Completed through Phase D:

- Foundation: Expo app, bottom tabs, theme constants, stub tabs
- Data: morphoday utilities, streamer contract, DemoStreamer, BLE stub, settings store, hooks
- Palate hero: 16-zone SVG palate heatmap, live pulse, tappable color-scale legend
- Home: header, demo pill, wear-time caption, 2x2 metric grid, pull-to-refresh

Demo Mode is on by default and replays `assets/demo-stream.json` at 10 Hz.
