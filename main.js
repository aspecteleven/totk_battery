// --- INTRO LOGIC ---
// FILE VERSIONS - update these when editing files
const HTML_VERSION = 'v2.14';
const JS_VERSION = 'v2.15';
const CSS_VERSION = 'v2.3';

const intro = {
    screen: document.getElementById('introScreen'),
    prompt: document.getElementById('introPrompt'),
    input: document.getElementById('nameInput'),
    welcome: document.getElementById('introWelcome'),
    btn: document.getElementById('continueBtn'),
    main: document.getElementById('mainApp'),
    resetBtn: document.getElementById('resetUserBtn'),
    offlineBtn: document.getElementById('offlineBtn')
};

intro.resetBtn.addEventListener('click', () => {
    if(confirm("Reset user name and show intro again?")) {
        localStorage.removeItem('zonai_user');
        location.reload();
    }
});

function initIntro() {
    const savedName = localStorage.getItem('zonai_user');
    if (savedName) {
        intro.prompt.style.display = 'none';
        intro.input.style.display = 'none';
        setTimeout(() => {
            typeWriter(`Welcome back, ${savedName}.<br>The Shrine awaits.`);
        }, 500);
    } else {
        intro.input.focus();
    }
}

intro.input.addEventListener('keydown', (e) => {
    if(e.key === "Enter" && intro.input.value.trim() !== "") submitName();
});

function submitName() {
    const name = intro.input.value.trim();
    if(!name) return;
    localStorage.setItem('zonai_user', name);
    intro.input.style.display = 'none';
    intro.prompt.style.display = 'none';
    typeWriter(`Welcome, ${name}.<br>Enjoy your Zonai Lantern.`);
}

function typeWriter(text) {
    let i = 0;
    const rawText = text.replace("<br>", "|");
    const chars = rawText.split(""); 
    intro.welcome.innerHTML = "";
    const phrase = "Zonai Lantern";
    let fullStr = rawText.replace("|", "");
    const startH = fullStr.indexOf(phrase);
    const endH = startH + phrase.length;
    let visualIndex = 0; 

    function type() {
        if (i < chars.length) {
            const char = chars[i];
            if(char === "|") {
                intro.welcome.appendChild(document.createElement("br"));
            } else {
                const span = document.createElement('span');
                span.textContent = char;
                if(startH !== -1 && visualIndex >= startH && visualIndex < endH) {
                    span.className = "char-reveal char-highlight";
                } else {
                    span.className = "char-reveal"; 
                }
                intro.welcome.appendChild(span);
                visualIndex++;
            }
            i++;
            setTimeout(type, 75); 
        } else {
            intro.btn.classList.add('visible');
        }
    }
    type();
}

intro.btn.addEventListener('click', () => {
    intro.main.classList.add('visible'); 
    intro.screen.classList.add('mist-out');
    intro.resetBtn.style.display = 'none';
    // Show Demo Button after intro
    setTimeout(() => {
        intro.screen.style.display = 'none';
        intro.offlineBtn.style.display = 'block';
    }, 2600);
});

initIntro();


// --- MAIN CONTROLLER LOGIC ---
let port, writer, reader, readableStreamClosed;
let keepReading = false;
let isConnected = false;
let isOfflineMode = false;
let serialBuffer = "";
let pendingSerialWifi = null; // { timeout }
let settingsOverlay = null;

