Testing & verification checklist

1) Local frontend smoke test (no hardware)
 - Run: `python mock_server.py`
 - Serve the UI locally: `python -m http.server 8000`
 - Open `http://localhost:8000/` in Chrome/Edge
 - Set *Comms Mode* to `HTTP` and click **Ping** — status should show device responding.
 - Open **WiFi** modal and try a credentials POST; mock server will respond with `ok` and IP.
 - Try changing controls and ensure POST /state is called (mock server will accept and respond).

2) Pico W basic test
 - Copy updated `code.py` to a Pico W running CircuitPython.
 - If the device has `/wifi.json` creds, it will attempt to connect and start the server.
 - Use the page (served via `python -m http.server`) and set Comms Mode to HTTP. Click **Ping** or use WiFi modal to configure.
 - Verify GET /state returns device state and POST /state updates LEDs. Use `{ "save": true }` to persist.

3) USB (Web Serial) test
 - Open the page locally in Chrome/Edge and use **Connect** (Web Serial).
 - Confirm UI syncs when connecting and that changing controls sends JSON via USB (watch the device serial logs).

4) Edge cases
 - Test with no network / no device to ensure status messages show "No HTTP device" and Serial mode errors are handled.
 - If mDNS isn't available, verify `zonai.local` attempt times out quickly and the UI falls back to IP or relative URL.

Notes
 - The mock server (mock_server.py) is intentionally minimal for frontend testing.
 - For firmware mDNS support, the device tries `adafruit_mdns` if available; otherwise it silently skips mDNS registration.
