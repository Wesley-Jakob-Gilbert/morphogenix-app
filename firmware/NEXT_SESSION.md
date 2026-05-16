# Next session plan — binary protocol + op-amp

**Status entering this session:** Phase 2 working end-to-end. One FSR on A0
streams over BLE UART to the React Native web bench. Verified May 4, 2026
on Edge 147 / Win10 laptop + XIAO nRF52840 running
`phase2_palate_1ch.ino` rev3.

Two parallel goals for the next session, in order of priority:

1. **Binary wire format** — replaces the ASCII line protocol before we add
   more channels, because parsing ASCII at 3 channels x 10 Hz is asking for
   the kind of bug that costs you a week.
2. **Op-amp front-end** — the Build roadmap calls for an op-amp signal
   conditioning stage between the FSR voltage divider and the ADC. We
   should validate whether we actually need it before adding channels.

---

## 1. Binary wire format

### Why we're switching

ASCII at 1 channel was fine. At N channels with timestamp it's brittle:

| Channels | ASCII bytes/packet | Binary bytes/packet |
|----------|--------------------|---------------------|
| 1        | ~12 (`"12345,2847\n"`) | 6 (`uint32 + uint16`) |
| 3        | ~22 (`"12345,2847,1903,0044\n"`) | 10 (`uint32 + 3x uint16`) |
| 8        | ~52 | 20 |

A single BLE notification on the nRF52 carries ~20 bytes by default
(can negotiate up to 244 with MTU exchange). The moment our ASCII packet
exceeds the notification payload size, packets split across notifications
and our line-buffer parser starts being load-bearing. Binary keeps every
packet in one notification through 8 channels with MTU defaults.

Other reasons:

- **No parsing ambiguity.** Fixed offsets, fixed widths, byte-identical on
  both sides. The wire format becomes a struct, not a regex problem.
- **CPU savings on the XIAO.** `memcpy()` instead of `snprintf()` — about
  50x less work per packet. Lets us push the sample rate higher when we
  want to (e.g. clench events benefit from 50 Hz).
- **Endianness clarity.** We pick little-endian once, document it once,
  and never debate it again. nRF52 is LE-native; modern phones/laptops
  are LE-native. No conversion needed on either side.

### Proposed packet format (draft v1)

```
Offset  Size  Field
------  ----  --------------------------------------------------------
0       1     magic         = 0xMG (we'll pick the byte; placeholder)
1       1     version       = 0x01
2       4     timestamp_ms  uint32 LE, millis since XIAO boot
6       1     channel_count uint8, currently 1, will grow to 3 then more
7       N*2   adc_values    uint16 LE per channel, 0..4095
7+N*2   1     checksum      XOR of all preceding bytes (catches corruption)
```

Total size = 8 + 2N bytes. At N=3 that's 14 bytes — well inside one BLE
notification.

The magic byte + version + checksum are deliberate over-engineering for a
1-channel sketch. They cost us almost nothing now and save us hours when
the inevitable "is this a real packet or random NUS data?" bug shows up.

### Migration path

I'll set this up so we don't break the current working bench:

- Firmware: new sketch `phase2_palate_binary.ino` (parallel to the ASCII
  one). Same wiring, same NUS service, just a different payload format.
  We pick which one to flash; we can A/B them on the bench.
- Web: BleStreamer.js gains a `parseBinaryPacket()` next to the existing
  `emitPacketFromLine()`. A small magic-byte sniff at first-chunk decides
  which parser to use, so the bench works with either firmware without
  configuration. Saves us from a "did I flash the wrong sketch?" moment.

Estimated effort: ~2 hours for firmware + parser + bench retest.

---

## 2. Op-amp front-end

### What the Build roadmap says

The Notion roadmap mentions an op-amp signal-conditioning stage between
each FSR and the ADC. The question is: do we actually need one yet, or
can we keep the simple voltage divider through Phase 2?

### When you need an op-amp with an FSR