// Asset base (for CDN or GitHub Pages) and comms mode
let ASSET_BASE = localStorage.getItem('asset_base') || '';
const comms = {
    mode: localStorage.getItem('comms_mode') || 'auto', // 'auto'|'serial'|'http'
    setMode(m) { this.mode = m; localStorage.setItem('comms_mode', m); },
    resolveMode() {
        if (this.mode !== 'auto') return this.mode;
        if (isConnected) return 'serial';
        if (location.protocol.startsWith('http')) return 'http';
        if (navigator.serial) return 'serial';
        return 'http';
    },
isHTTP() { return this.resolveMode() === 'http'; },
    async sendState(save) {
        if (isOfflineMode) return false;
        appState.save = save;
        if (this.resolveMode() === 'serial') {
            if (!isConnected) return false;
            try { await sendRaw(appState); showTempStatus('Sent (USB)', 1800); return true; } catch (e) { showTempStatus('USB send failed', 3000); return false; }
        }
        // HTTP: prefer storedDeviceIP, then zonai.local, then relative
        for (const base of this.getBaseUrls()) {
            const url = base ? `${base}/state` : '/state';
            try {
                const resp = await fetchWithTimeout(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(appState) }, 1500);
                if (resp.ok) { ui.status.innerText = base ? `Saved (${base})` : 'Saved'; return true; }
            } catch (e) { /* try next */ }
        }
        ui.status.innerText = 'Save failed (HTTP)';
        return false;
    },
    async requestState() {
        if (this.resolveMode() === 'serial') {
            if (isConnected) sendRaw({ get_state: true });
            return;
        }
        ui.status.innerText = 'Searching (HTTP)...';
        let bases = [];
        try { if (this.getBaseUrls && typeof this.getBaseUrls === 'function') bases = this.getBaseUrls(); } catch(e) {}
        if (!bases || typeof bases[Symbol.iterator] !== 'function') {
            bases = [];
            // Only attempt direct HTTP device addresses when the page itself is served over HTTP/local file/localhost
            // to avoid Mixed Content errors when the page is HTTPS (e.g., GitHub Pages).
            let origin = '';
            try { origin = window.location.origin || ''; } catch(e) { origin = ''; }
            const pageIsHttp = origin.startsWith('http://') || origin.startsWith('file://') || origin.includes('localhost') || origin.includes('127.0.0.1');
            if (storedDeviceIP && pageIsHttp) bases.push(`http://${storedDeviceIP}`);
            if (pageIsHttp) bases.push('http://zonai.local'); // try mDNS name only on non-HTTPS pages
            if (pageIsHttp) bases.push(origin);
            bases.push('');
        }
        for (const base of bases) {
            let url = base ? `${base}/state` : '/state';
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const resp = await fetchWithTimeout(url, {}, 1200);
                    if (resp.ok) {
                        const d = await resp.json();
                        Object.assign(appState, d);
                        showTempStatus(base ? `Synced (${base})` : 'Synced', 3000);
                        if (base && base.startsWith('http://') && base !== window.location.origin) {
                            const detected = base.replace('http://','');
                            storedDeviceIP = detected.split('/')[0];
                            localStorage.setItem('device_ip', storedDeviceIP);
                            if (deviceIpInput) deviceIpInput.value = storedDeviceIP;
                        }
                        enableControls('http');
                        drawControls();
                        return;
                    }
                } catch (e) {
                    if (attempt === 0) await new Promise(r => setTimeout(r, 220));
                }
            }
        }
        ui.status.innerText = 'No HTTP device';
    }
};

function applyAssets(base) {
    ASSET_BASE = base || '';
    localStorage.setItem('asset_base', ASSET_BASE);
    const setBg = (sel, p) => { const el = document.querySelector(sel); if (el) el.style.backgroundImage = `url("${ASSET_BASE}${p}")`; };
    setBg('.intro-symbol', 'images/symbol.png');
    setBg('.stone_overlay_left', 'images/stone_overlay_left.webp');
    setBg('.stone_overlay_right', 'images/stone_overlay_right.webp');
    setBg('.stone_left', 'images/stone_left.webp');
    setBg('.stone_right', 'images/stone_right.webp');
    setBg('.elements_top', 'images/elements_top.png');
    setBg('.elements_bottom', 'images/elements_bottom.png');
    setBg('.battery_body', 'images/battery_body_dark.png');
    setBg('.battery_glass', 'images/battery_glass.png');
    setBg('.battery_glass_glow_overlay', 'images/battery_glass.png');
    const glow = document.querySelector('.battery_glass_glow');
    if (glow) {
        glow.style.webkitMaskImage = `url("${ASSET_BASE}images/battery_glass_mask_glow.png")`;
        glow.style.maskImage = `url("${ASSET_BASE}images/battery_glass_mask_glow.png")`;
    }
}

// Apply initial asset base
if (ASSET_BASE) {
    const el = document.getElementById('assetBase'); if (el) el.value = ASSET_BASE;
    applyAssets(ASSET_BASE);
}

// Default State (Placeholder)
let appState = {
    mode: "solid",
    solid_color: [255, 230, 0], solid_bright: 0.8,
    fade_color: [255, 200, 0], fade_color_2: [255, 220, 0], fade_use_2: true, fade_min: 0.1, fade_max: 0.9, fade_speed: 0.9,
    snake_color_mode: "rainbow", snake_color_1: [255, 0, 0], snake_color_2: [0, 0, 255], snake_cw: true, snake_speed: 1.0
};

const ui = {
    connToggle: document.getElementById('connToggle'),
    modeSelect: document.getElementById('modeSelect'),
    controls: document.getElementById('controlsArea'),
    status: document.getElementById('statusText'),
    defaults: document.getElementById('defaultBtn'),
    glowLayer: document.getElementById('glowLayer'),
    offlineBtn: document.getElementById('offlineBtn')
};

