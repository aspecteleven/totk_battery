# totk_battery
A web interface for controlling a TOTK Shrine Battery lantern

## WiFi / Pico W support
The UI supports communicating with the device over USB serial (Web Serial) and over WiFi (HTTP). Use the **Comms Mode** selector to pick `Auto`, `Serial`, or `HTTP`.

### Quick start for HTTP testing
- You can test the HTTP path without hardware by running the included mock server:

```bash
python mock_server.py
```

- In the app, set *Comms Mode* to `HTTP`, then click **Ping** and/or **WiFi** to configure or connect to a device.

### If you have a Pico W
- Copy the updated `code.py` to your Pico W (CircuitPython) and either:
  - POST `/wifi` to `http://<pico_ip>/wifi` with `{ "ssid": "your_ssid", "pass": "your_pass" }`; or
  - Use the in-page **WiFi** config modal to POST credentials.

- Once connected, the Pico serves:
  - GET `/state` — returns the current device JSON state
  - POST `/state` — accepts partial/full state updates (JSON) and `{ "save": true }` to persist
  - POST `/wifi` — accepts `{ ssid, pass }` and returns `{ ok:true, ip: "..." }` on success
  - GET `/health` — returns `{ ok:true }`

If mDNS (Bonjour) is available on the device it will attempt to advertise as `zonai.local` — the frontend will try `http://zonai.local/state` as one of the discovery paths before falling back to a specific device IP or the page origin.

### Assets (CDN / GitHub Pages)
Set the Asset Base to your GitHub Pages URL (e.g. `https://aspecteleven.github.io/totk_battery/`) and click Apply to load images from the CDN.

## Notes
- Web Serial requires Chrome or Edge and a secure context (localhost or HTTPS).
- The mock server is intentionally minimal — it's for local frontend testing only.

