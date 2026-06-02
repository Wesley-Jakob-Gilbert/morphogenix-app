// Phase 2 (ASCII, 4-channel): XIAO nRF52840 + 4 FSRs + BLE UART @ 10 Hz
//
// Reduced-channel sibling of phase2_palate_6ch_calibrated. Same protocol,
// same boot-time baseline calibration, same 'z'/'r' RX commands. Fewer
// solder joints = lower fail rate in the molded form factor under a
// tight deadline.
//
// =========================================================================
// CHANNEL MAP -- mirrored in src/services/streamer/BleStreamer.js (CHANNEL_MAP)
// =========================================================================
//
// Wire index | Logical channel | Anatomical region                 | XIAO pin
// -----------+-----------------+-----------------------------------+---------
//   adc[0]   | Molar_L         | Left posterior, molar occlusal    | A0
//   adc[1]   | Molar_R         | Right posterior, molar occlusal   | A1
//   adc[2]   | Palate_L        | Left mid hard palate              | A2
//   adc[3]   | Palate_R        | Right mid hard palate             | A3
//
// IMPORTANT: If you reorder physical wiring, update BOTH this comment AND
// the CHANNEL_MAP constant in BleStreamer.js in the SAME commit.
// =========================================================================
//
// Wire format (ASCII CSV, newline-terminated):
//   <millis>,<adc0>,<adc1>,<adc2>,<adc3>\n
//
//   * adc values are POST-baseline (relaxed mouth reads ~0 across all four)
//   * 0..4095 range (12-bit ADC, negative dips clamped to 0)
//
// =========================================================================
// HARDWARE WIRING (per channel, x4)
// =========================================================================
//   FSR top lead   -> 3V3 (shared 3.3V rail)
//   FSR bottom     -> A{n} (analog input) AND 10k pulldown to GND
//   10k pulldown   -> GND (shared ground rail)
//
//   * All four 3V3 inputs share a single power wire from the XIAO's 3V3 pin.
//   * All four GND returns share a single ground wire back to the XIAO's GND.
//   * Each channel has its own 10k pulldown -- DO NOT share pulldowns
//     across channels (causes crosstalk between FSRs).
//   * Solder the 10k pulldown directly across the FSR's two leads AT the
//     FSR, not back at the MCU. This reduces wire count from 3-per-FSR
//     to 2-per-FSR running through the silicone -- huge ergonomic win.
// =========================================================================
//
// BLE RX COMMANDS (bench writes ASCII single chars to NUS RX):
//   'z' -- re-zero baselines using next 2 seconds of input. Reply: "ZEROED\n".
//   'r' -- report current baselines as "BASELINE,b0,b1,b2,b3\n".

#include <bluefruit.h>

// --------- Channel pinout -- see CHANNEL MAP block above ---------
const int FSR_PINS[4] = { A0, A1, A2, A3 };
const int NUM_SAMPLES = 8;          // boxcar average per channel per sample

BLEUart bleuart;

// --------- Protocol constants ---------
const uint8_t  CHANNEL_COUNT      = 4;
const uint32_t SAMPLE_INTERVAL_MS = 100;    // 10 Hz output
uint32_t lastSampleMs = 0;

// --------- Baseline calibration state ---------
// Each channel captures its own resting ADC value during boot. We subtract
// the baseline at stream time so a relaxed mouth reads ~0 across all four
// channels, not ~100 (the silicone preload offset we hit in round 1).
// Re-zero can be triggered later via the 'z' BLE RX command.
const uint32_t BASELINE_DURATION_MS = 2000;   // 2 seconds per re-zero
uint16_t baseline[CHANNEL_COUNT] = {0, 0, 0, 0};

// Flag set by the BLE RX callback. The main loop checks it and runs the
// re-zero outside the ISR context so we can take our time sampling.
volatile bool rezeroRequested = false;
volatile bool reportRequested = false;

void captureBaselines() {
  // Average the same channel many times across BASELINE_DURATION_MS so
  // small fluctuations from breath/swallow get smoothed out. Run once at
  // boot, and again whenever the user holds the device still and sends 'z'
  // from the bench.
  uint32_t start = millis();
  uint32_t sum[CHANNEL_COUNT] = {0, 0, 0, 0};
  uint32_t count = 0;
  while (millis() - start < BASELINE_DURATION_MS) {
    for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
      sum[i] += (uint32_t)analogRead(FSR_PINS[i]);
    }
    count++;
    delay(5);
  }
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    baseline[i] = (uint16_t)(sum[i] / (count == 0 ? 1 : count));
  }
}

