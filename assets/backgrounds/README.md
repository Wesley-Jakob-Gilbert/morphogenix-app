# Swiss Alps Backgrounds

These assets show Oeschinen Lake in Switzerland.

## Files

| Files | Description | Pixel sizes |
| --- | --- | --- |
| `mountains.jpg`, `mountains@2x.jpg`, `mountains@3x.jpg` | Sharp portrait background in JPEG format. React Native selects the appropriate density automatically. | 390×843, 780×1686, 1170×2529 |
| `mountains.webp`, `mountains@2x.webp`, `mountains@3x.webp` | Sharp portrait background in WebP format, encoded at quality 85. | 390×843, 780×1686, 1170×2529 |
| `mountains-soft.jpg`, `mountains-soft@2x.jpg`, `mountains-soft@3x.jpg` | Soft/blurred portrait background in JPEG format. | 390×843, 780×1686, 1170×2529 |
| `mountains-soft.webp`, `mountains-soft@2x.webp`, `mountains-soft@3x.webp` | Soft/blurred portrait background in WebP format, encoded at quality 85. | 390×843, 780×1686, 1170×2529 |
| `mountains-landscape@3x.jpg` | Sharp landscape-phone crop in JPEG format. | 2529×1170 |
| `mountains-landscape@3x.webp` | Sharp landscape-phone crop in WebP format, encoded at quality 85. | 2529×1170 |

## React Native usage

Reference the base-density file; React Native automatically chooses the `@2x`
or `@3x` sibling for the device density:

```tsx
const background = require('./assets/backgrounds/mountains.jpg');
```

Use `mountains-soft.jpg` for the blurred treatment. WebP can be referenced in
the same way by requiring `mountains.webp`. The landscape assets are provided
at `@3x` only and should be required by their full filenames.

## Source and licensing

Source photograph: iStock photo 1351540765, Oeschinen Lake, Switzerland.

The user downloaded the source photograph from iStock. These derivative assets
remain subject to the applicable iStock license terms and must not be used
outside the scope of that license.
