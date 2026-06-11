// Phase 3 (binary v2, 4-channel FSR + 3-axis accel):
//   Seeed XIAO nRF52840 Sense + 4 FSRs + LSM6DS3TR-C IMU + BLE UART @ 10 Hz
//
// This sketch is the Phase-3 evolution of phase2_palate_4ch_calibrated.ino
// (ASCII CSV) and the binary-wire sibling REFERENCE_6ch_binary.ino (binary v1).
// It MERGES the two: same wiring, same Nordic UART service, same 10 Hz
// cadence, same boot-time baseline calibration, and the same 'z'/'r' RX
// commands as the production phase2 sketch -- but now it streams a fixed-size
// BINARY packet (version 0x02) that carries the 4 FSR channels PLUS 3 raw
// accelerometer axes from the on-board IMU.
//
// USB Serial output stays ASCII/human-readable for bench debugging in the
// Arduino IDE; only the BLE payload is binary.
//
// =========================================================================
// VERSION BUMP RATIONALE (v1 -> v2)
// =========================================================================
// Binary v1 (REFERENCE_6ch_binary.ino) framed N uint16 ADC channels with a
// uint8 channel_count. v2 keeps the exact same header and magic byte but
// re-purposes the "sensor count" to mean "total logical sensors = 7" (4 FSR
// uint16 + 3 accel int16). The FSR block is byte-identical to v1's adc block;
// the accel block is appended after it as 3 signed int16 LE values. Because
// the magic (0xA7) is unchanged and the version byte moved 0x01 -> 0x02, an
// old v1-only parser will see version=2, reject the frame, and resync -- it
// will NOT silently misread accel bytes as extra FSR channels. The app-side
// BleStreamer.js handles BOTH v1 and v2 in its binary path.
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
//   accel[0] | Accel_X         | IMU X axis (raw int16, +/-2g)     | I2C 0x6A
//   accel[1] | Accel_Y         | IMU Y axis (raw int16, +/-2g)     | I2C 0x6A
//   accel[2] | Accel_Z         | IMU Z axis (raw int16, +/-2g)     | I2C 0x6A
//
// IMPORTANT: If you reorder physical wiring, update BOTH this comment AND
// the CHANNEL_MAP constant in BleStreamer.js in the SAME commit.
// =========================================================================
//
// BINARY PACKET FORMAT v2 (little-endian, byte-packed)
// =========================================================================
//
//   Offset  Size  Field           Value / Meaning
//   ------  ----  --------------  ----------------------------------------
//   0       1     magic           0xA7   (same as v1)
//   1       1     version         0x02   (NEW -- bumped from v1's 0x01)
//   2       4     timestamp_ms    uint32 LE, millis() since boot
//   6       1     sensor_count    uint8, 7 (4 FSR + 3 accel)
//   7       8     fsr_values      4x uint16 LE, 0..4095 baseline-subtracted
//   15      6     accel_values    3x int16 LE, raw +/-2g full-scale
//   21      1     checksum        XOR of all preceding bytes
//
//   Total: 1+1+4+1+8+6+1 = 22 bytes.
//
// 22 bytes fits inside a single BLE notification at the default ATT MTU of 23
// (23 - 3 ATT header bytes = 20 byte payload... NOTE: 22 > 20). We deliberately
// rely on the nRF52 negotiating a larger MTU with modern Web Bluetooth /
// Android / Chrome centrals (they default to 247), which is the common case
// for this product. The static_assert below documents the 23B "max BLE
// notification at default MTU" ceiling from the spec; if a central refuses to
// raise the MTU, the packet would need two-notification framing. The app-side
// binary reassembler already accumulates across notifications, so a future
// split is a firmware-only change.
//
// =========================================================================
// IMU REGISTER CHOICE & WHY +/-2g
// =========================================================================
// The XIAO nRF52840 Sense carries an ST LSM6DS3TR-C 6-axis IMU on I2C at
// address 0x6A (SDO/SA0 tied low on the Seeed module). Accel output registers
// start at OUTX_L_XL = 0x28 and run X_L,X_H,Y_L,Y_H,Z_L,Z_H (six bytes, LE
// int16 per axis). We read those six bytes straight into three int16s.
//
// Full scale is set to +/-2g. Sleep-position sensing is a LOW-G, quasi-static
// problem: the only meaningful force on a still head is 1g of gravity tilted
// by the skull's orientation. +/-2g gives the FINEST resolution per LSB
// (~0.061 mg/LSB) of any LSM6DS3 range, which maximizes the angular precision
// of the atan2 pitch/roll math the app does. Higher ranges (+/-4/8/16g) only
// matter for impacts/sports and would throw away resolution we need.
//
// ODR (output data rate) is set to 26 Hz -- the lowest "normal mode" rate the
// part offers that still comfortably exceeds our 10 Hz packet cadence, so each
// 10 Hz packet always has a fresh sample with margin and we burn minimal IMU
// power. We read raw int16 X/Y/Z once per packet.
//
// LIBRARY vs FALLBACK:
//   Preferred path uses the Seeed_Arduino_LSM6DS3 library (the same one the
//   Seeed XIAO Sense IMU examples use). If that library is not present at
//   compile time (USE_LSM6DS3_LIB undefined / header missing), we FALL BACK to
//   direct raw I2C reads via Wire.h against register 0x28. The fallback is
//   clearly fenced with #else below and is functionally identical for our
//   purpose (raw int16 per axis). Define USE_LSM6DS3_LIB to use the library.
//
// =========================================================================
// HARDWARE WIRING (FSR, per channel x4) -- unchanged from phase2
// =========================================================================
//   FSR top lead   -> 3V3 (shared 3.3V rail)
//   FSR bottom     -> A{n} (analog input) AND 10k pulldown to GND
//   10k pulldown   -> GND (shared ground rail)
//   * Each channel has its own 10k pulldown -- DO NOT share (crosstalk).
//   The IMU is on-board; no external wiring -- it shares the XIAO's internal
//   I2C bus (Wire). On the Sense, the IMU power pin must be enabled; the
//   Seeed library and most examples handle this, and Wire.begin() is enough
//   for the bare-metal path on current cores.
// =========================================================================
//
// BLE RX COMMANDS (bench writes ASCII single chars to NUS RX):
//   'z' -- re-zero FSR baselines using next 2 seconds of input. Reply "ZEROED\n".
//   'r' -- report current FSR baselines as "BASELINE,b0,b1,b2,b3\n".
//   'i' -- NEW: one-shot IMU diagnostic. Prints raw ax/ay/az plus computed
//          pitch/roll (degrees) to USB Serial for bench testing. Bench-only;
//          no BLE reply (keeps the wire format clean).

