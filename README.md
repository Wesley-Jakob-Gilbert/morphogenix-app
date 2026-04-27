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

## MVP status

Completed through Phase D:

- Foundation: Expo app, bottom tabs, theme constants, stub tabs
- Data: morphoday utilities, streamer contract, DemoStreamer, BLE stub, settings store, hooks
- Palate hero: 16-zone SVG palate heatmap, live pulse, tappable color-scale legend
- Home: header, demo pill, wear-time caption, 2x2 metric grid, pull-to-refresh

Demo Mode is on by default and replays `assets/demo-stream.json` at 10 Hz.
