# VERSION = "v2.5"
import board
import neopixel
import json
import usb_cdc
import time
import math
import microcontroller
import gc

# --- HARDWARE ---
PIN = board.GP22
NUM_LEDS = 16
pixels = neopixel.NeoPixel(PIN, NUM_LEDS, auto_write=False)

# --- CONSTANTS ---
WHITE_BALANCE = (1.0, 1.0, 0.725)
GAMMA = bytearray([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25, 25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36, 37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68, 69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89, 90, 92, 93, 95, 96, 98, 99, 101, 102, 104, 105, 107, 109, 110, 112, 114, 115, 117, 119, 120, 122, 124, 126, 127, 129, 131, 133, 135, 137, 138, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158, 160, 162, 164, 167, 169, 171, 173, 175, 177, 180, 182, 184, 186, 189, 191, 193, 196, 198, 200, 203, 205, 208, 210, 213, 215, 218, 220, 223, 225, 228, 231, 233, 236, 239, 241, 244, 247, 249, 252, 255])

# --- STATE ---
state = {
    "mode": "solid",
    # Solid
    "solid_color": [255, 230, 0], "solid_bright": 0.8,
    # Fade
    "fade_color": [255, 200, 0], "fade_color_2": [255, 220, 0], "fade_use_2": True,
    "fade_min": 0.1, "fade_max": 0.9, "fade_speed": 0.9,
    # Snake
    "snake_color_mode": "rainbow", # single, rainbow, gradient
    "snake_color_1": [255, 0, 0], "snake_color_2": [0, 0, 255],
    "snake_cw": True, "snake_speed": 1.0
}

# --- PERSISTENCE ---
def save_state():
    try:
        json_str = json.dumps(state)
        b = json_str.encode('utf-8')
        length = len(b)
        if length > 1000: return 
        microcontroller.nvm[0:2] = bytearray([length >> 8, length & 0xFF])
        microcontroller.nvm[2:2+length] = b
        print("Saved")
    except: pass

def load_state():
    global state
    try:
        length = (microcontroller.nvm[0] << 8) | microcontroller.nvm[1]
        if 0 < length < 1000:
            saved = json.loads(microcontroller.nvm[2:2+length].decode('utf-8'))
            for k in state:
                if k in saved: state[k] = saved[k]
            print("Loaded")
    except: print("Defaults")

load_state()

# --- WIFI / HTTP (optional on Pico W) ---
try:
    import wifi
    import socketpool
    wifi_available = True
except Exception:
    wifi_available = False

http_server = None
pool = None

# --- DIAGNOSTICS ---
diag_enabled = False
diag_interval = 0.5
last_diag = 0.0

# --- WIFI SETUP (AP MODE) ---
AP_SSID = "Zonai-Lantern-Setup"
AP_PASSWORD = None
wifi_mode = "off"  # off|sta|ap
mdns_server = None


def save_wifi_creds(ssid, password):
    try:
        with open('/wifi.json','w') as f:
            json.dump({'ssid': ssid, 'pass': password}, f)
    except: pass


def load_wifi_creds():
    try:
        with open('/wifi.json','r') as f:
            return json.load(f)
    except: return None


def start_http_server():
    global http_server, pool
    if not wifi_available:
        return
    try:
        if http_server:
            try: http_server.close()
            except Exception: pass
            http_server = None
        pool = socketpool.SocketPool(wifi.radio)
        server = pool.socket(pool.AF_INET, pool.SOCK_STREAM)
        server.setsockopt(pool.SOL_SOCKET, pool.SO_REUSEADDR, 1)
        server.bind(('0.0.0.0', 80))
        server.listen(1)
        server.settimeout(0)
        http_server = server
        print("HTTP server started")
    except Exception as e:
        print("HTTP server failed:", e)
        http_server = None


