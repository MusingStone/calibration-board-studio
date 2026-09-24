# Contributing

[简体中文](CONTRIBUTING.zh-CN.md) · English

Issues and pull requests are welcome. Keep physical geometry in millimeters, and document the detector convention behind any marker or layout change. Discuss problems in the open; report a security issue privately through the maintainer's GitHub profile rather than in a public issue.

## Local checks

```bash
npm ci
npm run build
```

| Command | What it does |
| --- | --- |
| `npm run build` | TypeScript checks plus the Vite production build |

Regenerate `src/data/markers.json` with `python3 scripts/generate_markers.py` only when marker data must change; review the diff before committing.

## Adding or changing a target

1. Add or update a `BoardPlugin` in `src/core/plugins.ts`: parameter fields, defaults, `size`, `generate`, `validate`, and `annotation` / `metadata` where useful.
2. Generate primitives in board-local millimeter coordinates. Marker cells and border bits must match the codeword and bit order the target detector expects. Never depend on preview pixels or screen zoom.
3. Define the origin and ID ordering explicitly. When the detector has a fixed convention, make it the default and explain other choices in the UI and the docs.
4. Provide `markers(params)` as `{ id, x, y, size }` entries when the target carries coded markers: the ID overlay draws from it, and `gridSpots` / `charucoIds` / `aprilSpots` show how to share one layout with `generate` so the pattern and its numbers cannot drift apart. Mark single markers with `single: true` and let a `zAxis` field pin their frame.
5. Keep default sizes and row/column counts small enough that the pattern plus its axes and label fit a landscape A4.
6. Update both READMEs when a user-facing capability or limitation changes.

Detector conventions in short: an ArUco marker uses OpenCV's frame (X right, Y up, Z out); a single AprilTag is printed in the official AprilRobotics orientation, where the AprilTag library reports X right, Y down, Z into the marker; both are right-handed and differ by a 180° rotation about X. ChArUco's default first square is an ArUco marker (OpenCV before 4.6 / `setLegacyPattern(true)`). The Kalibr AprilGrid detector assumes tag36h11 with a bottom-left origin — verify any other family or origin against the intended detector before shipping it as a default.

## UI changes

- Visible copy lives in `src/i18n.tsx`. Update the `english` dictionary for single strings, and the regex chain in `translateText` for strings built from values (counts, layer names, relations). Note that `translateText` handles `名称：详情` **before** the regex chain, so a composed sentence should use ` · ` rather than a full-width colon, or it will bypass your rule.
- Keep panels as their own components — `LayerPanel`, `LayoutPanel`, `LayoutTools`, `DimensionInspector` — to keep their responsibilities clear.
- The inspector shows the page settings only while nothing is selected; object panels belong to their object.
- Keep board geometry independent from the axes, parameter-label, and ID child layers, and make sure the canvas and every export path read the same scene data.
- Keep the core modules pure: `snap.ts`, `naming.ts`, `paper.ts`, `layout.ts`, and the geometry helpers in `scene.ts` and `plugins.ts`.
- Keep `README.md` and `README.zh-CN.md` parallel: same sections, same order, both updated in one change.

## Project schema

`src/core/model.ts` is the source of truth; `src/core/project.ts` validates imports against it, including every plugin field, the three child layers, and optional dimension styling. When the schema changes, bump `documentVersion` — no migration is provided, and files with another version are rejected.

## Dependencies and attribution

Check the terms of any dependency or asset before adding it. The masthead is an original SVG drawn in code. Record the source and license of a new codebook, image, logo, or font in `THIRD_PARTY_NOTICES.md`. A dependency that ends up in the bundle must also be listed in `scripts/generate_notices.mjs`; run `npm run notices` to refresh `public/third-party-notices.txt`, which the build copies into `dist/`.

## Pull request notes

Describe the user-visible change, the detector or coordinate convention involved, and the checks you ran. Include before/after screenshots for visual changes and a sample export when changing PDF, SVG, or PNG rendering.
