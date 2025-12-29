# Copilot / Agent Instructions — Shrine Battery

Summary
- Small static web UI to control a "Zonai Lantern" (Shrine Battery) using the Web Serial API in the browser.
- No build system; source is plain HTML/CSS/JS. Primary file to change is `index.html` (UI + controller logic). `battery_UI.html` is a smaller visualizer/demo.

Big picture and key files
- `index.html` — single-page app that hosts the UI, serial I/O, state model (`appState`) and visualizer. Agents should read this first.
  - UI + state are kept in the page (no frameworks). JS is imperative and manipulates DOM directly.
  - Core functions: `sendRaw(payload)`, `sendData(save)`, `parseJSON(text)`, `readLoop()` and `enableControls(state)`.
- `battery_UI.html` — visualizer / prototype. Useful for CSS/CSS-variable examples and quick visual tests (color-picker and CSS vars `--glow-*`).
- `images/` — static assets (battery, overlays, etc.). Update when adjusting visual assets.

Runtime / integration details (critical)
- Communication: Browser Web Serial API (navigator.serial).
  - Connect path: user clicks "Connect" -> `navigator.serial.requestPort()` -> `port.open({ baudRate: 115200 })`.
  - Text streams used: `TextEncoderStream` / `TextDecoderStream`; device messages are newline-delimited text.
- Serial message format: JSON objects sent as single-line strings (one object per newline). Code extracts JSON via substring between first `{` and last `}`.
  - Example state request from UI: {"get_state": true}
  - Example full state sent to device: {"mode":"solid","solid_color":[255,230,0],"solid_bright":0.8}
  - Incoming device responses should be JSON objects (the app merges them into `appState` using `Object.assign`).
- Offline/demo mode: Click the yellow demo button (bottom-left after intro) to toggle a local-only visual mode: UI still works and the visualizer uses `appState` but no serial I/O.

App state shape (examples and authoritative keys)
- Top-level `appState` keys the UI expects (non-exhaustive):
  - `mode` ("solid"|"fade"|"snake")
  - `solid_color` (RGB array), `solid_bright` (0..1)
  - `fade_color`, `fade_color_2`, `fade_use_2`, `fade_min`, `fade_max`, `fade_speed`
  - `snake_color_mode` ("single"|"rainbow"|"gradient"), `snake_color_1`, `snake_color_2`, `snake_cw`, `snake_speed`
- When updating state externally, send keys using the same shapes; the page merges incoming JSON and updates UI via `drawControls()`.

Developer workflows & testing tips
- No build: edit `index.html` and refresh the page.
- Web Serial requires a secure context. For local testing use a local server (example):
  - Python: `python -m http.server 8000` and open `http://localhost:8000/` in Chrome/Edge.
  - VSCode Live Server or similar will also work.
- If you don't have a device: use Demo Mode (toggle the offline button) or open `battery_UI.html` for quick visual CSS testing.

Conventions & patterns an agent should follow
- Keep changes minimal and localized: the project is a compact single-file app—prefer small, well-contained edits in `index.html` unless adding a new component.
- UI state and serialization are authoritative: prefer updating `appState` and calling `sendData(true)` instead of trying to mutate DOM directly where possible.
- JSON-over-serial is newline-delimited; ensure device messages are valid JSON objects or the parser will ignore them.
- Use the `enableControls(state)` / `drawControls()` helpers when changing how UI elements are shown or enabled.

Debugging pointers
- Console logs: add console.debug / console.log in `readLoop()`, `parseJSON()` and `sendRaw()` to capture serial traffic.
- To reproduce connection problems: ensure the site is served over `localhost` and test in Chrome/Edge (they expose `navigator.serial`). The UI alerts "Use Chrome/Edge." if `navigator.serial` is undefined.
- When testing color/visual updates, `--glow-rgb` and `--glow-opacity` CSS vars drive the visualizer.

Safety and scope
- This repository is primarily a client-side web UI paired with a small device firmware component; keep PRs small and review for regressions by manual browser testing.

WiFi Migration (Pico W) — Overview
- Goal: support both USB and WiFi control. The Pico W should host a lightweight HTTP API + mDNS while continuing to accept JSON over USB serial. The UI should detect the environment and switch communication automatically (or expose a toggle for debugging).