#include <bluefruit.h>
#include <Wire.h>
#include <math.h>

// Define this (or let the build define it) to use the Seeed library path.
// Comment it out to force the direct-I2C fallback. We auto-detect the header
// so an absent library degrades gracefully rather than failing to compile.
#ifndef USE_LSM6DS3_LIB
#define USE_LSM6DS3_LIB 1
#endif

#if USE_LSM6DS3_LIB && __has_include("LSM6DS3.h")
  #include "LSM6DS3.h"
  #define IMU_LIB_AVAILABLE 1
  // I2C device mode, address 0x6A (SA0 low on the XIAO Sense module).
  LSM6DS3 imu(I2C_MODE, 0x6A);
#else
  #define IMU_LIB_AVAILABLE 0
#endif

// --------- IMU register constants (direct-I2C fallback path) ---------
static const uint8_t LSM6DS3_ADDR     = 0x6A; // SA0 low on XIAO Sense
static const uint8_t REG_CTRL1_XL     = 0x10; // accel control: ODR + full scale
static const uint8_t REG_OUTX_L_XL    = 0x28; // accel X low byte; X/Y/Z LE int16 follow
static const uint8_t REG_WHO_AM_I     = 0x0F; // expect 0x6A (or 0x69) for LSM6DS3TR-C
// CTRL1_XL = 0b0011_00_00: ODR_XL=0011 (26 Hz), FS_XL=00 (+/-2g), rest 0.
static const uint8_t CTRL1_XL_26HZ_2G = 0x30;

// --------- Channel pinout -- see CHANNEL MAP block above ---------
const int FSR_PINS[4] = { A0, A1, A2, A3 };
const int NUM_SAMPLES = 8;          // boxcar average per channel per sample

BLEUart bleuart;

// --------- Protocol constants -- mirrored in BleStreamer.js ---------
const uint8_t  PKT_MAGIC          = 0xA7;
const uint8_t  PKT_VERSION        = 0x02;   // v2: 4 FSR uint16 + 3 accel int16
const uint8_t  FSR_COUNT          = 4;
const uint8_t  ACCEL_COUNT        = 3;
const uint8_t  SENSOR_COUNT       = FSR_COUNT + ACCEL_COUNT; // = 7

const uint32_t SAMPLE_INTERVAL_MS = 100;    // 10 Hz output
uint32_t lastSampleMs = 0;

