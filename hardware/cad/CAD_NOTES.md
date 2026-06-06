# CAD Design Notes

Living document for Blender modeling decisions and gotchas on the device shell + mold designs.

## Tooling
- **Primary:** Blender (organic surfaces, boolean ops, fast iteration)
- **Future:** Fusion 360 (parametric CAD if/when manufacturing tooling is needed)
- **Mesh repair:** Meshmixer (Autodesk, free) as a backup for hole-filling and inspection

## Standard modifier stack for shell designs

1. **Decimate** (Planar, ratio ~0.3) -- reduce raw scan polycount before working
2. **Smooth** (sculpt-mode brush, not modifier) -- knock down photogrammetry noise
3. **Solidify** -- give the shell its wall thickness (1.5-2 mm typical)
4. **Boolean (Difference)** -- subtract sensor wells, wire channels
5. **Apply all modifiers** before STL export -- the slicer won't see modifiers

## Boolean reliability checklist

Booleans fail silently on dirty meshes. Before every boolean operation, verify on BOTH input objects:

- [ ] No non-manifold edges (Edit Mode -> Select -> All by Trait -> Non Manifold)
- [ ] No duplicate vertices (Merge by Distance, 0.0001 threshold)
- [ ] Consistent normals (Mesh -> Normals -> Recalculate Outside, then check Face Orientation overlay -- everything blue)
- [ ] No interior faces

If a boolean produces a broken result, 95% of the time it's mesh hygiene, not Blender.

## Wall thickness targets (current)

| Region | Thickness | Reasoning |
|---|---|---|
| Palate-contact face | 1.0-1.5 mm | Conforming, comfortable, FSRs sense through this |
| Molar occlusal | 2.0-2.5 mm | Bite force tolerance, grind resistance |
| Lateral walls | 1.5-2.0 mm | Retention without bulk |
| Labial flap | 3.0-4.0 mm | Houses MCU + LiPo, structural |

## Sensor well dimensions (current)

Each FSR well is a cylindrical subtraction sized to receive the FSR sensing element:
- **FSR model:** Interlink 402 (12.7 mm round sensing area, ~0.5 mm thick)
- **Well diameter:** 13.5 mm (0.4 mm radial clearance for placement tolerance)
- **Well depth:** 0.7 mm (sensing element + small adhesive layer)
- **Wire channel:** 1.5 mm wide x 1.0 mm deep groove from well to flap exit

## Channel layout (wellness variant, 4ch)

| Sensor | Anatomical position | Approx coords (palate-frame) |
|---|---|---|
| Molar_L  (A0) | Left posterior occlusal, on first molar bite surface | TBD post-scan |
| Molar_R  (A1) | Right posterior occlusal, mirror of L | TBD post-scan |
| Palate_L (A2) | Left mid hard palate, ~1cm lateral of midline | TBD post-scan |
| Palate_R (A3) | Right mid hard palate, mirror of L | TBD post-scan |

Update these coordinates once the palate scan is loaded and a coordinate frame is established.

## Naming convention

```
<variant>_<part>_v<n>.blend
```

Examples:
- `wellness_shell_v1.blend`
- `wellness_mold_v1.blend`
- `clinical_shell_v1.blend`

When exporting STL for printing, match the source filename:
- `wellness_mold_v1.blend` -> `print/wellness_mold_v1_top.stl` + `print/wellness_mold_v1_bottom.stl`

## Known issues / open questions

- Optimal palate-contact thickness for sleep comfort: untested, 1.0 mm is a guess. Iterate.
- Molar coverage: occlusal pad geometry needs anatomical reference -- consider adding upper-arch bite registration to next plaster master.
- Mold draft angle: resin printer can hold steep walls but silicone demolding needs 2-3 degree draft minimum. Apply during shell design, not post-hoc.

## Don't break the demo

The web app at morphogenix.ai/demo (master branch) is sacred. Hardware changes do not touch master without firmware + bench co-validation.
