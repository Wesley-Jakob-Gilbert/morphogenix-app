# MorphoGenix firmware sketches

Arduino sketches for the Seeed Studio XIAO nRF52840.

## phase2_palate_1ch

Single FSR (palate_L) on A0, streamed at 10 Hz over the Nordic UART Service
(`6e400001-…`). One ASCII line per sample:

```
<millisSinceBoot>,<adc12bitValue>\n
```

The web bench build at `morphogenix-app.fly.dev/demo?live=ble` parses this
format directly via `src/services/streamer/BleStreamer.js`.

### Build

Arduino IDE 2.x with the Seeed nRF52 boards package installed. Select
`XIAO nRF52840` (NOT the Sense variant unless that's what you have) and
upload over USB.

### Verify

1. Open the Serial Monitor at 115200 baud — you should see `<ms>,<adc>` lines
   tick by every 100 ms.
2. Open the bench URL in Chrome on a Bluetooth-capable machine, append
   `?live=ble`, and tap **Connect device** on the Home screen.
3. Squeeze the FSR — the Palatal Pressure tile should track in real time and
   the small `raw: <value>` callout in the Connect card should update.