Firmware requirements (high-level)
- Serve `index.html` (or redirect heavy assets to a CDN when storage-limited).
- API endpoints (suggested):
  - GET `/state` — return full JSON `appState`.
  - POST `/state` — accept partial or full state updates (merge and apply immediately).
  - POST `/wifi` — accept `{ssid, pass}`, persist to NVM (or config file) and attempt connection, return connection result including the device IP (e.g., `{ok:true, ip: "192.168.x.y"}`).
  - GET `/health` — simple status for debugging.

Additional frontend notes:
- The UI includes a WiFi modal to submit credentials. The UI attempts `/wifi` via HTTP first (including trying a stored device IP or `zonai.local`) and falls back to sending `{wifi:{ssid,pass}}` over serial if only USB is available.
- The app now stores a detected device IP in `localStorage` (`device_ip`) and uses it to prioritize fetches to `http://<device_ip>/state` before attempting `zonai.local` or relative `/state`.
- A local mock server (`mock_server.py`) is included for dev testing (see README).
- Device discovery: implement mDNS/Bonjour so the device can be found as `zonai.local` (or fall back to IP address).
- Non-blocking operation: run animations and network/serial handlers cooperatively (use `uasyncio` or a tight cooperative loop with socket timeouts) so LEDs never freeze during HTTP handling.
- Persistence: store WiFi credentials and last known `appState` in NVM or a small config file so state survives reboots.
- Integration: apply incoming serial commands to the same state object the web server reads/writes so USB and WiFi are a single source of truth.

Frontend changes (practical guidance)
- Environment detection:
  - If `location.protocol` startsWith('http') treat as server-hosted (WiFi) mode; otherwise treat as local/file (USB-focused) mode.
  - Prefer Web Serial when `navigator.serial` is available and a port is opened; otherwise use HTTP fetch to device IP or `zonai.local`.
  - Add a UI toggle to force Serial / HTTP for debugging.
- Comms abstraction:
  - Add a small `comms` module with `sendState(save)` and `requestState()` that delegates to either Serial (existing `sendRaw`/`sendData`) or to `fetch('/state')` and `fetch('/state', {method:'POST', body:JSON.stringify(...)})`.
  - Keep payload shapes identical to current JSON-over-serial so firmware only needs a single unified handler.
- Asset management:
  - Add an `ASSET_BASE` variable; when in WiFi mode set it to your GitHub Pages or CDN URL (e.g., `https://<user>.github.io/shrine-battery/`) and prefix image URLs with it.
  - When running from USB or local file, fallback to relative `images/` paths.
- WiFi configuration UI:
  - Add a small modal or section to collect SSID and password and POST to `/wifi` (or send `{wifi:{ssid,pass}}` over Serial for USB mode).

Testing & debugging notes
- iOS/Safari: mDNS may be unreliable; test via device IP (http://192.168.x.y) if `zonai.local` fails.
- Emulation: stub `fetch('/state')` responses locally to validate UI behavior without firmware.
- Firmware tests: verify non-blocking animation during simultaneous HTTP requests; check NVM persistence after reboot; test `/wifi` success/failure handling and status reporting.
- Logging: add `/logs` or `/health` endpoints and serial debug prints to speed diagnosis.

Suggested incremental tasks (small PR checklist)
1. Add this "WiFi Migration" section to docs (done).
2. Implement a comms abstraction in `index.html` and a debug toggle (small PR).
3. Prototype a minimal HTTP GET `/state` and static file server on the Pico W firmware (hardcoded state initially).
4. Add POST `/wifi` and persistent storage of credentials.
5. Implement mDNS responder and validate discovery on desktop and iOS.
6. Add CDN asset serving and `ASSET_BASE` switch in JS.
7. Integrate and test seamless switching between Serial and HTTP in the UI.

Files to inspect / update
- `index.html` — add comms abstraction, WiFi UI elements, and `ASSET_BASE` logic.
- `battery_UI.html` — helpful visual reference for CSS vars and small-asset testing.
- Firmware (new or existing CircuitPython file) — implement HTTP API, mDNS, non-blocking loop, NVM storage.

If anything here is unclear or you want more detail (firmware code sketches, `fetch` examples, or a step-by-step migration PR plan), tell me which part and I will expand or produce example code. ✅