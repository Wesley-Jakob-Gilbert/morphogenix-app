// Phase 2 (binary): XIAO nRF52840 + 1 FSR + BLE UART @ 10 Hz, binary payload
//
// Parallel sibling to phase2_palate_1ch.ino. Same wiring, same BLE service
// (Nordic UART), same 10 Hz sample cadence. ONLY the payload bytes differ.
// Web bench (BleStreamer.js) auto-detects which format is in use by sniffing
// the first byte of the first notification, so you can A/B between this
// sketch and the ASCII sketch without touching the web app.
//
// =========================================================================
// CHANNEL MAP -- mirrored in src/services/streamer/BleStreamer.js (CHANNEL_MAP)
// =========================================================================
//
// Wire index | Logical channel    | Anatomical region        | XIAO pin
// -----------+--------------------+--------------------------+---------
//   adc[0]   | FSR_PALATE_CENTER  | Hard palate, midline     | A0
//
// Reserved positions for future channels (uncomment + add reads + bump
// CHANNEL_COUNT when you wire the next FSRs):
//   adc[1]   | FSR_PALATE_LEFT    | Hard palate, left side   | A1
//   adc[2]   | FSR_PALATE_RIGHT   | Hard palate, right side  | A2
//
// IMPORTANT: If you reorder physical wiring, update BOTH this comment AND
// the CHANNEL_MAP constant in BleStreamer.js in the SAME commit.
// =========================================================================
//
// Wire format (binary, little-endian, every field byte-packed):
//
//   Offset  Size  Field           Value / Meaning
//   ------  ----  --------------  ----------------------------------------
//   0       1     magic           0xA7   (chosen: distinct from any ASCII
//                                         digit/comma/newline, easy to grep)
//   1       1     version         0x01   (bumps if layout ever changes)
//   2       4     timestamp_ms    uint32 LE, millis since XIAO boot
//   6       1     channel_count   uint8, currently 1
//   7       2*N   adc_values      uint16 LE per channel, 0..4095
//   7+2*N   1     checksum        XOR of all preceding bytes
//
// Total packet size = 8 + 2*N bytes. At N=1 -> 10 bytes. At N=3 -> 14 bytes.
// Both fit comfortably in a single BLE notification (default MTU = 23,
// minus 3 ATT header bytes = 20 byte payload).
//
// Why a magic byte + version + checksum on a tiny 1-channel sketch:
//   The cost is negligible (3 bytes per packet) and it eliminates two whole
//   classes of bug we'd otherwise spend hours debugging later:
//     1. "Is this a real packet or random NUS noise?" -- magic byte answers
//        in 1 byte. Parser rejects anything that doesn't start with 0xA7.
//     2. "Did the central read a partial packet from a fragmented
//        notification?" -- checksum catches it. Parser drops the packet
//        instead of feeding garbage into the UI.
//   The version byte lets us evolve the format without breaking older
//   bench builds in the field (when there are clinicians in the field).

#include <bluefruit.h>

// --------- Channel-0 wiring -- see CHANNEL MAP block above ---------
const int FSR_PIN_PALATE_CENTER = A0;
const int NUM_SAMPLES = 8;          // simple boxcar average per channel

BLEUart bleuart;

// --------- Protocol constants -- mirrored in BleStreamer.js ---------
const uint8_t  PKT_MAGIC         = 0xA7;
const uint8_t  PKT_VERSION       = 0x01;
const uint8_t  CHANNEL_COUNT     = 1;       // bump when you add channels

const uint32_t SAMPLE_INTERVAL_MS = 100;    // 10 Hz
uint32_t lastSampleMs = 0;

// Packet size in bytes for the current CHANNEL_COUNT. Computed at compile
// time so the buffer is always exactly right.
constexpr size_t PKT_SIZE = 1 /*magic*/ + 1 /*ver*/ + 4 /*ts*/ + 1 /*cnt*/
                          + 2 * CHANNEL_COUNT /*adc*/ + 1 /*checksum*/;

void setup() {
  Serial.begin(115200);

  // Wait briefly for USB Serial so the boot banner shows when we're plugged
  // into the Arduino Serial Monitor. Don't block forever -- the device must
  // still work when running on battery with no host attached.
  uint32_t serialWaitStart = millis();
  while (!Serial && (millis() - serialWaitStart) < 1500) {
    delay(10);
  }

  pinMode(FSR_PIN_PALATE_CENTER, INPUT);

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("MorphoGenixSOD");

  bleuart.begin();
  startAdv();

  Serial.println("MorphoGenix Phase 2: 1-channel FSR over BLE UART (binary v1, magic 0xA7)");
  Serial.print("Packet size: ");
  Serial.print(PKT_SIZE);
  Serial.println(" bytes");
}

void loop() {
  uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  // ---- Sample all channels ----
  uint16_t adc[CHANNEL_COUNT];
  adc[0] = (uint16_t)readAveraged(FSR_PIN_PALATE_CENTER);  // FSR_PALATE_CENTER
  // adc[1] = (uint16_t)readAveraged(A1);  // when FSR_PALATE_LEFT is wired
  // adc[2] = (uint16_t)readAveraged(A2);  // when FSR_PALATE_RIGHT is wired

  // ---- Serial debug -- human-readable, NOT the wire format ----
  // We deliberately keep Serial as ASCII for eyeball debugging in the
  // Arduino IDE. The BLE radio gets the binary payload below. If you ever
  // want to confirm the binary bytes match the Serial values, the bench's
  // first-chunk hex dump will show you exactly what went over the wire.
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

  // Checksum = XOR of every byte we just wrote. Cheap, catches every
  // single-bit error and most multi-bit ones. Anything fancier would be
  // overkill for a 10 Hz local-radio link.
  uint8_t xorSum = 0;
  for (size_t i = 0; i < off; i++) xorSum ^= buf[i];
  buf[off++] = xorSum;

  // ---- Send over BLE ----
  // We deliberately do NOT gate on bleuart.notifyEnabled() (see ASCII sketch
  // comments for the full reasoning). Bluefruit.connected() is the right
  // gate for one-way streaming to a Web Bluetooth central.
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