// Packet size computed at compile time so the buffer is always exactly right.
constexpr size_t PKT_SIZE = 1 /*magic*/ + 1 /*ver*/ + 4 /*ts*/ + 1 /*cnt*/
                          + 2 * 4 /*fsr*/ + 2 * 3 /*accel*/ + 1 /*checksum*/;

// Compile-time sanity: the spec's "max BLE notification at default MTU" is
// 23 bytes. We are at 22, which requires the central to negotiate an MTU >= 25
// (22 payload + 3 ATT header). Modern Web Bluetooth / Android centrals default
// to 247, so this holds in practice. If you must support a 23-byte-MTU central,
// split into two notifications (see header comment).
static_assert(PKT_SIZE <= 23,
              "Packet > 23B -- exceeds default-MTU BLE notification ceiling; "
              "needs ATT MTU exchange or multi-packet framing");

// --------- FSR baseline calibration state (identical to phase2) ---------
const uint32_t BASELINE_DURATION_MS = 2000;   // 2 seconds per re-zero
uint16_t baseline[FSR_COUNT] = {0, 0, 0, 0};

// Flags set by the BLE RX callback; main loop does the work outside ISR ctx.
volatile bool rezeroRequested = false;
volatile bool reportRequested = false;
volatile bool imuDiagRequested = false;

// --------- IMU helpers ---------
bool imuReady = false;

