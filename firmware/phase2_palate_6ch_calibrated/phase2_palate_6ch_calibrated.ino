// Phase 2: XIAO nRF52840 + 6 FSRs + BLE UART @ 10 Hz, with per-channel
// boot-time baseline calibration and on-demand re-zero from the bench.
//
// Streams six palate FSRs over the Nordic UART Service so the MorphoGenix
// bench (BleStreamer.js) can read all six channels.
//
// Wire format (one ASCII line per sample, terminated with '\n'):
//
//     <millisSinceBoot>,<adc0>,<adc1>,<adc2>,<adc3>,<adc4>,<adc5>\n
//
// where each adcN is a 12-bit ADC reading (0..4095) from An, AFTER
// per-channel baseline subtraction (see CALIBRATION below).
//
// CHANNEL LAYOUT (must mirror the physical FSR placement in the silicone):
//
//     A0  Rugae_L         (front-left rugae area)
//     A1  Rugae_R         (front-right rugae area)
//     A2  MidPalate_L     (mid-left palatal vault)
//     A3  MidPalate_R     (mid-right palatal vault)
//     A4  Posterior_L     (rear-left, near hard-soft palate junction)
//     A5  Posterior_R     (rear-right, near hard-soft palate junction)
//
// If you change the physical layout, update CHANNEL_NAMES below AND the
// matching CHANNEL_MAP in BleStreamer.js so the bench renders the right
// zones for each sensor.
//
// CALIBRATION:
//   On boot, the firmware spends the first 2 seconds sampling each channel
//   to record a per-channel baseline ("zero" point). All transmitted values
//   are deltas above baseline. So when the device is sitting still inside
//   silicone with no tongue pressure, you should see values near 0, not the
//   ~100-ADC silicone-preload reading the first prototype showed.
//
//   The user can also send a single 'z' character over BLE UART (from the
//   bench's debug console) to re-zero the baselines on demand. Useful if
//   the device shifts position mid-session, or if you want to recalibrate
//   after the FSRs warm up to mouth temperature.
//
//   Negative deltas (sensor reads below baseline -- can happen with thermal
//   drift or mechanical relaxation after a long press) are clamped to 0 so
//   the wire format stays unsigned and the bench parser doesn't choke.
//
// HARDWARE WIRING (each of 6 channels, identical):
//
//     3V3 ---- FSR ----+---- An
//                      |
//                    10 kOhm
//                      |
//                     GND
//
//   * All six 3V3 inputs share a single power wire from the XIAO's 3V3 pin.
//   * All six GND returns share a single ground wire back to the XIAO's GND.
//   * Each FSR has its OWN dedicated 10 kOhm pulldown -- do not share.
//
// CHANGES vs. phase2_palate_1ch.ino:
//   * 1 channel -> 6 channels (FSR_PINS[] array, single read loop)
//   * snprintf format string updated to %lu plus six %d tokens
//   * BLE buffer enlarged from 32 to 80 bytes to fit the worst-case payload
//     (10-digit timestamp + six 4-digit ADC values + commas + newline)
//   * Per-channel baseline calibration on boot
//   * BLE UART RX callback wired up to listen for 'z' (re-zero) and 'r'
//     (report current baselines) commands from the bench

#include <bluefruit.h>

const uint8_t CHANNEL_COUNT = 6;
const int FSR_PINS[CHANNEL_COUNT] = { A0, A1, A2, A3, A4, A5 };
const char* CHANNEL_NAMES[CHANNEL_COUNT] = {
  "Rugae_L", "Rugae_R", "MidPalate_L", "MidPalate_R", "Posterior_L", "Posterior_R"
};

const int NUM_SAMPLES = 8;                  // boxcar average per channel
const uint32_t SAMPLE_INTERVAL_MS = 100;    // 10 Hz output rate
const uint32_t BASELINE_DURATION_MS = 2000; // 2 s baseline capture window on boot
const int BASELINE_SAMPLES = 20;            // 20 samples over 2 s
const int DEFAULT_BASELINE = 100;           // fallback if calibration is skipped

BLEUart bleuart;

uint32_t lastSampleMs = 0;
int baseline[CHANNEL_COUNT];   // per-channel zero point
bool baselineSet = false;