// --- OFFLINE MODE HANDLER ---
ui.offlineBtn.addEventListener('click', () => {
    if(isConnected) return; // Ignore if actually connected
    
    isOfflineMode = !isOfflineMode;
    if(isOfflineMode) {
        ui.offlineBtn.classList.add('active');
        enableControls('offline');
    } else {
        ui.offlineBtn.classList.remove('active');
        enableControls('locked');
    }
});

// --- USB HANDLING ---
ui.connToggle.addEventListener('click', async () => {
    if (!isConnected) {
        // Connect Logic
        if (!navigator.serial) return alert("Use Chrome/Edge.");
        try {
            // Turn off offline mode if active
            isOfflineMode = false;
            ui.offlineBtn.classList.remove('active');

            port = await navigator.serial.requestPort();
            try {
                await port.open({ baudRate: 115200 });
            } catch (e) {
                console.error('Serial open failed', e);
                // Common case: port already opened by another app
                ui.status.innerText = 'Port already open (close other app)';
                appendSerialLog('ERR', 'open failed: ' + (e && e.message ? e.message : e));
                return;
            }
            
            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
            writer = textEncoder.writable.getWriter();
            
            const textDecoder = new TextDecoderStream();
            readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.getReader();

            // Log port info for diagnostics
            try { appendSerialLog('INFO', 'Opened serial: ' + JSON.stringify(port.getInfo())); } catch (e) {}

            isConnected = true; 
            keepReading = true;
            
            enableControls('usb');
            readLoop(); 
            
            // Request State to sync UI
            setTimeout(() => { comms.requestState(); }, 400);

        } catch (e) { 
            console.error(e); 
            ui.status.innerText = "Error"; 
            isConnected = false;
        }
    } else {
        // Disconnect Logic
        try {
            keepReading = false;
            if (reader) {
                await reader.cancel();
                await readableStreamClosed.catch(() => {});
                reader = null;
            }
            if (writer) {
                await writer.close();
                writer = null;
            }
            if (port) {
                await port.close();
                port = null;
            }
            isConnected = false;
            enableControls('locked');
        } catch(e) {
            isConnected = false;
            enableControls('locked');
        }
    }
});

async function readLoop() {
    while (keepReading) {
        try {
            const { value, done } = await reader.read();
            if (done) break; 
            if (value) handleSerialData(value);
        } catch (error) { break; }
    }
}

function handleSerialData(text) {
    serialBuffer += text;
    let lines = serialBuffer.split("\n");
    serialBuffer = lines.pop(); 
    for (let line of lines) { if (line.trim().length > 0) { appendSerialLog('RAW', line); parseJSON(line); } }
}

function appendSerialLog(dir, text) {
    try {
        const el = document.getElementById('serialLog');
        const ts = new Date().toISOString().substr(11,8);
        const line = `[${ts}] ${dir}: ${text}`;
        if (el) {
            el.textContent = (el.textContent ? el.textContent + '\n' : '') + line;
            if (el.textContent.length > 20000) el.textContent = el.textContent.slice(-20000);
            el.scrollTop = el.scrollHeight;
        }
        console.debug(line);
    } catch(e){}
}