// BLE RX callback fires from BLE task context. Keep it cheap: just flip a
// flag and let the main loop do the work.
void bleRxCallback(uint16_t /*conn_handle*/) {
  while (bleuart.available()) {
    int c = bleuart.read();
    if (c == 'z' || c == 'Z') rezeroRequested = true;
    else if (c == 'r' || c == 'R') reportRequested = true;
    // ignore everything else for now -- protocol stays small on purpose
  }
}

void setup() {
  Serial.begin(115200);

  // Wait briefly for USB Serial so the boot banner shows when plugged into
  // the Arduino Serial Monitor. Don't block forever -- the device must
  // still work on battery with no host attached.
  uint32_t serialWaitStart = millis();
  while (!Serial && (millis() - serialWaitStart) < 1500) {
    delay(10);
  }

  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    pinMode(FSR_PINS[i], INPUT);
  }

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("MorphoGenixSOD");

  bleuart.begin();
  bleuart.setRxCallback(bleRxCallback);
  startAdv();

  Serial.println("MorphoGenix Phase 2: 4-channel FSR over BLE UART (ASCII CSV)");
  Serial.println("Channels: Molar_L, Molar_R, Palate_L, Palate_R");

  // Initial baseline -- mouth should be relaxed / device sitting still on
  // the bench during the first 2 seconds after boot. The bench can re-zero
  // later via the 'z' command once the device is seated in the mouth.
  Serial.println("Capturing initial baselines (2s)...");
  captureBaselines();
  Serial.print("Baselines: ");
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    if (i) Serial.print(",");
    Serial.print(baseline[i]);
  }
  Serial.println();
}

void loop() {
  // ---- Handle pending BLE RX commands first ----
  if (rezeroRequested) {
    rezeroRequested = false;
    Serial.println("Re-zero requested: capturing baselines...");
    captureBaselines();
    if (Bluefruit.connected()) {
      const char *ack = "ZEROED\n";
      bleuart.write((const uint8_t *)ack, 7);
    }
    Serial.print("New baselines: ");
    for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
      if (i) Serial.print(",");
      Serial.print(baseline[i]);
    }
    Serial.println();
  }
  if (reportRequested) {
    reportRequested = false;
    char msg[64];
    int len = snprintf(msg, sizeof(msg), "BASELINE,%d,%d,%d,%d\n",
                       baseline[0], baseline[1], baseline[2], baseline[3]);
    if (Bluefruit.connected() && len > 0) {
      bleuart.write((const uint8_t *)msg, (size_t)len);
    }
    Serial.print(msg);
  }

  // ---- 10 Hz sample cadence ----
  uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  // ---- Sample all 4 channels, subtract baseline, clamp ----
  uint16_t adc[CHANNEL_COUNT];
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    int raw = readAveraged(FSR_PINS[i]);
    int corrected = raw - (int)baseline[i];
    if (corrected < 0) corrected = 0;        // clamp negative dips to 0
    if (corrected > 4095) corrected = 4095;  // 12-bit ADC ceiling
    adc[i] = (uint16_t)corrected;
  }

  // ---- Build ASCII CSV line ----
  char line[64];
  int len = snprintf(line, sizeof(line), "%lu,%u,%u,%u,%u\n",
                     (unsigned long)now,
                     adc[0], adc[1], adc[2], adc[3]);

  // ---- Mirror to Serial for Arduino IDE debugging ----
  if (len > 0) {
    Serial.print(line);
  }

  // ---- Send over BLE ----
  // We deliberately do NOT gate on bleuart.notifyEnabled() (see comments in
  // phase2_palate_1ch.ino for the full silent-stream story).
  // Bluefruit.connected() is the right gate for one-way streaming to a
  // Web Bluetooth central.
  if (Bluefruit.connected() && len > 0) {
    bleuart.write((const uint8_t *)line, (size_t)len);
  }
}

int readAveraged(int pin) {
  long sum = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += analogRead(pin);   // 0..4095 on nRF52 in 12-bit mode
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
  Bluefruit.Advertising.setInterval(32, 244);   // ~20ms .. ~152.5ms
  Bluefruit.Advertising.setFastTimeout(30);

  Bluefruit.Advertising.start(0);   // never time out
}