void setup() {
  Serial.begin(115200);
  // Don't block forever waiting for the serial monitor -- bench testing
  // often runs the device on battery with no host attached.
  uint32_t serialWaitStart = millis();
  while (!Serial && (millis() - serialWaitStart) < 1500) {
    delay(10);
  }

  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    pinMode(FSR_PINS[i], INPUT);
    baseline[i] = DEFAULT_BASELINE;
  }

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("MorphoGenixSOD");

  bleuart.begin();
  // Listen for commands ('z' = re-zero, 'r' = report baselines).
  bleuart.setRxCallback(uartRxCallback);

  startAdv();

  Serial.println("MorphoGenix Phase 2: 6-channel FSR over BLE UART (calibrated rev1)");
  Serial.println("Capturing 2-second baseline -- do not press sensors during this window.");

  captureBaseline();
}

void loop() {
  uint32_t now = millis();
  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;

    int adc[CHANNEL_COUNT];
    for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
      int raw = readAveraged(FSR_PINS[i]);
      // Subtract baseline; clamp to 0 if below (thermal drift, relaxation).
      adc[i] = raw - baseline[i];
      if (adc[i] < 0) adc[i] = 0;
    }

    // Serial debug -- human-readable, also useful for unplugged bench work
    Serial.print(now);
    for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
      Serial.print(",");
      Serial.print(adc[i]);
    }
    Serial.println();

    // BLE notify
    //
    // We deliberately DO NOT gate on bleuart.notifyEnabled(). That helper
    // checks whether the peer subscribed to the NUS RX characteristic (the
    // one the central writes TO us on). Web Bluetooth never writes -- it
    // only subscribes to the TX characteristic to listen -- so notifyEnabled()
    // can return false for the entire session even when a phone or laptop
    // is happily connected. Gating writes on it caused the bench to stay
    // silent forever (status: connected, no packets). Bluefruit.connected()
    // is the right gate for one-way streaming.
    if (Bluefruit.connected()) {
      char buf[80];
      int len = snprintf(buf, sizeof(buf), "%lu,%d,%d,%d,%d,%d,%d\n",
                         (unsigned long)now,
                         adc[0], adc[1], adc[2], adc[3], adc[4], adc[5]);
      if (len > 0 && len < (int)sizeof(buf)) {
        bleuart.write((uint8_t *)buf, len);
      }
    }
  }
}

// Capture baseline: average BASELINE_SAMPLES readings per channel with the
// device at rest. Called on boot and whenever the user requests a re-zero
// via the 'z' command over BLE UART.
void captureBaseline() {
  long sum[CHANNEL_COUNT] = {0, 0, 0, 0, 0, 0};
  for (int s = 0; s < BASELINE_SAMPLES; s++) {
    for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
      sum[i] += readAveraged(FSR_PINS[i]);
    }
    delay(BASELINE_DURATION_MS / BASELINE_SAMPLES);
  }
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    baseline[i] = sum[i] / BASELINE_SAMPLES;
    Serial.print("Baseline ");
    Serial.print(CHANNEL_NAMES[i]);
    Serial.print(" = ");
    Serial.println(baseline[i]);
  }
  baselineSet = true;
  Serial.println("Baseline capture complete. Streaming deltas above baseline.");
}

// Bench can write 'z' to trigger re-zero, or 'r' to print current baselines.
void uartRxCallback(uint16_t conn_handle) {
  (void)conn_handle;
  while (bleuart.available()) {
    int c = bleuart.read();
    if (c == 'z' || c == 'Z') {
      Serial.println("Re-zero requested from bench. Capturing baseline...");
      captureBaseline();
      // Echo confirmation back to the bench so the UI can show "zeroed".
      const char *msg = "ZEROED\n";
      bleuart.write((uint8_t *)msg, 7);
    } else if (c == 'r' || c == 'R') {
      // Report baselines (useful for debugging).
      char buf[80];
      int len = snprintf(buf, sizeof(buf), "BASELINE,%d,%d,%d,%d,%d,%d\n",
                         baseline[0], baseline[1], baseline[2],
                         baseline[3], baseline[4], baseline[5]);
      if (len > 0 && len < (int)sizeof(buf)) {
        bleuart.write((uint8_t *)buf, len);
      }
    }
  }
}

int readAveraged(int pin) {
  long sum = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += analogRead(pin); // 0..4095 on nRF52
    delay(2);
  }
  return (int)(sum / NUM_SAMPLES);
}

void startAdv() {
  Bluefruit.Advertising.stop();
  Bluefruit.Advertising.clearData();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addName();
  Bluefruit.Advertising.addService(bleuart);

  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244); // ~20 ms .. ~152.5 ms
  Bluefruit.Advertising.setFastTimeout(30);

  Bluefruit.Advertising.start(0); // never time out
}
