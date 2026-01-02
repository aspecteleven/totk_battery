# Project Context (Index Version)

## Overview
This version focuses on the single-page controller experience in `index.html`.
It includes an intro sequence for name entry and the full lantern control UI.
The multi-panel storyboard work is preserved in `Panels/` but is not part of the current scope.

## Current Behavior
### Intro Flow
- Shows a symbol and typewriter welcome prompt.
- User enters a name, stored in `localStorage` under `zonai_user`.
- The intro text highlights "Zonai Lantern" and reveals a Continue button.
- Continue fades to the main app and reveals the Demo/Offline button.
- A custom reset modal allows clearing the saved name and replaying the intro.

### Main App Flow
- USB Web Serial connect/disconnect logic (Chrome/Edge).
- Offline/Demo mode toggles controls without hardware.
- UI state syncs with the device via JSON over serial.
- Custom sliders and controls for Solid/Fade/Snake modes.
- Visualizer runs firmware-matching math and drives the glow via CSS variables.

## Key Files (in scope)
- `index.html` - main app layout (intro + controller UI).
- `styles.css` - full UI styling (intro, app layout, visuals).
- `main.js` - intro logic, Web Serial handling, UI controls, visualizer.

## Notes
- Versions are displayed in `index.html` via the `.version` element.
- The `Panels/` directory is intentionally kept for other projects but is not used here.
