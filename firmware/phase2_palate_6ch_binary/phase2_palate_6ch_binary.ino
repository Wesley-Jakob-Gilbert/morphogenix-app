// Phase 2 (binary, 6-channel): XIAO nRF52840 + 6 FSRs + BLE UART @ 10 Hz
//
// This sketch is the binary-wire-format sibling of phase2_palate_6ch_calibrated
// (ASCII CSV). Same wiring, same BLE service (Nordic UART), same 10 Hz
// cadence, same boot-time baseline calibration, same 'z'/'r' RX commands.
// ONLY the BLE payload bytes differ -- Serial output stays ASCII for human
// debugging in the Arduino IDE.
//
// Why binary over ASCII for production:
//   * Fixed packet size (20 bytes) vs variable ASCII (~28+ bytes). Fewer
//     bytes on air = lower radio duty cycle = better battery life. At 10 Hz
//     that's ~80 bytes/sec saved -- noticeable over a clinic-day session.
//   * No snprintf on the MCU loop -- the binary build path is just memcpy
//     and bit-shifts. Frees CPU cycles for sampling and (later) on-device
//     filtering.
//   * Self-synchronizing: the 0xA7 magic byte sits outside ASCII printable
//     range, so the bench parser can drop and resync on any garbled chunk
//     without losing the whole stream.
//   * Checksum catches partial / corrupted notifications -- the parser
//     drops bad frames instead of injecting NaN into the UI.
//
// =========================================================================
// CHANNEL MAP -- mirrored in src/services/streamer/BleStreamer.js (CHANNEL_MAP)
// =========================================================================
//
// Wire index | Logical channel    | Anatomical region              | XIAO pin
// -----------+--------------------+--------------------------------+---------
//   adc[0]   | Rugae_L            | Anterior palate, left rugae    | A0
//   adc[1]   | Rugae_R            | Anterior palate, right rugae   | A1
//   adc[2]   | MidPalate_L        | Mid hard palate, left          | A2
//   adc[3]   | MidPalate_R        | Mid hard palate, right         | A3
//   adc[4]   | Posterior_L        | Posterior hard palate, left    | A4
//   adc[5]   | Posterior_R        | Posterior hard palate, right   | A5
//
// IMPORTANT: If you reorder physical wiring, update BOTH this comment AND
// the CHANNEL_MAP constant in BleStreamer.js in the SAME commit.
// =========================================================================
//
// Wire format (binary, little-endian, every field byte-packed):
//
//   Offset  Size  Field           Value / Meaning
//   ------  ----  --------------  ----------------------------------------
//   0       1     magic           0xA7
//   1       1     version         0x01
//   2       4     timestamp_ms    uint32 LE, millis since XIAO boot
//   6       1     channel_count   uint8, 6
//   7       2*N   adc_values      uint16 LE per channel (post-baseline)
//   7+2*N   1     checksum        XOR of all preceding bytes
//
// Total packet size at N=6: 8 + 12 = 20 bytes -- fits in a single BLE
// notification (default MTU 23, minus 3 ATT header bytes = 20 byte payload).
// We are exactly at the limit, on purpose: any further channels will need
// a higher MTU (ATT_MTU exchange) or two-packet framing. Document that
// here so future-us doesn't trip on it.
//
// =========================================================================
// HARDWARE WIRING (per channel, x6)
// =========================================================================
//   FSR top lead   -> 3V3 (shared 3.3V rail)
//   FSR bottom     -> A{n} (analog input) AND 10k pulldown to GND
//   10k pulldown   -> GND (shared ground rail)
//
//   * All six 3V3 inputs share a single power wire from the XIAO's 3V3 pin.
//   * All six GND returns share a single ground wire back to the XIAO's GND.
//   * Each channel has its own 10k pulldown -- DO NOT share pulldowns
//     across channels (causes crosstalk between FSRs).
// =========================================================================
//
// BLE RX COMMANDS (bench writes ASCII single chars to NUS RX):
//   'z' -- re-zero baselines using next 2 seconds of input. Reply: "ZEROED\n".
//   'r' -- report current baselines as "BASELINE,b0,b1,b2,b3,b4,b5\n".
// These commands ride the Nordic UART RX characteristic (same path as ASCII
// firmware) so the bench logic is identical regardless of wire format.

#include <bluefruit.h>

// --------- Channel pinout -- see CHANNEL MAP block above ---------
const int FSR_PINS[6] = { A0, A1, A2, A3, A4, A5 };
const int NUM_SAMPLES = 8;          // boxcar average per channel per sample

BLEUart bleuart;

// --------- Protocol constants -- mirrored in BleStreamer.js ---------
const uint8_t  PKT_MAGIC         = 0xA7;
const uint8_t  PKT_VERSION       = 0x01;
const uint8_t  CHANNEL_COUNT     = 6;       // bump if you add channels

const uint32_t SAMPLE_INTERVAL_MS = 100;    // 10 Hz output
uint32_t lastSampleMs = 0;