function parseJSON(text) {
    try {
        appendSerialLog('RECV', text);
        if (text.indexOf('{') > -1) {
            // Extract all top-level {...} objects from the text (handles concatenated JSONs)
            const matches = text.match(/\{[^}]*\}/g);
            if (matches && matches.length) {
                for (const jsonStr of matches) {
                    try {
                        const d = JSON.parse(jsonStr);
                        if (d && typeof d === 'object') {
                            // WiFi serial response handling
                            if ('status' in d) {
                                const ws = document.getElementById('wifiStatus');
                                if (ws) ws.innerText = d.status;
                                appendSerialLog('INFO', 'status: ' + d.status);
                            }
                            if ('ack' in d) {
                                const ws = document.getElementById('wifiStatus');
                                if (ws) ws.innerText = 'Acknowledged';
                                appendSerialLog('INFO', 'ack: ' + JSON.stringify(d.ack));
                                // extend pending wait time to allow connect to complete
                                if (pendingSerialWifi && pendingSerialWifi.timeout) clearTimeout(pendingSerialWifi.timeout);
                                // allow more time (2 minutes) for slow connects
                                pendingSerialWifi = { timeout: setTimeout(() => { ui.wifiStatus.innerText = 'No response (serial)'; pendingSerialWifi = null; }, 120000) };
                            }
                            if ('ok' in d) {
                                const ws = document.getElementById('wifiStatus');
                                if (d.ok) {
                                    if (d.ip) {
                                        if (ws) ws.innerText = `Connected: ${d.ip}`;
                                        storedDeviceIP = d.ip; localStorage.setItem('device_ip', storedDeviceIP);
                                        if (deviceIpInput) deviceIpInput.value = storedDeviceIP;
                                    } else {
                                        if (ws) ws.innerText = 'OK';
                                    }
                                    if (pendingSerialWifi && pendingSerialWifi.timeout) clearTimeout(pendingSerialWifi.timeout);
                                    pendingSerialWifi = null;
                                    // close settings modal and sync
                                    hideSettingsModal();
                                    comms.requestState();
                                } else {
                                    if (ws) ws.innerText = `Failed: ${d.error || 'unknown'}`;
                                    if (pendingSerialWifi && pendingSerialWifi.timeout) clearTimeout(pendingSerialWifi.timeout);
                                    pendingSerialWifi = null;
                                }
                            }

                            // Merge only known appState keys
                            let changed = false;
                            for (let k in d) {
                                if (k in appState) { appState[k] = d[k]; changed = true; }
                            }
                            if (d.mode && ui.modeSelect.value !== d.mode) ui.modeSelect.value = d.mode;
                            if (changed && (isConnected || comms.resolveMode() === 'http')) drawControls();
                        }
                    } catch (ex) {
                        console.warn('parseJSON inner error', ex, jsonStr);
                    }
                }
            }
        }
    } catch (e) { console.warn('parseJSON error', e); }
}

async function sendRaw(payload) {
    if (!writer) return;
    try {
        const s = JSON.stringify(payload) + '\n'; // add newline to help device parsing and some endpoints
        await writer.write(s);
        appendSerialLog('SENT', s.trim());
    } catch(e){ appendSerialLog('ERR', 'sendRaw failed: ' + e); }
}

async function sendData(save) {
    if (isOfflineMode) return; // no comms when demoing
    appState.save = save;
    if (save) ui.status.innerText = 'Saving...'; else ui.status.innerText = 'Updating...';
    try {
        const ok = await comms.sendState(save);
        ui.status.innerText = ok ? (save ? 'Saved' : 'Updated') : 'Save failed';
    } catch (e) {
        ui.status.innerText = 'Error';
    }
}

// --- UI MANAGEMENT ---
function enableControls(state) {
    const enabled = (state === 'usb' || state === 'offline' || state === 'http');
    
    if (state === 'usb') {
        ui.connToggle.innerText = "Disconnect"; 
        ui.connToggle.className = "btn-disconnect"; 
        ui.status.innerText = "Connected (USB)";
    } else if (state === 'http') {
        ui.connToggle.innerText = "Connect"; 
        ui.connToggle.className = "btn-connect"; 
        ui.status.innerText = "Connected (HTTP)";
    } else if (state === 'offline') {
        ui.connToggle.innerText = "Connect"; 
        ui.connToggle.className = "btn-connect"; 
        ui.status.innerText = "Demo Mode";
    } else {
        ui.connToggle.innerText = "Connect"; 
        ui.connToggle.className = "btn-connect"; 
        ui.status.innerText = "Disconnected";
    }

    controlsEnabled = enabled;
    ui.modeSelect.disabled = !enabled; 
    ui.defaults.disabled = !enabled;
    
    if (enabled) drawControls(); 
    else ui.controls.innerHTML = "";
}

ui.modeSelect.addEventListener('change', () => {
    appState.mode = ui.modeSelect.value; drawControls(); sendData(true);
});

function drawControls() {
    ui.controls.innerHTML = "";
    const m = appState.mode;

    if (m === "solid") {
        createColorInput("Color", "solid_color");
        createSlider("Brightness", "solid_bright", 0, 1, 0.05, true);
    }
    else if (m === "fade") {
        createColorInput("Color 1", "fade_color");
        createColorInput("Color 2", "fade_color_2");
        createCheckbox("Enable 2", "fade_use_2");
        createDualSlider("Range", ["fade_min", "fade_max"]);
        createSlider("Speed", "fade_speed", 0.1, 3.0, 0.1);
    }
    else if (m === "snake") {
        createDropdown("Type", "snake_color_mode", {"single": "Single", "rainbow": "Rainbow", "gradient": "Gradient"});
        if(appState.snake_color_mode !== 'rainbow') createColorInput("Color 1", "snake_color_1");
        if(appState.snake_color_mode === 'gradient') createColorInput("Color 2", "snake_color_2");
        createCheckbox("Clockwise", "snake_cw");
        createSlider("Speed", "snake_speed", 0.1, 3.0, 0.1);
    }
}