FSRs are variable resistors (typically ~10kΩ unloaded, ~200Ω fully
pressed). The standard read circuit is:

```
3V3 ──[FSR]──┬──> ADC
             │
            [R_pulldown]
             │
            GND
```

This works, but has three known weaknesses for our use case:

1. **Non-linearity.** Voltage at the ADC node follows
   `V_adc = 3V3 * R_pd / (R_FSR + R_pd)`. Plot that against pressure
   and you get a curve, not a line. For thresholded events (clench yes/no)
   this is fine. For continuous bio-feedback ("how hard is the tongue
   pressing right now?") it isn't, because the same pressure delta
   produces wildly different ADC deltas at different operating points.

2. **Input impedance loading.** The nRF52 ADC has ~1MΩ input impedance,
   which is fine in isolation, but if you ever mux multiple FSRs through
   the same ADC channel via an analog switch, the residual impedance of
   the switch interacts with the FSR resistance and you get
   channel-to-channel crosstalk. We aren't doing that today, but we will
   eventually.

3. **Noise floor.** A bare voltage divider couples power-supply noise
   straight into the ADC. With a single FSR on a battery-powered XIAO at
   bench, you don't see this. With three FSRs and a USB-powered XIAO near
   a laptop's switching supply, you will.

### What an op-amp buys us

A non-inverting buffer (unity-gain op-amp between divider and ADC) fixes
issue #2 for free — input impedance becomes the op-amp's, typically
10^12 Ω. No more channel-coupling concerns when we add the analog mux
later.

A transimpedance / instrumentation amplifier config can also LINEARIZE
the FSR response, but that's a deeper project — we'd need to characterize
each individual FSR to calibrate, and we'd need a real DC reference. Not
the right scope for the next session.

### My recommendation for the next session

**Add a unity-gain buffer op-amp per channel. Skip linearization for now.**

Concretely:

- Pick a rail-to-rail op-amp that runs from 3V3. Good cheap options:
  MCP6004 (quad, ~$0.50), OPA4197 (better noise, ~$3), MAX44245 (low
  offset). Quad packages let us buffer all 3 FSRs from one chip.
- Wire each FSR's divider node into the + input of one op-amp; tie the
  output back to the - input (unity buffer); op-amp output goes to the
  XIAO ADC pin.
- This gives us clean isolation between the sensor network and the MCU,
  so when we add the analog mux for >3 channels, the channel selector
  doesn't see FSR impedance.

Estimated effort: ~1 hour breadboarding + retest with binary protocol.

If you only have time for one of the two next session, do the binary
protocol first. The op-amp is an enabler for channels 4+; it doesn't
unlock Phase 2 functionality.

---

## Pre-session checklist

When you start the next session, paste this in:

> Reload context, then check:
> - [ ] develop branch is up to date locally
> - [ ] morphogenix-app.fly.dev/demo/?live=ble still works with current
>       firmware (sanity: connect, see palate respond to squeeze)
> - [ ] morphogenix.ai/demo still shows fake-data demo
>
> Then pick: binary protocol OR op-amp prototype.

This way no matter how long until next session, we re-validate both ends
of the working state before we touch anything.

---

## Channel-naming contract (single source of truth)

| Wire index | Logical channel    | Anatomical region        | XIAO pin |
|------------|--------------------|--------------------------|----------|
| `adc[0]`   | `FSR_PALATE_CENTER`| Hard palate, midline     | A0       |
| `adc[1]`*  | `FSR_PALATE_LEFT`  | Hard palate, left side   | A1       |
| `adc[2]`*  | `FSR_PALATE_RIGHT` | Hard palate, right side  | A2       |

\* not yet wired; reserved positions for the next-session work.

Mirrored in:
- `firmware/phase2_palate_1ch/phase2_palate_1ch.ino` (CHANNEL MAP comment)
- `src/services/streamer/BleStreamer.js` (`CHANNEL_MAP` constant)

If you change one, change the other in the same commit.