// Packet size in bytes for the current CHANNEL_COUNT, computed at compile
// time so the buffer is always exactly right.
constexpr size_t PKT_SIZE = 1 /*magic*/ + 1 /*ver*/ + 4 /*ts*/ + 1 /*cnt*/
                          + 2 * CHANNEL_COUNT /*adc*/ + 1 /*checksum*/;

// Compile-time sanity: must fit in default BLE MTU payload (20 bytes).
static_assert(PKT_SIZE <= 20,
              "Packet > 20B -- need ATT MTU exchange or multi-packet framing");

// --------- Baseline calibration state ---------
// Each channel captures its own resting ADC value during boot. We subtract
// the baseline at stream time so a relaxed mouth reads ~0 across all six
// channels, not ~100 (the silicone preload offset we hit in round 1).
// Re-zero can be triggered later via the 'z' BLE RX command.
const uint32_t BASELINE_DURATION_MS = 2000;   // 2 seconds per re-zero
uint16_t baseline[CHANNEL_COUNT] = {0, 0, 0, 0, 0, 0};

// Flag set by the BLE RX callback. The main loop checks it and runs the
// re-zero outside the ISR context so we can take our time sampling.
volatile bool rezeroRequested = false;
volatile bool reportRequested = false;

void captureBaselines() {
  // Average the same channel many times across BASELINE_DURATION_MS so
  // small fluctuations from breath/swallow get smoothed out. We do this
  // once at boot, and again whenever the user holds the device still
  // and sends 'z' from the bench.
  uint32_t start = millis();
  uint32_t sum[CHANNEL_COUNT] = {0, 0, 0, 0, 0, 0};
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

  // Wait briefly for USB Serial so the boot banner shows when we're plugged
  // into the Arduino Serial Monitor. Don't block forever -- the device must
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

  Serial.println("MorphoGenix Phase 2: 6-channel FSR over BLE UART (binary v1, magic 0xA7)");
  Serial.print("Packet size: ");
  Serial.print(PKT_SIZE);
  Serial.println(" bytes");

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
    char msg[80];
    int len = snprintf(msg, sizeof(msg), "BASELINE,%d,%d,%d,%d,%d,%d\n",
                       baseline[0], baseline[1], baseline[2],
                       baseline[3], baseline[4], baseline[5]);
    if (Bluefruit.connected() && len > 0) {
      bleuart.write((const uint8_t *)msg, (size_t)len);
    }
    Serial.print(msg);
  }

  // ---- 10 Hz sample cadence ----
  uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  // ---- Sample all 6 channels, subtract baseline, clamp ----
  uint16_t adc[CHANNEL_COUNT];
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    int raw = readAveraged(FSR_PINS[i]);
    int corrected = raw - (int)baseline[i];
    if (corrected < 0) corrected = 0;        // clamp negative dips to 0
    if (corrected > 4095) corrected = 4095;  // 12-bit ADC ceiling
    adc[i] = (uint16_t)corrected;
  }

  // ---- Serial debug -- human-readable, NOT the wire format ----
  // Mirror of the ASCII sketch's Serial output, so existing Arduino IDE
  // debug habits keep working. The BLE radio gets the binary packet below.
  // If you ever need to confirm the binary bytes match these values, the
  // bench's first-chunk hex dump will show exactly what went over the wire.
  Serial.print(now);
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    Serial.print(",");
    Serial.print(adc[i]);
  }
  Serial.println();

  // ---- Build the binary packet ----
  uint8_t buf[PKT_SIZE];
  size_t off = 0;

  buf[off++] = PKT_MAGIC;
  buf[off++] = PKT_VERSION;

  // uint32 little-endian. nRF52 is LE-native and so are all our consumers
  // (modern x86/ARM browsers, phones). No byteswap required.
  buf[off++] = (uint8_t)(now & 0xFF);
  buf[off++] = (uint8_t)((now >>  8) & 0xFF);
  buf[off++] = (uint8_t)((now >> 16) & 0xFF);
  buf[off++] = (uint8_t)((now >> 24) & 0xFF);

  buf[off++] = CHANNEL_COUNT;

  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    buf[off++] = (uint8_t)(adc[i] & 0xFF);
    buf[off++] = (uint8_t)((adc[i] >> 8) & 0xFF);
  }

  // Checksum = XOR of every byte written so far. Cheap, catches every
  // single-bit error and most multi-bit ones. Overkill alternatives like
  // CRC-16 buy us nothing on a 10 Hz local-radio link.
  uint8_t xorSum = 0;
  for (size_t i = 0; i < off; i++) xorSum ^= buf[i];
  buf[off++] = xorSum;

  // ---- Send over BLE ----
  // We deliberately do NOT gate on bleuart.notifyEnabled() (see comments
  // in phase2_palate_1ch.ino for the full silent-stream story).
  // Bluefruit.connected() is the right gate for one-way streaming to a
  // Web Bluetooth central.
  if (Bluefruit.connected()) {
    bleuart.write(buf, off);
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