// --- WIDGETS ---
function createColorInput(label, key) {
    const div = document.createElement('div'); div.className = 'control-group';
    div.innerHTML = `<label>${label}</label><input type="color" value="${rgbToHex(appState[key])}">`;
    div.querySelector('input').addEventListener('input', (e) => { appState[key] = hexToRgb(e.target.value); sendData(false); });
    div.querySelector('input').addEventListener('change', (e) => { appState[key] = hexToRgb(e.target.value); if(key==='snake_color_mode') drawControls(); sendData(true); });
    ui.controls.appendChild(div);
}
function createCheckbox(label, key) {
    const div = document.createElement('div'); div.className = 'control-group';
    div.innerHTML = `<label>${label} <input type="checkbox" ${appState[key] ? 'checked' : ''}></label>`;
    div.querySelector('input').addEventListener('change', (e) => { appState[key] = e.target.checked; sendData(true); drawControls(); });
    ui.controls.appendChild(div);
}
function createDropdown(label, key, options) {
    const div = document.createElement('div'); div.className = 'control-group';
    let opts = ""; for(let k in options) opts += `<option value="${k}" ${appState[key] == k ? 'selected' : ''}>${options[k]}</option>`;
    div.innerHTML = `<label>${label}</label><select>${opts}</select>`;
    div.querySelector('select').addEventListener('change', (e) => { appState[key] = isNaN(e.target.value) ? e.target.value : parseInt(e.target.value); drawControls(); sendData(true); });
    ui.controls.appendChild(div);
}
function createSlider(label, key, min, max, step, showPercent=false) {
    const div = document.createElement('div'); div.className = 'control-group'; div.style.flex = "1";
    div.innerHTML = `<label>${label} <span>${formatVal(appState[key], showPercent)}</span></label><div class="custom-slider-container"><div class="custom-slider-track"></div><div class="custom-slider-highlight"></div><div class="thumb"></div></div>`;
    ui.controls.appendChild(div);
    initSliderLogic(div.querySelector('.custom-slider-container'), div.querySelector('.thumb'), div.querySelector('.custom-slider-highlight'), min, max, step, (v) => { appState[key] = v; div.querySelector('span').innerText = formatVal(v, showPercent); });
    const p = (appState[key] - min) / (max - min) * 100;
    div.querySelector('.thumb').style.left = `calc(${p}% - 10px)`; div.querySelector('.custom-slider-highlight').style.width = `${p}%`;
}
function createDualSlider(label, keys) {
    const div = document.createElement('div'); div.className = 'control-group'; div.style.flex = "1";
    div.innerHTML = `<label>${label}</label><div class="custom-slider-container"><div class="custom-slider-track"></div><div class="custom-slider-highlight"></div><div class="thumb" id="tMin"></div><div class="thumb" id="tMax"></div></div>`;
    ui.controls.appendChild(div);
    const tMin = div.querySelector('#tMin'), tMax = div.querySelector('#tMax'), hl = div.querySelector('.custom-slider-highlight'), track = div.querySelector('.custom-slider-container');
    function update() {
        const pMin = (appState[keys[0]] - 0) / (1 - 0) * 100, pMax = (appState[keys[1]] - 0) / (1 - 0) * 100;
        tMin.style.left = `calc(${pMin}% - 10px)`; tMax.style.left = `calc(${pMax}% - 10px)`; hl.style.left = `${pMin}%`; hl.style.width = `${pMax - pMin}%`;
    }
    function drag(e, isMax) {
        const rect = track.getBoundingClientRect();
        let x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        let v = Math.max(0, Math.min(1, x / rect.width)); v = Math.round(v * 20) / 20;
        if(!isMax) { if(v >= appState[keys[1]]) v = appState[keys[1]] - 0.05; appState[keys[0]] = v; } else { if(v <= appState[keys[0]]) v = appState[keys[0]] + 0.05; appState[keys[1]] = v; }
        update(); sendData(false);
    }
    [tMin, tMax].forEach((el, idx) => { el.addEventListener('mousedown', (e) => { const move = (ev) => drag(ev, idx===1); const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); sendData(true); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); }); });
    update();
}
function initSliderLogic(container, thumb, highlight, min, max, step, callback) {
    function drag(e) {
        const rect = container.getBoundingClientRect();
        let x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        let v = min + (x / rect.width) * (max - min); v = Math.max(min, Math.min(max, v)); v = Math.round(v / step) * step; v = parseFloat(v.toFixed(2));
        const p = (v - min) / (max - min) * 100; thumb.style.left = `calc(${p}% - 10px)`; highlight.style.width = `${p}%`; callback(v); sendData(false);
    }
    thumb.addEventListener('mousedown', (e) => { const move = (ev) => drag(ev); const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); sendData(true); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); });
    container.addEventListener('mousedown', (e) => { if(e.target===thumb)return; drag(e); sendData(true); });
}

