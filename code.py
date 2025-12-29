# VERSION = "v2.2"
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


# --- LOG BUFFER ---
LOG_BUFFER = []
LOG_MAX = 200

def append_log(s):
    try:
        LOG_BUFFER.append(f"{int(time.time())}:{s}")
        if len(LOG_BUFFER) > LOG_MAX: LOG_BUFFER.pop(0)
    except Exception:
        pass


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
        if method == 'GET' and path == '/state':
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
                data = json.loads(body) if body else {}
                ssid = data.get('ssid')
                password = data.get('pass') or data.get('password')
                if ssid:
                    try:
                        wifi.radio.connect(ssid, password)
                        save_wifi_creds(ssid, password)
                        ip = str(wifi.radio.ipv4_address)
                        send_http(client, 200, 'application/json', json.dumps({'ok': True, 'ip': ip}))
                    except Exception as e:
                        send_http(client, 500, 'application/json', json.dumps({'ok': False, 'error': str(e)}))
                else:
                    send_http(client, 400, 'application/json', json.dumps({'ok': False, 'error': 'missing ssid'}))
            except:
                send_http(client, 400, 'application/json', json.dumps({'ok': False}))
        elif method == 'GET' and path == '/health':
            send_http(client, 200, 'application/json', json.dumps({'ok': True}))
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
    if creds:
        try:
            wifi.radio.connect(creds.get('ssid'), creds.get('pass'))
            print("Connected to stored WiFi", wifi.radio.ipv4_address)
            start_http_server()
            # Optional mDNS advertisement if available
            try:
                import adafruit_mdns
                try:
                    mdns = adafruit_mdns.Server(wifi.radio)
                    mdns.register_service('_http._tcp', 80, {'name':'zonai'})
                    print('mDNS: advertised as zonai.local')
                except Exception:
                    print('mDNS registration failed')
            except Exception:
                pass
        except Exception as e:
            print("WiFi connect failed:", e)

# --- SERIAL HELPERS ---
# Write a line to both CDC interfaces (data and console) so host receives responses
def write_serial_line(s):
    try:
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
    while '}' in buffer:
        end = buffer.find('}')
        start = buffer.rfind('{', 0, end)
        if start != -1:
            try:
                cmd = json.loads(buffer[start:end+1])
                try: append_log('IN: ' + json.dumps(cmd))
                except: pass
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
                    wifi_cmd = cmd.get("wifi") or {}
                    ssid = wifi_cmd.get("ssid")
                    password = wifi_cmd.get("pass") or wifi_cmd.get("password")
                    if not ssid:
                        try: write_serial_line(json.dumps({"ok": False, "error": "missing ssid"}) + "\n")
                        except: pass
                    elif not wifi_available:
                        try: write_serial_line(json.dumps({"ok": False, "error": "wifi_unavailable"}) + "\n")
                        except: pass
                    else:
                        try:
                            # Acknowledge attempt immediately so host knows we're working
                            try: write_serial_line(json.dumps({"status": "connecting"}) + "\n")
                            except: pass
                            try: append_log('CONNECT: ' + ssid)
                            except: pass
                            wifi.radio.connect(ssid, password)
                            save_wifi_creds(ssid, password)
                            start_http_server()
                            ip = str(wifi.radio.ipv4_address)
                            try: write_serial_line(json.dumps({"ok": True, "ip": ip}) + "\n")
                            except: pass
                        except Exception as e:
                            try: write_serial_line(json.dumps({"ok": False, "error": str(e)}) + "\n")
                            except: pass
            except: pass
        buffer = buffer[end+1:]

    # Handle HTTP clients (non-blocking) if available
    if wifi_available and http_server:
        try:
            client, addr = http_server.accept()
            if client:
                handle_http_client(client)
        except Exception:
            pass

    update_leds()
    time.sleep(0.005)
