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

## Testing locally

### Local browser QA

Build the standalone web bundle without the `/demo` base URL, then serve it from the repository root:

```bash
npm run build:web
npx serve dist
```

Open http://localhost:3000 to test the app in a browser.

### Native iPhone testing

Start Expo and scan the QR code with Expo Go on iPhone:

```bash
npx expo start
```

The app is pinned to Expo SDK 55 so it remains compatible with the current iOS Expo Go client.

### Landing-page web bundle

Build the production web bundle with the `/demo` base URL before copying it into the landing page:

```bash
npm run build:web:prod
```

The production output is written to `dist-prod/` and is intended for `MorphoGenix-Landing-Page/app/static/demo/`.

## MVP status

Completed through Phase D:

- Foundation: Expo app, bottom tabs, theme constants, stub tabs
- Data: morphoday utilities, streamer contract, DemoStreamer, BLE stub, settings store, hooks
- Palate hero: 16-zone SVG palate heatmap, live pulse, tappable color-scale legend
- Home: header, demo pill, wear-time caption, 2x2 metric grid, pull-to-refresh

Demo Mode is on by default and replays `assets/demo-stream.json` at 10 Hz.