// --- HELPERS ---
function rgbToHex(rgb) { return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1); }
function hexToRgb(hex) { const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16); return [r,g,b]; }
function formatVal(v, isP) { return isP ? Math.round(v*100)+"%" : v+"x"; }

let _statusTimeout = null;
function showTempStatus(msg, ms=2000) {
    ui.status.innerText = msg;
    if (_statusTimeout) clearTimeout(_statusTimeout);
    _statusTimeout = setTimeout(() => { ui.status.innerText = (isConnected ? (comms.resolveMode()==='http'? 'Connected (HTTP)':'Connected') : 'Ready'); }, ms);
}

// --- VISUALIZER ---
function animate() {
    const now = Date.now()/1000;
    let r=0, g=0, b=0, opacity=0.0;

    if(isConnected || isOfflineMode) { // Render if connected OR offline mode
        if(appState.mode === "solid") {
            [r,g,b] = appState.solid_color; 
            opacity = appState.solid_bright; 
        } 
        else if(appState.mode === "fade") {
            let m = appState.fade_min + ((Math.sin(now*appState.fade_speed*3)+1)/2) * (appState.fade_max-appState.fade_min);
            let cr, cg, cb;
            if(appState.fade_use_2) {
                let c1 = appState.fade_color, c2 = appState.fade_color_2;
                cr = c1[0]+(c2[0]-c1[0])*m; cg = c1[1]+(c2[1]-c1[1])*m; cb = c1[2]+(c2[2]-c1[2])*m;
            } else {
                [cr,cg,cb] = appState.fade_color; cr*=m; cg*=m; cb*=m;
            }
            let maxVal = Math.max(cr, cg, cb, 1);
            opacity = maxVal / 255;
            r = (cr/maxVal)*255; g = (cg/maxVal)*255; b = (cb/maxVal)*255;
        }
    }
    
    r=Math.round(r); g=Math.round(g); b=Math.round(b);
    document.documentElement.style.setProperty('--glow-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--glow-opacity', opacity);

    if((isConnected || isOfflineMode) && appState.mode === "snake") {
        document.documentElement.style.setProperty('--glow-opacity', 0.2); 
        let grad = "";
        if(appState.snake_color_mode === 'single') {
            let c = rgbToHex(appState.snake_color_1);
            document.documentElement.style.setProperty('--glow-rgb', `${appState.snake_color_1.join(',')}`); 
            grad = `linear-gradient(90deg, transparent 0%, ${c} 50%, transparent 100%)`;
        } else if (appState.snake_color_mode === 'gradient') {
            let c1 = rgbToHex(appState.snake_color_1);
            let c2 = rgbToHex(appState.snake_color_2);
            grad = `linear-gradient(90deg, transparent 0%, ${c1} 40%, ${c2} 60%, transparent 100%)`;
        } else {
            grad = `linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet, red)`;
        }
        ui.glowLayer.style.background = grad;
        ui.glowLayer.style.backgroundSize = "200% 100%"; 
        let speed = appState.snake_speed * 50; 
        let offset = (now * speed) % 200;
        if(!appState.snake_cw) offset = -offset;
        ui.glowLayer.style.backgroundPosition = `${offset}% 0%`;
    } else {
        ui.glowLayer.style.background = `radial-gradient(circle, rgba(var(--glow-rgb), var(--glow-opacity)) 0%, rgba(var(--glow-rgb), var(--glow-opacity)) 100%)`;
        ui.glowLayer.style.backgroundSize = ""; ui.glowLayer.style.backgroundPosition = "";
    }
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

ui.defaults.addEventListener('click', () => {
     appState = {
        mode: "solid",
        solid_color: [255, 230, 0], solid_bright: 0.8,
        fade_color: [255, 200, 0], fade_color_2: [255, 220, 0], fade_use_2: true, fade_min: 0.1, fade_max: 0.9, fade_speed: 0.9,
        snake_color_mode: "rainbow", snake_color_1: [255, 0, 0], snake_color_2: [0, 0, 255], snake_cw: true, snake_speed: 1.0
     };
     ui.modeSelect.value = "solid";
     drawControls();
     sendData(true);
});

// Comms mode selector and asset base apply handlers
const commsSelect = document.getElementById('commsMode');
if (commsSelect) {
    commsSelect.value = comms.mode;
    commsSelect.addEventListener('change', (e) => { comms.setMode(e.target.value); ui.status.innerText = `Mode: ${comms.mode}`; comms.requestState(); });
}
const assetInput = document.getElementById('assetBase');
const applyAssetsBtn = document.getElementById('applyAssetsBtn');
if (assetInput) assetInput.value = ASSET_BASE || '';
if (applyAssetsBtn) applyAssetsBtn.addEventListener('click', () => { const base = assetInput.value.trim(); applyAssets(base); ui.status.innerText = 'Assets applied'; });

// If in HTTP preferred mode at startup, try to sync state
if (comms.resolveMode() === 'http') comms.requestState();

// Device IP persistence and WiFi configuration UI
let storedDeviceIP = localStorage.getItem('device_ip') || '';
const deviceIpInput = document.getElementById('deviceIp');
const pingBtn = document.getElementById('pingBtn');
if (deviceIpInput) deviceIpInput.value = storedDeviceIP || '';

async function fetchWithTimeout(url, opts={}, timeout=1500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const resp = await fetch(url, Object.assign({}, opts, {signal: controller.signal}));
        clearTimeout(id);
        return resp;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

comms.getBaseUrls = function() {
    const bases = [];
    if (storedDeviceIP) bases.push(`http://${storedDeviceIP}`);
    bases.push('http://zonai.local'); // try mDNS name
    // Only include page origin if it's an HTTP (not HTTPS) origin or localhost (useful for local testing)
    try {
        const origin = window.location.origin || '';
        if (origin.startsWith('http://') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            bases.push(origin);
        }
    } catch(e) {}
    bases.push(''); // relative
    return bases;
}

comms.requestState = async function() {
    if (this.resolveMode() === 'serial') {
        if (isConnected) sendRaw({ get_state: true });
        return;
    }
    ui.status.innerText = 'Searching (HTTP)...';
    for (const base of this.getBaseUrls()) {
        let url = base ? `${base}/state` : '/state';
        // Try twice per base quickly
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const resp = await fetchWithTimeout(url, {}, 1200);
                if (resp.ok) {
                    const d = await resp.json();
                    Object.assign(appState, d);
                    showTempStatus(base ? `Synced (${base})` : 'Synced', 3000);
                    if (base && base.startsWith('http://') && base !== window.location.origin) {
                        const detected = base.replace('http://','');
                        storedDeviceIP = detected.split('/')[0];
                        localStorage.setItem('device_ip', storedDeviceIP);
                        if (deviceIpInput) deviceIpInput.value = storedDeviceIP;
                    }
                    enableControls('http');
                    drawControls();
                    return;
                }
            } catch (e) {
                // retry once then move on
                if (attempt === 0) await new Promise(r => setTimeout(r, 220));
            }
        }
    }
    ui.status.innerText = 'No HTTP device';
}