def start_mdns():
    global mdns_server
    try:
        import adafruit_mdns
        try:
            mdns_server = adafruit_mdns.Server(wifi.radio)
            mdns_server.register_service('_http._tcp', 80, {'name':'zonai'})
            print('mDNS: advertised as zonai.local')
        except Exception:
            print('mDNS registration failed')
    except Exception:
        pass


def start_ap_mode():
    global wifi_mode
    if not wifi_available:
        return
    try:
        try:
            wifi.radio.stop_ap()
        except Exception:
            pass
        if AP_PASSWORD:
            wifi.radio.start_ap(AP_SSID, AP_PASSWORD)
        else:
            wifi.radio.start_ap(AP_SSID)
        wifi_mode = "ap"
        start_http_server()
        try: append_log("AP: " + AP_SSID)
        except Exception: pass
        try:
            print("AP mode:", AP_SSID, wifi.radio.ipv4_address_ap)
        except Exception:
            print("AP mode:", AP_SSID)
    except Exception as e:
        print("AP start failed:", e)


# --- LOG BUFFER ---
LOG_BUFFER = []
LOG_MAX = 200

def append_log(s):
    try:
        LOG_BUFFER.append(f"{int(time.time())}:{s}")
        if len(LOG_BUFFER) > LOG_MAX: LOG_BUFFER.pop(0)
    except Exception:
        pass


