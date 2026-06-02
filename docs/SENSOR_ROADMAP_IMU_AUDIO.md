# Sensor Roadmap: Head Position + Snore Audio

**Status:** Design doc, no code yet. Drafted June 2, 2026, against the `feature/four-fsr-calibrated` branch.
**Hardware:** Seeed Studio XIAO nRF52840 **Sense** (the "Sense" variant — has IMU + mic; the non-Sense variant does not).

This doc covers two future signal channels we want to layer on top of the existing 4 FSRs without re-architecting the BLE protocol or the app's streamer interface.

---

## 1. Head Position Tracking (Accelerometer + Gyro)

### What the hardware gives us

The XIAO nRF52840 Sense ships with the **LSM6DS3TR-C**, a 6-axis IMU (3-axis accelerometer + 3-axis gyroscope) on the same I²C bus, accessible from Arduino via the [`Seeed_Arduino_LSM6DS3`](https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3) library. ([Seeed Wiki — IMU Usage](https://wiki.seeedstudio.com/XIAO-BLE-Sense-IMU-Usage/))

### What "head position" actually means for MorphoGenix

Since the device is **intraoral**, it physically moves with the user's skull. So accelerometer + gyro fused over time give us:

| Signal | Use case | Notes |
|---|---|---|
| **Pitch** (nodding) | Posture during day; head-down detection while sleeping | Reliable from accel alone when stationary |
| **Roll** (head tilt to shoulder) | Sleep position (left side / right side / supine) | Reliable from accel alone when stationary |
| **Yaw** (head turn) | Less useful — accelerometer can't measure absolute yaw (no magnetometer on this chip) | Drifts with gyro integration; capture only short-term relative yaw |
| **Activity / motion** | Sleep vs wake classification, restless-sleep detection | Magnitude of `\|accel - gravity\|` over rolling window |
| **Falls / sudden head movement** | Future safety feature | Easy threshold on accel magnitude |

The **biggest near-term win** is **sleep position classification** (supine vs side-lying), because:
- Supine sleeping correlates strongly with snoring and OSA severity — that's a real clinical signal customers will care about.
- It's robust from accel alone, no gyro integration drift, no magnetometer needed.
- It's a discrete classifier (3-4 classes), not a continuous trace, so it fits in 1 byte per minute over BLE.

### Recommended sensor fusion

For pitch + roll only (which is what we need): **stick with the complementary filter** — 0.083° MAE on pitch, basically free CPU. ([as-proceeding 2024 IMU filter comparison](https://as-proceeding.com/index.php/ijanser/article/download/2028/1969/3823))

For full 3D orientation (later, if we ever want it): switch to **Madgwick** — better accuracy in dynamic conditions, 0.283° MAE pitch / 0.250° MAE roll, ~2ms per update on a Cortex-M4. Cost: ~13.6 KB RAM. The XIAO has 256 KB RAM, so this is comfortable.

For the MVP, I'd start with raw pitch + roll from accelerometer math (`atan2`), boxcar-averaged over 5 samples, and only invest in Madgwick when we have a use case that needs yaw.

### Firmware integration

Extend the existing ASCII CSV with a single optional `imu` segment, gated by a compile-time flag so the 4-FSR-only build stays small:

```
<millis>,<m_l>,<m_r>,<p_l>,<p_r>,IMU,<pitch_deg>,<roll_deg>,<accel_mag>\n
```

- `pitch_deg` and `roll_deg` are int8 (-90..+90), fits in 4 chars each.
- `accel_mag` is the magnitude of (a - g) in milli-g, uint16. Useful for motion / restlessness, and free to compute.
- 10 Hz output → ~24 bytes/packet → 240 bytes/sec. Nordic UART easily handles this; the BLE 5.0 1M PHY tops out at ~508 kbps real-world ([Novel Bits BLE throughput math](https://novelbits.io/bluetooth-5-speed-maximum-throughput/)). We're using ~0.05% of capacity.

If the line gets too long, **split into two BLE notifications per cycle**: one FSR line, one IMU line. Both `\n`-terminated, app parses by prefix (`IMU,...` vs no prefix → FSR). The line buffer in `BleStreamer.js` already handles split lines.

### App-side integration

1. **Extend `BleStreamer.emitPacketFromLine()`** to detect `IMU,...` lines and emit packets with a `head` field:
   ```js
   packet.head = { pitchDeg, rollDeg, accelMilliG, t: now };
   ```
2. **Add a `HeadPosition` derived field** to the packet for downstream consumers:
   ```js
   packet.headPosition = classifyPosition(pitchDeg, rollDeg);
   // returns one of: 'upright' | 'supine' | 'left-side' | 'right-side' | 'prone'
   ```
3. **Add a small Posture/Position tile** to the Home screen showing the live classification + a tiny pitch/roll dial widget. Same SVG primitives we're already using for the palate hero.
4. **Sleep-position History tab**: bar chart of % time in each position per night. Trivial to compute from the existing morphoday aggregation pipeline.

### Calibration

The user's "neutral upright" is not necessarily IMU zero. Add a Settings action **"Calibrate upright"** that captures 2 seconds of accel readings and stores the offset in firmware NVRAM (the existing `'z'` baseline pattern from the FSR firmware, generalized).

### Effort estimate

| Task | Where | Effort |
|---|---|---|
| Firmware: read LSM6DS3, compute pitch/roll, append to ASCII line | `firmware/phase3_palate_4ch_imu/` (new sketch) | 1-2 days |
| App: parse new field, classify position | `BleStreamer.js`, new `src/utils/headPosition.js` | 0.5 day |
| App: Posture tile + history chart | new component, extend HistoryScreen | 1 day |
| Calibration UI + firmware command | Settings screen + firmware command parser | 0.5 day |
| **Total** | | **3-4 days** |

---

## 2. Snore Detection (PDM Microphone)

### What the hardware gives us

The XIAO nRF52840 Sense has an on-board **PDM (pulse-density-modulation) digital MEMS microphone**. ([Seeed Wiki — PDM Usage](https://wiki.seeedstudio.com/XIAO-BLE-Sense-PDM-Usage/))

- Sample rate: 16 kHz mono, 16-bit (Arduino default in the [Seeed_Arduino_Mic](https://github.com/Seeed-Studio/Seeed_Arduino_Mic) library)
- Bandwidth: 32 KB/sec raw — **way too much to stream over BLE**. NUS at 10 Hz only sends ~200 bytes/sec.
- This means **all audio analysis must happen on the XIAO**, and we ship only summaries over BLE.

### What's a "snore"?

Acoustically:
- Low-frequency dominant energy (50–500 Hz fundamental)
- Periodic / quasi-rhythmic (0.2–0.5 Hz envelope — one snore per inhale-exhale cycle, ~12-30 snores/min)
- Sustained > 0.5s per event
- Usually > 50 dB SPL at close range (the mouthpiece is ideal microphone placement — inside the head)

So a snore detector can be either:

**Option A — Threshold-based (cheap, ~1 KB code):**
1. Compute short-term RMS energy (50 ms windows)
2. Compute spectral centroid (FFT or zero-crossing rate)
3. Snore = `(RMS > threshold) AND (centroid < 500 Hz) AND (duration > 500 ms)`
4. Report event count + total seconds snoring per minute

**Option B — TinyML model (better, ~30 KB code + model):**
1. Capture 1-second audio windows at 16 kHz
2. Extract MFCC features (~13 coefficients × ~50 frames)
3. Run through a tiny CNN trained on snore / breath / silence / speech / cough
4. Emit per-window confidence scores
5. Reference: [Snoring Detection on Embedded Devices (Harvard TinyML)](https://discuss.tinyml.seas.harvard.edu/t/snoring-detection-on-embedded-devices/295), [Edge Impulse Environmental Audio](https://docs.edgeimpulse.com/projects/expert-network/environmental-audio-monitoring-wearable-syntiant-tinyml-part-1)

For the MVP, **start with Option A**. We can collect labeled audio (Wes sleeps with the device, audio dumps to flash, hand-label) and graduate to Option B once we have data.

### What gets sent over BLE

Per-minute summary, appended to the existing CSV stream as another prefixed line every ~60 seconds:

```
<millis>,AUDIO,<snore_events>,<snore_seconds>,<peak_db>,<noise_floor_db>\n
```

That's ~30 bytes/min → 0.5 bytes/sec average. Nothing.

### Privacy

**Critical:** the raw audio buffer NEVER leaves the device. The PDM library reads into a 256-sample short[] buffer ([Seeed_Arduino_Mic example](https://forum.seeedstudio.com/t/pdm-microphone-not-working-on-nrf52840-sense/281493)) — we process it in place and overwrite it. Only the aggregate metrics (event count, seconds, dB) get transmitted. This is the right default for a sleep-monitoring product and lines up with HIPAA-adjacent concerns we'd hit in the medical-device path.

We may eventually want **opt-in audio dumps to flash** for training-data collection — gated behind an explicit Settings toggle ("Save audio for training") with a clear consent prompt and a visible indicator when active.

### App-side integration

1. **BleStreamer parses `AUDIO,...` lines** and emits `packet.audio = { snoreEvents, snoreSeconds, peakDb, noiseFloorDb }`
2. **New nightly metric: Snore Index** = `(snoreEvents per hour of sleep) × (avg duration)`. Bucket into None / Mild / Moderate / Severe per [AASM thresholds](https://aasm.org).
3. **History screen**: snore minutes per night bar chart; correlate with posture data ("on your back you snored 3.2× more than on your side").
4. **Insights tab** (future): "You snored 18 min last night, mostly between 2-4 AM, mostly while supine."

### Effort estimate

| Task | Where | Effort |
|---|---|---|
| Firmware: PDM init + 50ms RMS + simple threshold detector | `firmware/phase4_palate_4ch_audio/` | 2-3 days |
| Firmware: per-minute aggregation + BLE emit | same sketch | 0.5 day |
| App: parse + display Snore Index tile | `BleStreamer.js`, Home + History | 1 day |
| Posture × snore correlation insight | derived analytics | 1 day |
| **TinyML upgrade (Option B), if/when needed** | Edge Impulse studio + sketch | +1 week |
| **Total MVP (Option A)** | | **4-5 days** |

---

## 3. Combined firmware sketch (eventual target)

Once both work, the unified stream looks like this (with `IMU` and `AUDIO` lines interleaved at their own cadences):

```
12345,32,18,42,38                       # FSR @ 10 Hz
12345,IMU,12,-4,1023                    # IMU @ 10 Hz (pitch=12°, roll=-4°, |accel|=1023mG)
12545,28,15,40,36
12545,IMU,12,-5,1015
...
72345,AUDIO,8,4500,62,28                # AUDIO @ 1/min (8 events, 4.5s snoring, 62 dB peak, 28 dB floor)
```

Total bandwidth: ~50 bytes/sec FSR + IMU + ~30 bytes/min audio = ~50 bytes/sec. NUS handles this trivially (we're at <0.1% of BLE capacity).

---

## 4. Implementation order

1. **First:** ship the 4-FSR live demo (in progress, June 2, 2026 — feature/four-fsr-calibrated)
2. **Next:** record a clean MorphoGenix demo video for Billion Dollar Build submission
3. **Then:** add IMU pitch/roll to firmware + app (the biggest user-visible win for the lowest engineering cost)
4. **Then:** add threshold-based snore detection
5. **Later:** TinyML snore upgrade, once Wes has slept with the device 10+ nights and we have labeled data

The IMU work is well-suited to be the **next** branch off `feature/four-fsr-calibrated` once that merges. Name suggestion: `feature/phase3-imu`.

---

## 5. Open questions before implementation

- Does the **molded silicone form factor** leave the PDM microphone port physically exposed enough to capture intelligible audio? The Sense's mic is a tiny side-firing port — if it ends up buried in silicone we get muffled mush. Test with a quick "speak loudly" walk before committing to audio. **Wes — flag this before phase 4.**
- Battery impact of always-on PDM sampling: roughly +5-8 mA. Need to confirm we're still hitting overnight runtime. Mitigation: duty-cycle the mic (e.g. 1 sec on, 1 sec off → 50% power draw, still catches 100% of >2s snore events).
- Do we want the device to **buzz** on detected snore? Cheap haptic motor, drives partner-friendly behavior change. Discussion for product, not engineering.

---

## References

- [Seeed XIAO nRF52840 Sense — IMU Usage](https://wiki.seeedstudio.com/XIAO-BLE-Sense-IMU-Usage/)
- [Seeed XIAO nRF52840 Sense — PDM Microphone Usage](https://wiki.seeedstudio.com/XIAO-BLE-Sense-PDM-Usage/)
- [Performance Evaluation of IMU Filtering Techniques (Madgwick vs Mahony vs Complementary)](https://as-proceeding.com/index.php/ijanser/article/download/2028/1969/3823) — 2024
- [Bluetooth LE Throughput math (Novel Bits)](https://novelbits.io/bluetooth-5-speed-maximum-throughput/)
- [Snoring Detection on Embedded Devices (TinyML community)](https://discuss.tinyml.seas.harvard.edu/t/snoring-detection-on-embedded-devices/295)
- [TinyML Sound Classification on XIAO BLE Sense (Hackster)](https://www.hackster.io/mjrobot/tinyml-made-easy-sound-classification-kws-2fb3ab)
- [End-to-end TinyML audio classification with Arduino Nano BLE (TF blog)](https://blog.tensorflow.org/2021/09/TinyML-Audio-for-everyone.html)
