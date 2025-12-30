# VERSION = "v2.0"
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
serial = usb_cdc.data
buffer = ""

while True:
    gc.collect()
    if serial.in_waiting > 0:
        try:
            chunk = serial.read(serial.in_waiting).decode("utf-8")
            buffer += chunk
            if len(buffer) > 1000: buffer = ""
        except: buffer = ""

        while '}' in buffer:
            end = buffer.find('}')
            start = buffer.rfind('{', 0, end)
            if start != -1:
                try:
                    cmd = json.loads(buffer[start:end+1])
                    for k in state:
                        if k in cmd: state[k] = cmd[k]
                    if "save" in cmd and cmd["save"]: save_state()
                    if "get_state" in cmd: 
                        serial.write((json.dumps(state) + "\n").encode())
                except: pass
            buffer = buffer[end+1:]

    update_leds()
    time.sleep(0.005)
