# phase3_palate_4ch_imu_binary

Phase 3 firmware for the MorphoGenix intraoral sensor: **4 FSR channels + the
on-board LSM6DS3TR-C accelerometer**, streamed over BLE (Nordic UART) as a
fixed-size **binary v2** packet at 10 Hz.

This sketch is the evolution of `phase2_palate_4ch_calibrated` (ASCII CSV) and
the binary v1 reference. It preserves the same wiring, baseline calibration, and
`z`/`r` command interface, and adds raw accelerometer data for head/sleep
position tracking. It is **IN PROGRESS** — pending real-device validation.

**Hardware:** Seeed Studio XIAO nRF52840 **Sense** (the IMU is only on the Sense
variant). Device advertises as `MorphoGenixSOD`.

---

## Pin map

| Wire index | Logical channel | Anatomical region              | Connection |
|------------|-----------------|--------------------------------|------------|
| `fsr[0]`   | Molar_L         | Left posterior, molar occlusal | A0         |
| `fsr[1]`   | Molar_R         | Right posterior, molar occlusal| A1         |
| `fsr[2]`   | Palate_L        | Left mid hard palate           | A2         |
| `fsr[3]`   | Palate_R        | Right mid hard palate          | A3         |
| `accel[0]` | Accel_X         | IMU X axis (raw int16, ±2g)    | I²C 0x6A   |
| `accel[1]` | Accel_Y         | IMU Y axis (raw int16, ±2g)    | I²C 0x6A   |
| `accel[2]` | Accel_Z         | IMU Z axis (raw int16, ±2g)    | I²C 0x6A   |

FSR wiring (per channel ×4): FSR top → 3V3, FSR bottom → A{n} + 10k pulldown to
GND. Each channel needs its own 10k pulldown (no sharing — crosstalk). The IMU is
on-board; no external wiring.

> If you reorder physical wiring, update **both** the CHANNEL MAP comment in this
> sketch **and** `CHANNEL_MAP` in `src/services/streamer/BleStreamer.js` in the
> same commit.

---

## Binary packet format v2 (little-endian, byte-packed)

```
 Offset  Size  Field         Value / Meaning
 ------  ----  -----------   ---------------------------------------
 0       1     magic         0xA7   (same as v1)
 1       1     version       0x02   (NEW — bumped from v1's 0x01)
 2       4     timestamp_ms  uint32 LE, millis() since boot
 6       1     sensor_count  uint8, 7 (4 FSR + 3 accel)
 7       8     fsr_values    4 × uint16 LE, 0..4095 baseline-subtracted
 15      6     accel_values  3 × int16 LE, raw ±2g full-scale
 21      1     checksum      XOR of all preceding bytes
 ----------------------------------------------------------------
 total = 1 + 1 + 4 + 1 + 8 + 6 + 1 = 22 bytes
```

```
 byte:  0    1    2  3  4  5    6    7  8   9 10  11 12  13 14   15 16  17 18  19 20   21
        A7   02  [ ts u32  ]   07  [fsr0][fsr1][fsr2][fsr3]    [ ax ][ ay ][ az ]    XOR
```

- **FSR block is byte-identical to v1's adc block** — only the version byte and
  the appended accel block differ.
- **Accel** is signed int16; convert to g with `raw * 2 / 32768` (±2g full
  scale). `+16384 ≈ +1g`.
- **22 bytes** exceeds the 20-byte payload of a 23-byte default ATT MTU, so the
  central must negotiate a larger MTU (Web Bluetooth / Android default to 247 —
  the common case). A `static_assert(PKT_SIZE <= 23, ...)` documents the ceiling.
  The app-side reassembler accumulates across notifications, so two-notification
  framing is a firmware-only change if ever needed.

### Why version bump (v1 → v2)?

The magic stays `0xA7`; the version moves `0x01 → 0x02`. An old v1-only parser
sees version=2, rejects the frame, and resyncs — it will **not** silently misread
accel bytes as extra FSR channels. `BleStreamer.js` handles both v1 and v2.

### Why ±2g / 26 Hz?

Sleep-position sensing is a low-G, quasi-static problem: the only meaningful
force on a still head is 1g of gravity tilted by skull orientation. ±2g gives the
finest resolution per LSB (~0.061 mg) of any LSM6DS3 range, maximizing the
angular precision of the `atan2` pitch/roll math. 26 Hz is the lowest normal-mode
ODR that comfortably exceeds the 10 Hz packet cadence, minimizing IMU power.

### IMU register choice

LSM6DS3TR-C at I²C address `0x6A` (SA0 low on the Seeed module). Accel output
registers start at `OUTX_L_XL = 0x28` (X_L, X_H, Y_L, Y_H, Z_L, Z_H — LE int16
per axis). `CTRL1_XL = 0x10` is configured to `0x30` (ODR 26 Hz, FS ±2g).

**Library vs fallback.** The preferred path uses the `Seeed_Arduino_LSM6DS3`
library (the same one the XIAO Sense IMU examples use). If that library header is
not present at compile time, the sketch **falls back to direct raw I²C reads via
`Wire.h`** against register `0x28` (clearly fenced with `#else`). Define
`USE_LSM6DS3_LIB` to force the library path; comment it out to force the fallback.

---

## Commands (write a single ASCII char to the NUS RX characteristic)

| Cmd | Action |
|-----|--------|
| `z` | Re-zero FSR baselines using the next 2 seconds of input. Replies `ZEROED\n`. |
| `r` | Report current FSR baselines as `BASELINE,b0,b1,b2,b3\n`. |
| `i` | **NEW** — one-shot IMU diagnostic. Prints raw `ax/ay/az` + computed pitch/roll (deg) to USB Serial. Bench-only; no BLE reply. |

The `i` command's pitch/roll math mirrors `src/services/headPosition.js`, so the
serial-monitor numbers match what the app classifies on.

---

## How to flash

1. Install the **Seeed nRF52 Boards** package and (optionally) the
   **Seeed_Arduino_LSM6DS3** library via the Arduino Library Manager. If the
   library is absent, the sketch still compiles via the direct-I²C fallback.
2. Open `phase3_palate_4ch_imu_binary.ino` in the Arduino IDE.
3. Select board: **Seeed XIAO nRF52840 Sense**.
4. Connect the XIAO over USB-C, select the port, and click **Upload**.
5. On boot, the device captures FSR baselines for 2 seconds — keep it still /
   mouth relaxed.

## How to verify

1. Open the Arduino **Serial Monitor** at **115200 baud**.
2. Confirm the boot banner reports the packet size (`22 bytes`), the IMU path
   (`library` or `direct I2C fallback`), and `IMU init: OK (+/-2g, 26 Hz)`.
3. You should see 10 Hz CSV-style debug lines:
   `<millis>,<fsr0>,<fsr1>,<fsr2>,<fsr3>,IMU,<ax>,<ay>,<az>`.
4. Send `i` (from the Serial Monitor's send box, no newline needed) to get a
   one-shot IMU diagnostic with raw accel + pitch/roll. Tilt the board and
   confirm the angles move sensibly.
5. In the app (web bench, `?live=video`), connect to `MorphoGenixSOD`. The BLE
   debug console should log `first packet OK (binary v2)  accel=(x,y,z)g`, and
   the **Head Position** card should populate as you hold orientations ≥5s.
