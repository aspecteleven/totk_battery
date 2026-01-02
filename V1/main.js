// --- INTRO LOGIC ---
const intro = {
    screen: document.getElementById('introScreen'),
    prompt: document.getElementById('introPrompt'),
    input: document.getElementById('nameInput'),
    welcome: document.getElementById('introWelcome'),
    btn: document.getElementById('continueBtn'),
    main: document.getElementById('mainApp'),
    resetBtn: document.getElementById('resetUserBtn'),
    offlineBtn: document.getElementById('offlineBtn'),
    submitBtn: document.getElementById('submitNameBtn'),
    resetModal: document.getElementById('resetModal'),
    resetCancel: document.getElementById('resetCancel'),
    resetConfirm: document.getElementById('resetConfirm'),
    resetBackdrop: document.querySelector('#resetModal .modal-backdrop')
};

// Reset Logic
intro.resetBtn.addEventListener('click', () => {
    openResetModal();
});

intro.resetCancel.addEventListener('click', closeResetModal);
intro.resetBackdrop.addEventListener('click', closeResetModal);
intro.resetConfirm.addEventListener('click', () => {
    localStorage.removeItem('zonai_user');
    location.reload();
});

function openResetModal() {
    intro.resetModal.classList.remove('hidden');
    intro.resetModal.setAttribute('aria-hidden', 'false');
}

function closeResetModal() {
    intro.resetModal.classList.add('hidden');
    intro.resetModal.setAttribute('aria-hidden', 'true');
}

function initIntro() {
    const savedName = localStorage.getItem('zonai_user');
    if (savedName) {
        intro.prompt.style.display = 'none';
        intro.input.style.display = 'none';
        setSubmitVisibility(false);
        setTimeout(() => {
            typeWriter(`Welcome back, ${savedName}.<br>The Shrine awaits.`);
        }, 500);
    } else {
        intro.input.focus();
        updateSubmitVisibility();
    }
}

intro.input.addEventListener('keydown', (e) => {
    if(e.key === "Enter" && intro.input.value.trim() !== "") submitName();
});
intro.input.addEventListener('input', updateSubmitVisibility);
intro.submitBtn.addEventListener('click', () => {
    if (intro.input.value.trim() !== "") submitName();
});

function submitName() {
    const name = intro.input.value.trim();
    if(!name) return;
    localStorage.setItem('zonai_user', name);
    intro.input.style.display = 'none';
    intro.prompt.style.display = 'none';
    setSubmitVisibility(false);
    typeWriter(`Welcome, ${name}.<br>Enjoy your Zonai Lantern.`);
}

function updateSubmitVisibility() {
    const hasName = intro.input.value.trim().length > 0;
    setSubmitVisibility(hasName);
}

function setSubmitVisibility(show) {
    if (show) {
        intro.submitBtn.classList.remove('hidden');
        intro.submitBtn.classList.add('visible');
    } else {
        intro.submitBtn.classList.add('hidden');
        intro.submitBtn.classList.remove('visible');
    }
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
            await port.open({ baudRate: 115200 });
            
            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
            writer = textEncoder.writable.getWriter();
            
            const textDecoder = new TextDecoderStream();
            readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.getReader();

            isConnected = true; 
            keepReading = true;
            
            enableControls('usb');
            readLoop(); 
            
            // Request State to sync UI
            setTimeout(() => { sendRaw({get_state: true}); }, 400);

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
    for (let line of lines) { if (line.trim().length > 0) parseJSON(line); }
}

function parseJSON(text) {
    try {
        if(text.indexOf('{') > -1) {
            let jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}')+1);
            let d = JSON.parse(jsonStr);
            Object.assign(appState, d);
            // Force UI Update on sync
            if(ui.modeSelect.value !== appState.mode) ui.modeSelect.value = appState.mode;
            if(isConnected) drawControls(); 
        }
    } catch(e) {}
}

async function sendRaw(payload) {
    if (!writer) return;
    try { await writer.write(JSON.stringify(payload)); } catch(e){}
}

async function sendData(save) {
    if(!isConnected) {
        // In offline mode, just updating appState (done by listeners) is enough for visualizer
        return;
    }
    appState.save = save;
    sendRaw(appState);
}

// --- UI MANAGEMENT ---
function enableControls(state) {
    const enabled = (state === 'usb' || state === 'offline');
    
    if(state === 'usb') {
        ui.connToggle.innerText = "Disconnect"; 
        ui.connToggle.className = "btn-disconnect"; 
        ui.status.innerText = "Connected";
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
    
    if(enabled) drawControls(); 
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
    
