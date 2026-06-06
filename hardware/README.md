# MorphoGenix Hardware

CAD, scans, and print assets for the MorphoGenix smart oral device.

## Directory layout

```
hardware/
├── scans/              Raw 3D scans of plaster palate masters (.obj, .ply, .stl)
│   └── plaster_palate_v1/   First plaster master (June 2026, alginate impression)
├── cad/                Working CAD source files (.blend, .f3d, .step)
├── print/              Print-ready exports for resin/FDM (.stl, .3mf)
├── reference/          Anatomical references, photos, dimension notes
└── README.md           This file
```

Workflow: **scans/** is raw input. **cad/** is the editable source. **print/** is the compiled output handed to a printer. Treat scans + cad as the canonical source; print/ is regenerable.

## Product line

Two product variants share the same hardware platform but differ in form factor priorities:

| Variant | Use case | Wear time | Priorities |
|---|---|---|---|
| **Wellness** | Sleep tracking, bruxism monitoring | 6-8 hr overnight | Thin, comfortable, palate + molar coverage, low-power BLE |
| **Clinical** | Craniofacial research, orthodontic monitoring | Variable, supervised | Durable, higher sensor density, palate + molar coverage |

**Both variants include molar coverage** for bruxism / grind-event tracking. The sensing layout differs (wellness optimized for grind event detection, clinical optimized for force mapping).

## Current iteration: v2 design

**Goal:** Smaller, cleaner than the v1 monster-clay-molded prototype. Resin-printed mold (via friend's resin printer) replaces hand-sculpted clay buck.

**Target FSR count:** 4 (2 molar + 2 palate) for wellness variant. See firmware/phase2_palate_4ch_calibrated/ for matching firmware.

**Materials:**
- Mold print: Phrozen Aqua-Gray 4K resin (rigid, high detail)
- Device pour: Ecoflex 00-10 (palate basin) + Dragon Skin 10 (molar perimeter)
- Electronics: Seeed XIAO nRF52840 Sense + LiPo, both in labial flap (outside oral cavity)

**NOT biocompatible.** Current resin/silicone stack is bench/personal-prototype only. Future intraoral testing on non-self subjects requires dental-grade biocompatible materials (Formlabs Dental, KeyStone KeySplint Soft, or equivalent).

## Scanning workflow

1. Capture plaster master with Polycam, Kiri Engine, or dental lab scan
2. Export OBJ or STL into `scans/<master_name>/raw/`
3. Clean mesh in Blender (decimate, smooth, manifold fix, hole fill)
4. Save cleaned mesh as `scans/<master_name>/clean.stl`
5. Reference the clean STL as input to the CAD shell design in `cad/`

## CAD workflow

Primary tool: **Blender** (organic surface modeling, boolean operations, fast iteration).

- Working source: `.blend` files in `cad/`
- Export to STL into `print/` when ready for printer handoff
- Standard modifier stack: Solidify (wall thickness) + Boolean (sensor wells + wire channels)
- Common shell thickness: 1.5-2 mm (soft silicone receiving cavity)

See `cad/CAD_NOTES.md` (TBD) for documented design decisions and known issues.

## Git LFS

Binary asset directories use Git LFS to avoid bloating the repo:
- `*.blend` (Blender source files, often 10-200 MB)
- `*.stl`, `*.obj`, `*.ply`, `*.3mf` (mesh exports, often 5-50 MB)
- `*.f3d`, `*.step`, `*.stp`, `*.iges` (CAD exchange formats)

To clone with LFS:
```sh
git lfs install
git clone <repo>
```

Existing clones need `git lfs pull` after the LFS install.

## File naming convention

- Versioned: `<name>_v1.blend`, `<name>_v2.blend`, etc.
- Dated for scans: `<master_name>_<YYYYMMDD>.obj`
- Variant suffix: `_wellness` or `_clinical` when designs diverge

## Status (as of June 6, 2026)

- [x] First plaster master created (alginate impression, May 2026)
- [x] First device prototype molded (Monster Clay buck + Dragon Skin 10 mold, May 2026)
- [ ] Plaster master scanned (next step — Polycam / Kiri Engine)
- [ ] Scan cleaned in Blender
- [ ] v2 device shell CAD
- [ ] First resin-printed mold
- [ ] First silicone pour from printed mold
