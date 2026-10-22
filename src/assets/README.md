# Delta identity

`delta-mark.svg` is the editable vector master: two offset blue shapes forming
an open delta. The sidebar uses its silhouette as a CSS mask, inheriting the
current theme's accent color.

Run `npm run icons` after changing the master. The script derives the macOS tile
and regenerates every platform icon with the installed Tauri CLI:

- `delta-tile.svg` and `src-tauri/icons/macos-icon.png`: neutral macOS tile, with
  an 824px body centered on a transparent 1024px canvas (412px on the 512px Dock PNG).
- `src-tauri/icons/icon.icns`: macOS app bundle; the Dock override uses the tile PNG.
- Remaining PNG, ICO, Windows Store, Android and iOS files: platform outputs.
- `delta-icon.png`: raster copy of the transparent mark.
- `public/delta-icon.svg` and `public/favicon.png`: browser favicons.

Files under `src-tauri/icons/concepts/` are historical explorations and are not
referenced by the app.