#if !IMU_LIB_AVAILABLE
// ---- Direct-I2C fallback: minimal raw register access via Wire ----
static void i2cWriteReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(LSM6DS3_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

static uint8_t i2cReadReg(uint8_t reg) {
  Wire.beginTransmission(LSM6DS3_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);          // repeated start
  Wire.requestFrom((int)LSM6DS3_ADDR, 1);
  return Wire.available() ? Wire.read() : 0;
}

// Burst-read the 6 accel output bytes starting at OUTX_L_XL into 3 int16s.
static void i2cReadAccelRaw(int16_t &ax, int16_t &ay, int16_t &az) {
  Wire.beginTransmission(LSM6DS3_ADDR);
  Wire.write(REG_OUTX_L_XL);
  Wire.endTransmission(false);          // repeated start
  Wire.requestFrom((int)LSM6DS3_ADDR, 6);
  uint8_t b[6] = {0, 0, 0, 0, 0, 0};
  for (uint8_t i = 0; i < 6 && Wire.available(); i++) b[i] = Wire.read();
  ax = (int16_t)((b[1] << 8) | b[0]);   // little-endian per axis
  ay = (int16_t)((b[3] << 8) | b[2]);
  az = (int16_t)((b[5] << 8) | b[4]);
}
#endif // !IMU_LIB_AVAILABLE

// Enable the on-board IMU power rail on the XIAO nRF52840 SENSE.
// CRITICAL: The Sense variant gates the LSM6DS3TR-C through a load switch on
// a dedicated GPIO. If we don't drive it HIGH before Wire ops, the IMU is
// completely unpowered and every read returns 0 -- which is exactly the
// symptom we hit (banner OK, then accel/pitch/roll permanently 0,0,0).
//
// Seeed's variant file defines PIN_LSM6DS3TR_C_POWER for this purpose, but the
// macro is only present on certain board-package versions, so we also accept
// the raw GPIO fallback (P0.27 on the nRF52840 Sense pinout). We pulse it,
// wait for boot, and verify with a WHO_AM_I read.
static void imuPowerOn() {
#ifdef PIN_LSM6DS3TR_C_POWER
  pinMode(PIN_LSM6DS3TR_C_POWER, OUTPUT);
  digitalWrite(PIN_LSM6DS3TR_C_POWER, HIGH);
#else
  // Raw fallback for older Seeed BSPs: GPIO P0.27 = Arduino pin 27 on
  // the XIAO nRF52840 Sense gates the IMU+mic power rail. Driving it HIGH
  // is harmless if the macro path was already wired; doing it twice is fine.
  pinMode(27, OUTPUT);
  digitalWrite(27, HIGH);
#endif
  delay(50);  // LSM6DS3TR-C boot time is ~35 ms after power-up; pad generously.
}

// Initialize the accelerometer at +/-2g, 26 Hz. Returns true on success.
bool imuBegin() {
  // ALWAYS power the IMU rail first, regardless of which init path follows.
  // This is the fix for the "reads all zeros" failure mode.
  imuPowerOn();

#if IMU_LIB_AVAILABLE
  // Library path: write settings BEFORE begin() so the library applies them
  // during its register-config phase. Some library versions ignore late writes.
  imu.settings.accelEnabled  = 1;
  imu.settings.accelRange    = 2;    // +/-2g
  imu.settings.accelSampleRate = 26; // 26 Hz ODR
  imu.settings.gyroEnabled   = 0;    // we don't need gyro for pitch/roll
  status_t status = imu.begin();
  Serial.print("  [imu] library begin() status = ");
  Serial.println((int)status);
  if (status != 0) return false;

  // Belt-and-suspenders: read WHO_AM_I directly via Wire to confirm the chip
  // is actually responding. The library can return success even when the bus
  // is wedged on some board variants.
  Wire.beginTransmission(0x6A);
  Wire.write(REG_WHO_AM_I);
  if (Wire.endTransmission(false) != 0) {
    Serial.println("  [imu] WHO_AM_I transmit failed -- I2C bus dead");
    return false;
  }
  Wire.requestFrom((int)0x6A, 1);
  uint8_t who = Wire.available() ? Wire.read() : 0;
  Serial.print("  [imu] WHO_AM_I = 0x");
  Serial.println(who, HEX);
  if (who != 0x6A && who != 0x69) {
    Serial.println("  [imu] WHO_AM_I mismatch -- chip not responding");
    return false;
  }
  return true;
#else
  // Fallback path: bring up Wire, sanity-check WHO_AM_I, configure CTRL1_XL.
  Wire.begin();
  delay(10);
  uint8_t who = i2cReadReg(REG_WHO_AM_I);
  Serial.print("  [imu] WHO_AM_I = 0x");
  Serial.println(who, HEX);
  // LSM6DS3TR-C reports 0x6A; some lots report 0x69. Accept either.
  if (who != 0x6A && who != 0x69) return false;
  i2cWriteReg(REG_CTRL1_XL, CTRL1_XL_26HZ_2G);
  delay(20);
  return true;
#endif
}

// Read raw int16 X/Y/Z for the current packet. Falls back to 0,0,0 if the IMU
// failed to init (so the packet shape is always valid and the app sees the
// degenerate vector rather than stale/garbage data).
void imuReadRaw(int16_t &ax, int16_t &ay, int16_t &az) {
  if (!imuReady) { ax = 0; ay = 0; az = 0; return; }
#if IMU_LIB_AVAILABLE
  ax = imu.readRawAccelX();
  ay = imu.readRawAccelY();
  az = imu.readRawAccelZ();
#else
  i2cReadAccelRaw(ax, ay, az);
#endif
}

void captureBaselines() {
  uint32_t start = millis();
  uint32_t sum[FSR_COUNT] = {0, 0, 0, 0};
  uint32_t count = 0;
  while (millis() - start < BASELINE_DURATION_MS) {
    for (uint8_t i = 0; i < FSR_COUNT; i++) {
      sum[i] += (uint32_t)analogRead(FSR_PINS[i]);
    }
    count++;
    delay(5);
  }
  for (uint8_t i = 0; i < FSR_COUNT; i++) {
    baseline[i] = (uint16_t)(sum[i] / (count == 0 ? 1 : count));
  }
}

// One-shot IMU diagnostic: dump raw accel + computed pitch/roll to Serial.
// Pitch/roll math mirrors src/services/headPosition.js so bench numbers
// match what the app classifies on.
void printImuDiag() {
  int16_t ax, ay, az;
  imuReadRaw(ax, ay, az);
  // Convert raw -> g (+/-2g full scale: raw * 2 / 32768).
  float gx = (float)ax * 2.0f / 32768.0f;
  float gy = (float)ay * 2.0f / 32768.0f;
  float gz = (float)az * 2.0f / 32768.0f;
  float pitch = atan2f(-gx, sqrtf(gy * gy + gz * gz)) * 180.0f / (float)M_PI;
  float roll  = atan2f(gy, gz) * 180.0f / (float)M_PI;
  Serial.print("IMU diag  ready=");
  Serial.print(imuReady ? "yes" : "NO");
  Serial.print("  raw ax,ay,az=");
  Serial.print(ax); Serial.print(","); Serial.print(ay); Serial.print(","); Serial.print(az);
  Serial.print("  g=("); Serial.print(gx, 3); Serial.print(",");
  Serial.print(gy, 3); Serial.print(","); Serial.print(gz, 3); Serial.print(")");
  Serial.print("  pitch="); Serial.print(pitch, 1);
  Serial.print("  roll="); Serial.println(roll, 1);
}

// BLE RX callback fires from BLE task context. Keep it cheap: flip flags only.
void bleRxCallback(uint16_t /*conn_handle*/) {
  while (bleuart.available()) {
    int c = bleuart.read();
    if (c == 'z' || c == 'Z') rezeroRequested = true;
    else if (c == 'r' || c == 'R') reportRequested = true;
    else if (c == 'i' || c == 'I') imuDiagRequested = true;
    // ignore everything else -- protocol stays small on purpose
  }
}

void setup() {
  Serial.begin(115200);

  uint32_t serialWaitStart = millis();
  while (!Serial && (millis() - serialWaitStart) < 1500) {
    delay(10);
  }

  for (uint8_t i = 0; i < FSR_COUNT; i++) {
    pinMode(FSR_PINS[i], INPUT);
  }

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("MorphoGenixSOD");

  bleuart.begin();
  bleuart.setRxCallback(bleRxCallback);
  startAdv();

  Serial.println("MorphoGenix Phase 3: 4 FSR + IMU over BLE UART (binary v2, magic 0xA7)");
  Serial.print("Packet size: ");
  Serial.print(PKT_SIZE);
  Serial.println(" bytes");
#if IMU_LIB_AVAILABLE
  Serial.println("IMU path: Seeed_Arduino_LSM6DS3 library");
#else
  Serial.println("IMU path: direct I2C fallback (Wire, reg 0x28)");
#endif

  // ---- IMU init ----
  imuReady = imuBegin();
  Serial.print("IMU init: ");
  Serial.println(imuReady ? "OK (+/-2g, 26 Hz)" : "FAILED -- accel will report 0,0,0");

  // ---- Initial FSR baseline (device still / mouth relaxed for 2s) ----
  Serial.println("Capturing initial baselines (2s)...");
  captureBaselines();
  Serial.print("Baselines: ");
  for (uint8_t i = 0; i < FSR_COUNT; i++) {
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
    for (uint8_t i = 0; i < FSR_COUNT; i++) {
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
  if (imuDiagRequested) {
    imuDiagRequested = false;
    printImuDiag();
  }

  // ---- 10 Hz sample cadence ----
  uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  // ---- Sample all 4 FSR channels, subtract baseline, clamp ----
  uint16_t adc[FSR_COUNT];
  for (uint8_t i = 0; i < FSR_COUNT; i++) {
    int raw = readAveraged(FSR_PINS[i]);
    int corrected = raw - (int)baseline[i];
    if (corrected < 0) corrected = 0;        // clamp negative dips to 0
    if (corrected > 4095) corrected = 4095;  // 12-bit ADC ceiling
    adc[i] = (uint16_t)corrected;
  }

  // ---- Sample the IMU (raw int16 per axis, +/-2g) ----
  int16_t ax, ay, az;
  imuReadRaw(ax, ay, az);

  // ---- Serial debug -- human-readable, NOT the wire format ----
  Serial.print(now);
  for (uint8_t i = 0; i < FSR_COUNT; i++) {
    Serial.print(",");
    Serial.print(adc[i]);
  }
  Serial.print(",IMU,");
  Serial.print(ax); Serial.print(","); Serial.print(ay); Serial.print(","); Serial.print(az);
  Serial.println();

  // ---- Build the binary v2 packet ----
  uint8_t buf[PKT_SIZE];
  size_t off = 0;

  buf[off++] = PKT_MAGIC;
  buf[off++] = PKT_VERSION;

  // uint32 LE timestamp (nRF52 is LE-native; so are all our consumers).
  buf[off++] = (uint8_t)(now & 0xFF);
  buf[off++] = (uint8_t)((now >>  8) & 0xFF);
  buf[off++] = (uint8_t)((now >> 16) & 0xFF);
  buf[off++] = (uint8_t)((now >> 24) & 0xFF);

  buf[off++] = SENSOR_COUNT;   // 7 = 4 FSR + 3 accel

  // 4x uint16 LE FSR (post-baseline, 0..4095) -- byte-identical to v1's block.
  for (uint8_t i = 0; i < FSR_COUNT; i++) {
    buf[off++] = (uint8_t)(adc[i] & 0xFF);
    buf[off++] = (uint8_t)((adc[i] >> 8) & 0xFF);
  }

  // 3x int16 LE accel (signed; cast to uint16 for the byte split is safe and
  // bit-identical to the signed value in two's complement).
  int16_t accel[ACCEL_COUNT] = { ax, ay, az };
  for (uint8_t i = 0; i < ACCEL_COUNT; i++) {
    uint16_t u = (uint16_t)accel[i];
    buf[off++] = (uint8_t)(u & 0xFF);
    buf[off++] = (uint8_t)((u >> 8) & 0xFF);
  }

  // Checksum = XOR of every byte written so far.
  uint8_t xorSum = 0;
  for (size_t i = 0; i < off; i++) xorSum ^= buf[i];
  buf[off++] = xorSum;

  // ---- Send over BLE ----
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
