# Project Context: Zonai Lantern Controller

## Overview
This project is a Tears of the Kingdom (Zonai/Shrine) themed controller for a 3D-printed lantern. A Raspberry Pi Pico (RP2040) drives a 16-LED NeoPixel ring, and a single-file web UI communicates with the device over Web Serial. The UI includes a stylized controller app plus a multi-panel narrative sequence that sets the scene before handing off to the controls.

## Current Functionality
### Firmware (CircuitPython)
- `code.py` runs on the Pico and listens on `usb_cdc.data` for newline-delimited JSON.
- State is stored in RAM and persisted to NVM as JSON to survive power loss.
- Modes: solid, fade (single or dual color), snake (single/dual/rainbow).
- Color correction uses gamma and a white balance tuple.

### Main Controller UI
- `index.html`, `styles.css`, `main.js` host the main lantern control experience.
- Custom sliders, a battery visualizer, and a stylized lantern render.
- Web Serial connect/disconnect logic, state sync, and demo mode are supported.
- Visualizer matches firmware math via requestAnimationFrame.

### Panel Sequence (Narrative)
Panels are consolidated into a single page for easier transitions and effects.
- Files: `Panels/panels.html`, `Panels/panels.css`, `Panels/panels.js`
- WebGL background effects: `Panels/background-manager.js` (Curtains.js, masked ripple).
- Panel 10 embeds the main app subset via `Panels/panel10_app.css` and `Panels/panel10_app.js`.

### Panel Flow (current)
- Panel 1: Title screen with menu.
- Panel 3: Steward Construct dialog with name entry popup and typewriter text.
- Panel 4: Link walking sequence, auto-advance.
- Panel 6: Blessing text (fade/deblur/blur) then Link walk, auto-advance.
- Panel 7: Chest + Link, open chest -> reward popup -> typewriter -> "Complete shrine".
- Panel 8: Purah dialog with Yes/No choices; both lead to Panel 10.
- Panel 10: Main lantern control UI.

### Shared Interaction Patterns
- Typewriter text is used for dialog and reward descriptions.
- Buttons appear after typewriter completion.
- Panel 3 name entry uses a modal popup and stores name in title case.
- Panel 7 has a staged chest open with delayed reward popup and follow-up button.

## Structure at a Glance
- `index.html`, `styles.css`, `main.js`: main controller app.
- `Panels/panels.html`: all panels in one page.
- `Panels/panels.css`: shared panel styling, 16:9 stage layout, button styles, effects.
- `Panels/panels.js`: panel state machine, typewriter logic, panel-specific sequences.
- `Panels/background-manager.js`: WebGL ripple background and masking.
- `Panels/panel10_app.css`, `Panels/panel10_app.js`: scoped main app for panel 10.
- `images/`: panel backgrounds, UI assets, Link sprites, chest sprites.

## Roadmap (from Panels/ToDo.md)
- Panel 7: fix scaling and movements.
- After name entry, add “Continue” above “New Game” on Panel 1.
  - “New Game” clears the saved name and replays the storyboard.
    - Implement a pop-up for "New Game" when another "game" already exists (meaning the user has already entered their name previously). Replicate the pop=up from the index.html when asking about resetting)
  - “Continue” skips directly to Panel 10.
- Panel 8: Don't display the buttons again after having selected yes or no.
- Panel 10: add helper walkthrough modals with an “i” icon to replay, only auto-run on first visit.
- Confirm whether `index.html`, `styles.css`, and `main.js` can be retired once Panel 10 fully replaces them.
- Ensure all images use WEBP instead of PNG.
- Clean up panel numbering; finalize by moving panels into main folder and renaming `panels.html` to `index.html`.
- Add a simple card that explains how to get to the GitHub Code page before the present is opened.


## Notes
- The stage is constrained to a 16:9 aspect ratio up to 1920x1080.
- Background effects are masked so ripples are visible only near edges.
- Version comments are updated when HTML/CSS/JS changes.
- `index.html`, `styles.css`, and `main.js` are expected to become obsolete as Panel 10 fully replaces them.
