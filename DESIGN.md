# Design System: Industrial Design Workbench

<!-- impeccable:design-tokens 1 -->

## World Thesis
The **Industrial Design Workbench** treats screenshot framing not as marketing clipart, but as precision darkroom metrology and digital fabrication. Inspired by high-end audio instruments (Teenage Engineering, Braun, Dieter Rams) and precision developer workstations (Linear, Raycast), the interface is tactile, disciplined, and deliberately mechanical.

## Color Palette

### Ground & Surfaces
- **Workbench Void (Base):** `#090a0c` — Deepest anodized obsidian.
- **Surface Elevation 1 (Milled Panel):** `#111317` — Primary surface for containers and control wells.
- **Surface Elevation 2 (Raised Rig):** `#181a1f` — Floating stages, cards, and canvas backdrops.
- **Surface Active / Hover:** `#20232a` — Tactile reaction state.

### Boundaries & Rules
- **Hairline Border:** `#22252c` — Precision structural boundary (1px).
- **Subtle Highlight Edge:** `#2f333d` — Top-lit bevel simulation for physical tactile feel.
- **Active Focus Ring:** `#ff6b35` — Tactical industrial amber-orange (used with strict restraint).

### Typography & Content
- **Primary Ink:** `#f4f5f7` — Crisp high-contrast white.
- **Secondary Ink:** `#8e94a0` — Technical gray for metadata, descriptions, and labels.
- **Muted Ink:** `#555a64` — Subdued indicators, shortcut keys, and timestamps.

## Typography
- **Display & Headings:** System geometric grotesque (`system-ui`, `-apple-system`, `BlinkMacSystemFont`, `'Segoe UI'`, sans-serif) set with tight letter-spacing (`tracking-tight` / `-0.03em`), deliberate line-height, and bold weights.
- **Technical & Metrics:** Tabular numerals with strict alignment; monospace font (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, monospace) reserved strictly for keyboard shortcuts, resolution specs, and dimensions.

## Layout & Structure
- **No Floating Blobs / Gradient Text:** Refuse generic AI-slop colorful gradient headline text. Emphasis comes from typographic scale, contrast, and layout weight.
- **No Identical Cards:** Content is structured hierarchically using functional asymmetric panels, workbench dividers, and tactile control wells.
- **No Fake Number Badges:** Process is represented as an intuitive linear workbench stage rather than arbitrary `1, 2, 3` gradient circles.

## Elevation & Depth
- Single-point top-light elevation with deep, subtle multi-stop drop shadows on frames:
  `box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06);`