async function submitWifi(ssid, pass) {
    ui.wifiStatus = document.getElementById('wifiStatus');
    if (!ssid) { ui.wifiStatus.innerText = 'SSID required'; return; }
    ui.wifiStatus.innerText = 'Sending...';

    if (comms.resolveMode() === 'serial') {
        // Fallback over serial
        try {
            sendRaw({ wifi: { ssid: ssid, pass: pass } });
            ui.wifiStatus.innerText = 'Sent via serial — waiting for device...';
            if (pendingSerialWifi && pendingSerialWifi.timeout) clearTimeout(pendingSerialWifi.timeout);
            pendingSerialWifi = { timeout: setTimeout(() => { ui.wifiStatus.innerText = 'No response (serial)'; pendingSerialWifi = null; }, 20000) };
        } catch (e) { ui.wifiStatus.innerText = 'Serial send failed'; }
        return;
    }

    // HTTP path: try base urls and POST /wifi
    for (const base of comms.getBaseUrls()) {
        const url = base ? `${base}/wifi` : '/wifi';
        try {
            const resp = await fetchWithTimeout(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ssid: ssid, pass: pass}) }, 2500);
            const j = await resp.json();
            if (resp.ok && j.ok) {
                ui.wifiStatus.innerText = `Connected: ${j.ip || ''}`;
                if (j.ip) { storedDeviceIP = j.ip; localStorage.setItem('device_ip', storedDeviceIP); if (deviceIpInput) deviceIpInput.value = storedDeviceIP; }
                comms.requestState();
                // close modal on success
                hideSettingsModal();
                return;
            } else {
                ui.wifiStatus.innerText = `Failed: ${j.error || resp.status}`;
            }
        } catch (e) { /* try next */ }
    }
    ui.wifiStatus.innerText = 'No device responded';
}