WIFI_SETUP_HTML = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zonai Lantern Setup</title>
  <style>
    body { font-family: Arial, sans-serif; background:#08121a; color:#e0e0e0; margin:0; padding:24px; }
    .card { max-width:480px; margin:0 auto; background:#0c1a24; border:1px solid #223; border-radius:10px; padding:18px; }
    h1 { font-size:18px; margin:0 0 10px 0; color:#ffd86b; }
    label { font-size:12px; color:#aaa; display:block; margin:10px 0 6px; }
    input { width:100%; padding:10px; border-radius:6px; border:1px solid #334; background:#07121a; color:#e0e0e0; }
    button { margin-top:12px; padding:10px 14px; border-radius:6px; border:1px solid #445; background:#1c2e3d; color:#e0e0e0; }
    .note { font-size:12px; color:#9aa; margin-top:10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Zonai Lantern WiFi Setup</h1>
    <form method="POST" action="/wifi">
      <label for="ssid">SSID</label>
      <input id="ssid" name="ssid" placeholder="Network name" required>
      <label for="pass">Password</label>
      <input id="pass" name="pass" type="password" placeholder="Password">
      <button type="submit">Connect</button>
    </form>
    <div class="note">After connecting, return to the GitHub Pages UI to control the lantern.</div>
    <div class="note">If you lose this page, reconnect to the setup network and try again.</div>
  </div>
</body>
</html>
"""

def url_decode(s):
    s = s.replace('+', ' ')
    out = ''
    i = 0
    while i < len(s):
        if s[i] == '%' and i + 2 < len(s):
            try:
                out += chr(int(s[i+1:i+3], 16))
                i += 3
                continue
            except Exception:
                pass
        out += s[i]
        i += 1
    return out

def parse_form(body):
    data = {}
    for part in body.split('&'):
        if '=' in part:
            k, v = part.split('=', 1)
            data[url_decode(k)] = url_decode(v)
    return data

def send_http(client, status_code, content_type, body):
    try:
        status_text = 'OK' if status_code == 200 else 'ERROR'
        header = f"HTTP/1.1 {status_code} {status_text}\r\nContent-Type: {content_type}\r\nContent-Length: {len(body.encode())}\r\nConnection: close\r\n\r\n"
        client.send(header.encode())
        client.send(body.encode())
    except Exception:
        pass
    try:
        client.close()
    except:
        pass


def handle_http_client(client):
    global wifi_mode
    try:
        client.settimeout(1)
        req = b''
        while True:
            try:
                chunk = client.recv(512)
                if not chunk:
                    break
                req += chunk
                if b'\r\n\r\n' in req:
                    break
            except Exception:
                break
        req_str = req.decode('utf-8', 'ignore')
        first_line = req_str.split('\r\n',1)[0]
        parts = first_line.split(' ')
        if len(parts) < 2:
            send_http(client, 400, 'text/plain', 'Bad Request')
            return
        method, path = parts[0], parts[1]
        body = ''
        if 'Content-Length:' in req_str:
            try:
                cl = int(req_str.split('Content-Length:')[1].split('\r\n')[0].strip())
                header_end = req_str.find('\r\n\r\n')
                body = req_str[header_end+4:]
                while len(body.encode()) < cl:
                    chunk = client.recv(512)
                    if not chunk: break
                    body += chunk.decode('utf-8','ignore')
            except:
                body = ''
        if method == 'GET' and (path == '/' or path == '/index.html'):
            if wifi_mode == "ap":
                send_http(client, 200, 'text/html', WIFI_SETUP_HTML)
            else:
                send_http(client, 200, 'text/plain', 'Zonai Lantern API is running.')
        elif method == 'GET' and path == '/state':
            send_http(client, 200, 'application/json', json.dumps(state))
        elif method == 'POST' and path == '/state':
            try:
                data = json.loads(body) if body else {}
                for k in state:
                    if k in data: state[k] = data[k]
                if 'save' in data and data['save']:
                    save_state()
                send_http(client, 200, 'application/json', json.dumps({'ok': True}))
            except:
                send_http(client, 400, 'application/json', json.dumps({'ok': False}))
        elif method == 'POST' and path == '/wifi':
            try:
                data = {}
                is_json = False
                if body:
                    if body.strip().startswith('{'):
                        data = json.loads(body)
                        is_json = True
                    else:
                        data = parse_form(body)
                ssid = data.get('ssid')
                password = data.get('pass') or data.get('password')
                if ssid:
                    was_ap = (wifi_mode == "ap")
                    if was_ap:
                        try: wifi.radio.stop_ap()
                        except Exception: pass
                    try:
                        wifi.radio.connect(ssid, password)
                        wifi_mode = "sta"
                        save_wifi_creds(ssid, password)
                        start_http_server()
                        start_mdns()
                        ip = str(wifi.radio.ipv4_address)
                        if is_json:
                            send_http(client, 200, 'application/json', json.dumps({'ok': True, 'ip': ip}))
                        else:
                            body_html = "<html><body>Connected. IP: %s</body></html>" % ip
                            send_http(client, 200, 'text/html', body_html)
                    except Exception as e:
                        if is_json:
                            send_http(client, 500, 'application/json', json.dumps({'ok': False, 'error': str(e)}))
                        else:
                            body_html = "<html><body>Connect failed: %s</body></html>" % str(e)
                            send_http(client, 500, 'text/html', body_html)
                        if was_ap:
                            start_ap_mode()
                else:
                    if is_json:
                        send_http(client, 400, 'application/json', json.dumps({'ok': False, 'error': 'missing ssid'}))
                    else:
                        send_http(client, 400, 'text/html', '<html><body>Missing SSID</body></html>')
            except:
                send_http(client, 400, 'application/json', json.dumps({'ok': False}))
        elif method == 'GET' and path == '/health':
            send_http(client, 200, 'application/json', json.dumps({'ok': True, 'mode': wifi_mode}))
        elif method == 'GET' and path == '/logs':
            try:
                send_http(client, 200, 'application/json', json.dumps({'logs': LOG_BUFFER}))
            except:
                send_http(client, 500, 'application/json', json.dumps({'ok': False}))
        else:
            send_http(client, 404, 'text/plain', 'Not Found')
    except Exception as e:
        try: client.close()
        except: pass


# If wifi available and stored creds exist, attempt connect and start server
if wifi_available:
    creds = load_wifi_creds()
    if creds and creds.get('ssid'):
        try:
            wifi.radio.connect(creds.get('ssid'), creds.get('pass'))
            wifi_mode = "sta"
            print("Connected to stored WiFi", wifi.radio.ipv4_address)
            start_http_server()
            start_mdns()
        except Exception as e:
            print("WiFi connect failed:", e)
            start_ap_mode()
    else:
        start_ap_mode()

# --- SERIAL HELPERS ---
# Write a line to both CDC interfaces (data and console) so host receives responses
def write_serial_line(s):
    try:
        # Ensure trailing newline for consistent host parsing
        if not s.endswith('\n'):
            s = s + '\n'
        append_log('OUT: ' + s.strip())
    except:
        pass
    try:
        usb_cdc.data.write(s.encode('utf-8'))
    except Exception:
        pass
    try:
        usb_cdc.console.write(s.encode('utf-8'))
    except Exception:
        pass
    try:
        # Also print to REPL / console for debugging tools that read the console
        print(s.strip())
    except:
        pass

def send_diag(payload):
    try:
        write_serial_line(json.dumps(payload))
    except Exception:
        pass

# --- HELPERS ---
def correct(rgb, br=1.0):
    if not isinstance(rgb, (list, tuple)): return (0,0,0)
    r = int(rgb[0] * WHITE_BALANCE[0] * br)
    g = int(rgb[1] * WHITE_BALANCE[1] * br)
    b = int(rgb[2] * WHITE_BALANCE[2] * br)
    return (GAMMA[min(255, max(0, r))], GAMMA[min(255, max(0, g))], GAMMA[min(255, max(0, b))])

def lerp_color(c1, c2, f):
    return (int(c1[0] + (c2[0]-c1[0])*f), int(c1[1] + (c2[1]-c1[1])*f), int(c1[2] + (c2[2]-c1[2])*f))

def color_wheel(pos):
    if pos < 85: return (pos * 3, 255 - pos * 3, 0)
    elif pos < 170:
        pos -= 85
        return (255 - pos * 3, 0, pos * 3)
    else:
        pos -= 170
        return (0, pos * 3, 255 - pos * 3)

# --- ANIMATION LOGIC ---
last_tick = 0
anim_step = 0
snake_len = 0
snake_filling = True

def update_leds():
    global last_tick, anim_step, snake_len, snake_filling
    
    now = time.monotonic()
    pixels.fill((0,0,0))
    mode = state["mode"]

    # --- SOLID ---
    if mode == "solid":
        pixels.fill(correct(state["solid_color"], state["solid_bright"]))

    # --- FADE ---
    elif mode == "fade":
        s_val = (math.sin(now * state["fade_speed"] * 3) + 1) / 2
        f_range = state["fade_max"] - state["fade_min"]
        
        for i in range(NUM_LEDS):
            offset = (i % 2) * 0.5
            val = (math.sin((now * state["fade_speed"] * 3) + offset) + 1) / 2
            mix = state["fade_min"] + (val * f_range)
            
            if state["fade_use_2"]:
                base = lerp_color(state["fade_color"], state["fade_color_2"], mix)
                pixels[i] = correct(base, 1.0)
            else:
                pixels[i] = correct(state["fade_color"], mix)

    # --- SNAKE ---
    elif mode == "snake":
        # Delay = 0.2 / speed
        delay = 0.2 / max(0.1, state["snake_speed"])
        
        if now - last_tick > delay:
            last_tick = now
            if state["snake_cw"]: anim_step = (anim_step + 1) % NUM_LEDS
            else: anim_step = (anim_step - 1) % NUM_LEDS
            
            if snake_filling:
                snake_len += 1
                if snake_len >= NUM_LEDS: snake_filling = False
            else:
                snake_len -= 1
                if snake_len <= 0: snake_filling = True
        
        direction = 1 if state["snake_cw"] else -1
        for i in range(snake_len):
            idx = (anim_step - (i * direction)) % NUM_LEDS
            
            col = (0,0,0)
            if state["snake_color_mode"] == "single":
                col = state["snake_color_1"]
            elif state["snake_color_mode"] == "gradient":
                col = lerp_color(state["snake_color_1"], state["snake_color_2"], i / max(1, snake_len))
            elif state["snake_color_mode"] == "rainbow":
                hue = int((i * 255 / NUM_LEDS) + (now * 20)) % 255
                col = color_wheel(hue)
                
            pixels[idx] = correct(col, 1.0)

    pixels.show()

# --- MAIN LOOP ---
buffer = ""

def extract_json(buf):
    depth = 0
    start = None
    for i, ch in enumerate(buf):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    return buf[start:i+1], buf[i+1:]
    return None, buf

while True:
    gc.collect()
    # Read from both CDC interfaces (data and console) for compatibility with different hosts
    for name, stream in (('data', getattr(usb_cdc, 'data', None)), ('console', getattr(usb_cdc, 'console', None))):
        try:
            if stream and stream.in_waiting > 0:
                chunk = stream.read(stream.in_waiting).decode("utf-8")
                try: append_log(f"READ-{name}: " + chunk.replace('\n','\\n')[:200])
                except: pass
                buffer += chunk
                if len(buffer) > 2000:
                    buffer = ""
        except Exception:
            pass

    # process any complete JSON objects found in buffer
    while True:
        json_str, buffer = extract_json(buffer)
        if not json_str:
            break
        try:
            cmd = json.loads(json_str)
            try: append_log('IN: ' + json.dumps(cmd))
            except: pass
            wifi_cmd = cmd.get("wifi") or {}
            wifi_seq = cmd.get("wifi_seq")
            if wifi_seq is None and isinstance(wifi_cmd, dict) and "seq" in wifi_cmd:
                wifi_seq = wifi_cmd.get("seq")
            # Send a short ACK showing which keys were parsed (helps host confirm receipt)
            try:
                ack_payload = {"ack": list(cmd.keys())}
                if wifi_seq is not None: ack_payload["wifi_seq"] = wifi_seq
                if "diag" in cmd: ack_payload["diag"] = cmd.get("diag")
                write_serial_line(json.dumps(ack_payload))
            except:
                pass
            if "diag" in cmd:
                try:
                    diag_enabled = bool(cmd.get("diag"))
                    append_log("DIAG: " + ("on" if diag_enabled else "off"))
                    send_diag({"diag": "on" if diag_enabled else "off"})
                except:
                    pass
            for k in state:
                if k in cmd: state[k] = cmd[k]
            if "save" in cmd and cmd["save"]:
                save_state()
                try:
                    write_serial_line(json.dumps({"ok": True, "saved": True}) + "\n")
                except: pass
            if "get_state" in cmd:
                try:
                    write_serial_line(json.dumps(state) + "\n")
                except: pass
            if "wifi" in cmd:
                ssid = wifi_cmd.get("ssid") if isinstance(wifi_cmd, dict) else None
                password = None
                if isinstance(wifi_cmd, dict):
                    password = wifi_cmd.get("pass") or wifi_cmd.get("password")
                    if "diag" in wifi_cmd:
                        try:
                            diag_enabled = bool(wifi_cmd.get("diag"))
                            append_log("DIAG: " + ("on" if diag_enabled else "off"))
                        except:
                            pass
                if not ssid:
                    try: write_serial_line(json.dumps({"ok": False, "error": "missing ssid", "wifi_seq": wifi_seq}) + "\n")
                    except: pass
                elif not wifi_available:
                    try: write_serial_line(json.dumps({"ok": False, "error": "wifi_unavailable", "wifi_seq": wifi_seq}) + "\n")
                    except: pass
                else:
                    try:
                        if diag_enabled:
                            try:
                                start_payload = {"diag": "connect_start", "t": round(time.monotonic(), 3)}
                                if wifi_seq is not None: start_payload["wifi_seq"] = wifi_seq
                                send_diag(start_payload)
                            except: pass
                        # Acknowledge attempt immediately so host knows we're working
                        try:
                            # Send several quick pulses to increase the chance the host sees at least one
                            pulse_count = 3 if not diag_enabled else 8
                            pulse_delay = 0.05 if not diag_enabled else 0.2
                            for i in range(pulse_count):
                                payload = {"status": "connecting", "pulse": i+1}
                                if wifi_seq is not None: payload["wifi_seq"] = wifi_seq
                                if diag_enabled: payload["ts"] = round(time.monotonic(), 3)
                                try: write_serial_line(json.dumps(payload))
                                except: pass
                                try: append_log(f'CONNECT-PULSE-{i+1}: {ssid}')
                                except: pass
                                try: time.sleep(pulse_delay)
                                except: pass
                        except: pass
                        try: append_log('CONNECT-START: ' + ssid)
                        except: pass
                        # Give the host a little more time to receive the status before blocking on connect
                        try: time.sleep(0.35)
                        except: pass

                        # Attempt connection (can block for several seconds)
                        was_ap = (wifi_mode == "ap")
                        if was_ap:
                            try: wifi.radio.stop_ap()
                            except Exception: pass
                        connect_start = time.monotonic()
                        try:
                            wifi.radio.connect(ssid, password)
                            wifi_mode = "sta"
                            elapsed = round(time.monotonic() - connect_start, 3)
                            try: append_log('CONNECT-SUCCESS')
                            except: pass
                            save_wifi_creds(ssid, password)
                            start_http_server()
                            start_mdns()
                            ip = str(wifi.radio.ipv4_address)
                            payload = {"status": "connected", "ok": True, "ip": ip, "done": True}
                            if wifi_seq is not None: payload["wifi_seq"] = wifi_seq
                            try: write_serial_line(json.dumps(payload))
                            except: pass
                            try: append_log('CONNECT-DONE: ' + ip)
                            except: pass
                            if diag_enabled:
                                try:
                                    end_payload = {"diag": "connect_end", "t": round(time.monotonic(), 3), "ok": True, "elapsed": elapsed}
                                    if wifi_seq is not None: end_payload["wifi_seq"] = wifi_seq
                                    send_diag(end_payload)
                                except: pass
                            # Allow a short pause so hosts can ingest this final status
                            try: time.sleep(0.18)
                            except: pass
                        except Exception as e:
                            elapsed = round(time.monotonic() - connect_start, 3)
                            try: append_log('CONNECT-ERR: ' + str(e))
                            except: pass
                            payload = {"status": "failed", "ok": False, "error": str(e), "done": True}
                            if wifi_seq is not None: payload["wifi_seq"] = wifi_seq
                            try: write_serial_line(json.dumps(payload))
                            except: pass
                            if diag_enabled:
                                try:
                                    end_payload = {"diag": "connect_end", "t": round(time.monotonic(), 3), "ok": False, "elapsed": elapsed, "error": str(e)}
                                    if wifi_seq is not None: end_payload["wifi_seq"] = wifi_seq
                                    send_diag(end_payload)
                                except: pass
                            try: time.sleep(0.18)
                            except: pass
                            if was_ap:
                                start_ap_mode()
                    except Exception as e:
                        err_payload = {"ok": False, "error": str(e), "done": True}
                        if wifi_seq is not None: err_payload["wifi_seq"] = wifi_seq
                        try: write_serial_line(json.dumps(err_payload) + "\n")
                        except: pass
        except: pass

    # Handle HTTP clients (non-blocking) if available
    if wifi_available and http_server:
        try:
            client, addr = http_server.accept()
            if client:
                handle_http_client(client)
        except Exception:
            pass

    if diag_enabled:
        now_diag = time.monotonic()
        if now_diag - last_diag >= diag_interval:
            last_diag = now_diag
            hb = {"diag": "hb", "t": round(now_diag, 2)}
            try:
                if wifi_mode == "ap":
                    hb["ap_ip"] = str(wifi.radio.ipv4_address_ap)
                elif wifi_available and wifi.radio.ipv4_address:
                    hb["ip"] = str(wifi.radio.ipv4_address)
            except Exception:
                pass
            send_diag(hb)

    update_leds()
    time.sleep(0.005)
