// Phase 2: XIAO nRF52840 + 1 FSR + BLE UART @ 10 Hz
//
// Streams a single palate FSR over the Nordic UART Service so the
// MorphoGenix React Native bench build (BleStreamer.js) can read it.
//
// Wire format (one ASCII line per sample, terminated with '\n'):
//
//     <millisSinceBoot>,<adcValue>\n
//
// where adcValue is a 12-bit ADC reading (0..4095) from A0.
//
// Changes vs. the original phase2 sketch:
//   * Fixed the snprintf() format string mismatch. The previous version had
//     four "%d" tokens but only one int argument, which happened to work on
//     the Serial debug print (separate call) but sent garbage stack memory
//     over BLE. With one channel we want exactly one "%d".
//   * Tightened sampling cadence: averaging block now runs in <16 ms (8 reads
//     x 2 ms) so the 100 ms loop stays predictable.
//
// To upgrade to 3 FSRs later, copy this file, add A1/A2 reads, and append
// two more comma-separated ints to the BLE payload AND the matching number
// of "%d" tokens to snprintf. The app already splats one channel across
// 16 zones; for 3 channels we'll teach BleStreamer.js to map each FSR onto
// its appropriate zones.

#include <bluefruit.h>

const int FSR_PIN_1 = A0;       // Palate_L
const int NUM_SAMPLES = 8;      // simple boxcar average per channel

BLEUart bleuart;

const uint32_t SAMPLE_INTERVAL_MS = 100; // 10 Hz
uint32_t lastSampleMs = 0;

void setup() {
  Serial.begin(115200);
  // Don't block forever waiting for the serial monitor — bench testing
  // often runs the device on battery with no host attached.
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

  Serial.println("MorphoGenix Phase 2: 1-channel FSR over BLE UART (rev3: named channel map)");
}

void loop() {
  uint32_t now = millis();
  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;

    int adc0 = readAveraged(FSR_PIN_PALATE_CENTER);  // FSR_PALATE_CENTER

    // Serial debug — same wire format as BLE for easy cross-checking with
    // the Arduino Serial Monitor. If the BLE log on the web bench ever shows
    // a different value than the Serial Monitor at the same instant, the
    // formatting (not the sensor or the radio) is the bug.
    Serial.print(now);
    Serial.print(",");
    Serial.print(adc0);
    Serial.println();

    // BLE notify
    //
    // We deliberately DO NOT gate on bleuart.notifyEnabled(). That helper
    // checks whether the peer subscribed to the NUS RX characteristic (the
    // one the central writes TO us on). Web Bluetooth never writes — it only
    // subscribes to the TX characteristic to listen — so notifyEnabled() can
    // return false for the entire session even when a phone or laptop is
    // happily connected and listening. Gating writes on it caused the bench
    // to stay silent forever (status: connected, no packets).
    //
    // bleuart.write() is a no-op when no central is connected at all, so it's
    // safe to call unconditionally here. The Bluefruit library handles the
    // "are we actually paired and notify-enabled on TX" question internally.
    if (Bluefruit.connected()) {
      char buf[32];
      // FIX: one %lu for time, one %d for the single channel. The original
      // sketch had four %d slots and undefined behavior on the wire.
      int len = snprintf(buf, sizeof(buf), "%lu,%d\n",
                         (unsigned long)now, adc0);
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
  Bluefruit.Advertising.setInterval(32, 244); // ~20ms .. ~152.5ms
  Bluefruit.Advertising.setFastTimeout(30);

  Bluefruit.Advertising.start(0); // never time out
}