function showSettingsModal() {
    const ov = document.getElementById('settingsOverlay'); if(ov) ov.classList.remove('hidden');
    const ws = document.getElementById('wifiStatus'); if(ws) ws.innerText='';
    const assetEl = document.getElementById('assetBase'); if (assetEl) assetEl.value = ASSET_BASE || document.getElementById('githubUrl')?.value || '';
    const deviceIpEl = document.getElementById('deviceIp'); if (deviceIpEl) deviceIpEl.value = storedDeviceIP || '';
    // Hook up log buttons
    const clearBtn = document.getElementById('clearLog'); if (clearBtn) clearBtn.addEventListener('click', () => { const el = document.getElementById('serialLog'); if (el) el.textContent = ''; });
    const downloadBtn = document.getElementById('downloadLog'); if (downloadBtn) downloadBtn.addEventListener('click', () => { const el = document.getElementById('serialLog'); if (!el) return; const blob = new Blob([el.textContent], {type:'text/plain'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'serial_log.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
    const fetchBtn = document.getElementById('fetchLogs'); if (fetchBtn) fetchBtn.addEventListener('click', async () => { if (storedDeviceIP) { try { const resp = await fetchWithTimeout(`http://${storedDeviceIP}/logs`, {}, 1500); if (resp.ok) { const j = await resp.json(); if (j.logs) { const el = document.getElementById('serialLog'); if (el) el.textContent = j.logs.join('\n'); } } } catch(e){ appendSerialLog('ERR', 'fetchLogs failed: '+e); } } else appendSerialLog('INFO', 'No device IP stored'); });
}
function hideSettingsModal() { const ov = document.getElementById('settingsOverlay'); if(ov) ov.classList.add('hidden'); }

const settingsBtn = document.getElementById('settingsBtn'); if (settingsBtn) settingsBtn.addEventListener('click', showSettingsModal);
const settingsClose = document.getElementById('settingsClose'); if (settingsClose) settingsClose.addEventListener('click', hideSettingsModal);
const settingsOverlayEl = document.getElementById('settingsOverlay'); if (settingsOverlayEl) settingsOverlayEl.addEventListener('click', (e) => { if (e.target === settingsOverlayEl) hideSettingsModal(); });

const wifiCancel = document.getElementById('wifiCancel'); if (wifiCancel) wifiCancel.addEventListener('click', hideSettingsModal);
const wifiSubmit = document.getElementById('wifiSubmit'); if (wifiSubmit) wifiSubmit.addEventListener('click', async () => {
    const ssid = document.getElementById('wifi_ssid').value.trim();
    const pass = document.getElementById('wifi_pass').value;
    document.getElementById('wifiStatus').innerText = 'Attempting...';
    await submitWifi(ssid, pass);
});

// Update versions display (if present in DOM)
try {
    const verEl = document.getElementById('versions');
    if (verEl) verEl.innerText = `HTML ${HTML_VERSION} · JS ${JS_VERSION} · CSS ${CSS_VERSION}`;
} catch (e) {}


if (pingBtn) pingBtn.addEventListener('click', async () => {
    const ipVal = (deviceIpInput && deviceIpInput.value.trim()) || storedDeviceIP;
    if (ipVal) {
        showTempStatus('Pinging ' + ipVal + '...', 3000);
        try {
            const resp = await fetchWithTimeout(`http://${ipVal}/health`, {}, 1000);
            if (resp.ok) { showTempStatus(`Device ${ipVal} OK`, 2000); storedDeviceIP = ipVal; localStorage.setItem('device_ip', storedDeviceIP); comms.requestState(); return; }
        } catch (e) {}
        try {
            const resp = await fetchWithTimeout(`http://${ipVal}/state`, {}, 1000);
            if (resp.ok) { showTempStatus(`Device ${ipVal} OK`, 2000); storedDeviceIP = ipVal; localStorage.setItem('device_ip', storedDeviceIP); comms.requestState(); return; }
        } catch (e) { showTempStatus('No response', 2000); }
    } else { showTempStatus('No IP specified', 2000); }
});