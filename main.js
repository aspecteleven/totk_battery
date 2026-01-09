// --- INTRO LOGIC ---
const intro = {
    screen: document.getElementById('introScreen'),
    prompt: document.getElementById('introPrompt'),
    input: document.getElementById('nameInput'),
    inputWrap: document.querySelector('.name-input-wrap'),
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
    localStorage.removeItem('coachmark_pending');
    localStorage.removeItem('coachmark_step1');
    localStorage.removeItem('coachmark_step2');
    localStorage.removeItem('coachmark_step3');
    localStorage.removeItem('coachmark_defaults');
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
        const formattedName = toTitleCase(savedName);
        if (formattedName !== savedName) localStorage.setItem('zonai_user', formattedName);
        intro.prompt.style.display = 'none';
        intro.input.style.display = 'none';
        if (intro.inputWrap) intro.inputWrap.style.display = 'none';
        setSubmitVisibility(false);
        setTimeout(() => {
            typeWriter(`Welcome back, ${formattedName}.<br>The Shrine awaits.`);
        }, 500);
    } else {
        intro.prompt.style.display = 'block';
        if (intro.inputWrap) {
            intro.inputWrap.style.display = 'flex';
            intro.inputWrap.classList.remove('visible');
        }
        intro.prompt.textContent = "";
        setSubmitVisibility(false);
        typePrompt("Greetings, traveler!|May I know your name?", () => {
            if (intro.inputWrap) intro.inputWrap.classList.add('visible');
            setTimeout(() => {
                intro.input.focus();
                updateSubmitVisibility();
            }, 200);
        });
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
    const formattedName = toTitleCase(name);
    localStorage.setItem('zonai_user', formattedName);
    localStorage.setItem('coachmark_pending', '1');
    intro.input.style.display = 'none';
    if (intro.inputWrap) intro.inputWrap.style.display = 'none';
    intro.prompt.style.display = 'none';
    setSubmitVisibility(false);
    typeWriter(`Welcome, ${formattedName}.<br>Enjoy your Zonai Lantern.`);
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

function typePrompt(text, done) {
    let i = 0;
    intro.prompt.textContent = "";
    function tick() {
        if (i < text.length) {
            const char = text.charAt(i);
            if (char === "|") {
                intro.prompt.appendChild(document.createElement("br"));
            } else {
                intro.prompt.appendChild(document.createTextNode(char));
            }
            i++;
            setTimeout(tick, 75);
        } else if (typeof done === "function") {
            done();
        }
    }
    tick();
}

intro.btn.addEventListener('click', () => {
    intro.main.classList.add('visible'); 
    intro.screen.classList.add('mist-out');
    intro.resetBtn.style.display = 'none';
    // Show Demo Button after intro
    setTimeout(() => {
        intro.screen.style.display = 'none';
        intro.offlineBtn.style.display = 'none';
        if (localStorage.getItem('coachmark_pending') === '1' && !coachmarkFlags.step1Shown) {
            showCoachmark(coachmarks.connect, ui.connToggle);
            coachmarkFlags.step1Shown = true;
            localStorage.setItem('coachmark_step1', '1');
            localStorage.removeItem('coachmark_pending');
        }
    }, 2600);
});

initIntro();


// --- MAIN CONTROLLER LOGIC ---
let port, writer, reader, readableStreamClosed;
let keepReading = false;
let isConnected = false;
let isOfflineMode = false;
let controlsEnabled = false;
let serialBuffer = "";

// Default State (Placeholder)
let appState = {
    mode: "solid",
    solid_color: [255, 230, 0], solid_bright: 0.8,
    fade_color: [255, 200, 0], fade_color_2: [0, 255, 179], fade_use_2: false, fade_min: 0.1, fade_max: 0.4, fade_speed: 0.5,
    snake_color_mode: "rainbow", snake_color_1: [255, 0, 0], snake_color_2: [0, 0, 255],
    snake_single_color: [255, 0, 0], snake_grad_color_1: [255, 0, 0], snake_grad_color_2: [255, 102, 0],
    snake_cw: true, snake_speed: 1.0
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

const coachmarks = {
    connect: {
        root: document.getElementById('connectCoachmark'),
        dialog: document.querySelector('#connectCoachmark .coachmark-dialog')
    },
    mode: {
        root: document.getElementById('modeCoachmark'),
        dialog: document.querySelector('#modeCoachmark .coachmark-dialog')
    },
    controls: {
        root: document.getElementById('controlsCoachmark'),
        dialog: document.querySelector('#controlsCoachmark .coachmark-dialog')
    },
    defaults: {
        root: document.getElementById('defaultsCoachmark'),
        dialog: document.querySelector('#defaultsCoachmark .coachmark-dialog')
    }
};

const coachmarkFlags = {
    step1Shown: localStorage.getItem('coachmark_step1') === '1',
    step2Shown: localStorage.getItem('coachmark_step2') === '1',
    step3Shown: localStorage.getItem('coachmark_step3') === '1',
    defaultsShown: localStorage.getItem('coachmark_defaults') === '1'
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
    hideCoachmark(coachmarks.connect);
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
            if (!coachmarkFlags.step2Shown && coachmarkFlags.step1Shown) {
                showCoachmark(coachmarks.mode, ui.modeSelect);
                coachmarkFlags.step2Shown = true;
                localStorage.setItem('coachmark_step2', '1');
            }
            
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
            hideCoachmark(coachmarks.controls);
            hideCoachmark(coachmarks.defaults);
            hideCoachmark(coachmarks.mode);
            enableControls('locked');
        } catch(e) {
            isConnected = false;
            hideCoachmark(coachmarks.controls);
            hideCoachmark(coachmarks.defaults);
            hideCoachmark(coachmarks.mode);
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
            if (appState.mode === "snake") {
                if (appState.snake_color_mode === "single") {
                    appState.snake_single_color = [...appState.snake_color_1];
                } else if (appState.snake_color_mode === "gradient") {
                    appState.snake_grad_color_1 = [...appState.snake_color_1];
                    appState.snake_grad_color_2 = [...appState.snake_color_2];
                }
            }
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

function showCoachmark(mark, targetEl) {
    if (!mark.root || !targetEl) return;
    mark.root.classList.remove('hidden');
    mark.root.classList.add('active');
    mark.root.setAttribute('aria-hidden', 'false');

    setCoachmarkHole(mark, 0, 0, window.innerWidth, window.innerHeight);
    positionCoachmark(mark, targetEl);
    requestAnimationFrame(() => {
        positionCoachmark(mark, targetEl);
    });
}

function hideCoachmark(mark) {
    if (!mark.root || mark.root.classList.contains('hidden')) return;
    mark.root.classList.remove('active');
    setCoachmarkHole(mark, 0, 0, window.innerWidth, window.innerHeight);
    setTimeout(() => {
        mark.root.classList.add('hidden');
        mark.root.setAttribute('aria-hidden', 'true');
    }, 650);
}

function setCoachmarkHole(mark, left, top, right, bottom) {
    mark.root.style.setProperty('--hole-left', `${left}px`);
    mark.root.style.setProperty('--hole-top', `${top}px`);
    mark.root.style.setProperty('--hole-right', `${right}px`);
    mark.root.style.setProperty('--hole-bottom', `${bottom}px`);
}

function positionCoachmark(mark, targetEl) {
    if (!mark.root || mark.root.classList.contains('hidden')) return;
    const rect = targetEl.getBoundingClientRect();
    const padX = 16;
    const padY = 12;
    const left = Math.max(0, rect.left - padX);
    const top = Math.max(0, rect.top - padY);
    const right = Math.min(window.innerWidth, rect.right + padX);
    const bottom = Math.min(window.innerHeight, rect.bottom + padY);
    setCoachmarkHole(mark, left, top, right, bottom);

    const dialog = mark.dialog;
    if (!dialog) return;
    dialog.style.left = "0px";
    dialog.style.top = "0px";
    const dRect = dialog.getBoundingClientRect();
    let dLeft = rect.right + 20;
    let dTop = rect.top - 6;
    if (dLeft + dRect.width > window.innerWidth - 20) dLeft = rect.left - dRect.width - 20;
    if (dTop + dRect.height > window.innerHeight - 20) dTop = window.innerHeight - dRect.height - 20;
    if (dTop < 20) dTop = 20;
    dialog.style.left = `${dLeft}px`;
    dialog.style.top = `${dTop}px`;

}

function handleControlsInteraction() {
    if (coachmarks.controls && !coachmarks.controls.root.classList.contains('hidden')) {
        hideCoachmark(coachmarks.controls);
        if (!coachmarkFlags.defaultsShown && coachmarkFlags.step1Shown) {
            showCoachmark(coachmarks.defaults, ui.defaults);
            coachmarkFlags.defaultsShown = true;
            localStorage.setItem('coachmark_defaults', '1');
        }
    }
}

window.addEventListener('resize', () => {
    Object.values(coachmarks).forEach((mark) => {
        if (mark.root && !mark.root.classList.contains('hidden')) {
            let target = ui.modeSelect;
            if (mark.root.id === 'connectCoachmark') target = ui.connToggle;
            else if (mark.root.id === 'controlsCoachmark') target = ui.controls;
            else if (mark.root.id === 'defaultsCoachmark') target = ui.defaults;
            if (target) positionCoachmark(mark, target);
        }
    });
});

ui.modeSelect.addEventListener('change', () => {
    hideCoachmark(coachmarks.mode);
    if (!coachmarkFlags.step3Shown && coachmarkFlags.step1Shown) {
        showCoachmark(coachmarks.controls, ui.controls);
        coachmarkFlags.step3Shown = true;
        localStorage.setItem('coachmark_step3', '1');
    }
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
        syncSnakeDeviceColors();
        createDropdown("Type", "snake_color_mode", {"single": "Single", "rainbow": "Rainbow", "gradient": "Gradient"});
        if(appState.snake_color_mode === 'single') {
            createSnakeColorInput("Color 1", "snake_single_color", "snake_color_1");
        } else if(appState.snake_color_mode === 'gradient') {
            createSnakeColorInput("Color 1", "snake_grad_color_1", "snake_color_1");
            createSnakeColorInput("Color 2", "snake_grad_color_2", "snake_color_2");
        }
        createCheckbox("Clockwise", "snake_cw");
        createSlider("Speed", "snake_speed", 0.1, 3.0, 0.1);
    }
}

ui.controls.addEventListener('input', () => {
    handleControlsInteraction();
});

ui.controls.addEventListener('change', () => {
    handleControlsInteraction();
});

// --- WIDGETS ---
function createColorInput(label, key) {
    const div = document.createElement('div'); div.className = 'control-group';
    div.innerHTML = `<label>${label}</label><input type="color" value="${rgbToHex(appState[key])}">`;
    div.querySelector('input').addEventListener('input', (e) => { appState[key] = hexToRgb(e.target.value); sendData(false); });
    div.querySelector('input').addEventListener('change', (e) => { appState[key] = hexToRgb(e.target.value); if(key==='snake_color_mode') drawControls(); sendData(true); });
    ui.controls.appendChild(div);
}
function createSnakeColorInput(label, storeKey, deviceKey) {
    const div = document.createElement('div'); div.className = 'control-group';
    div.innerHTML = `<label>${label}</label><input type="color" value="${rgbToHex(appState[storeKey])}">`;
    const input = div.querySelector('input');
    const update = (hex, save) => {
        const rgb = hexToRgb(hex);
        appState[storeKey] = rgb;
        appState[deviceKey] = rgb;
        sendData(save);
    };
    input.addEventListener('input', (e) => { update(e.target.value, false); });
    input.addEventListener('change', (e) => { update(e.target.value, true); });
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
    div.querySelector('select').addEventListener('change', (e) => { 
        appState[key] = isNaN(e.target.value) ? e.target.value : parseInt(e.target.value);
        if (key === "snake_color_mode") syncSnakeDeviceColors();
        drawControls();
        sendData(true);
    });
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
        if (typeof handleControlsInteraction === 'function') handleControlsInteraction();
    }
    thumb.addEventListener('mousedown', (e) => { const move = (ev) => drag(ev); const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); sendData(true); }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); });
    container.addEventListener('mousedown', (e) => { if(e.target===thumb)return; drag(e); sendData(true); });
}

function syncSnakeDeviceColors() {
    if (appState.snake_color_mode === "single") {
        appState.snake_color_1 = [...appState.snake_single_color];
    } else if (appState.snake_color_mode === "gradient") {
        appState.snake_color_1 = [...appState.snake_grad_color_1];
        appState.snake_color_2 = [...appState.snake_grad_color_2];
    }
}

// --- HELPERS ---
function rgbToHex(rgb) { return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1); }
function hexToRgb(hex) { const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16); return [r,g,b]; }
function formatVal(v, isP) { return isP ? Math.round(v*100)+"%" : v+"x"; }
function toTitleCase(name) {
    return name
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

// --- VISUALIZER ---
function animate() {
    const now = Date.now()/1000;
    let r=0, g=0, b=0, opacity=0.0;

    if(isConnected || isOfflineMode) { // Render if connected OR offline mode
        if(appState.mode === "solid") {
            const [sr, sg, sb] = appState.solid_color;
            const maxVal = Math.max(sr, sg, sb);
            if (maxVal === 0) {
                r = 0; g = 0; b = 0; opacity = 0;
            } else {
                r = (sr / maxVal) * 255;
                g = (sg / maxVal) * 255;
                b = (sb / maxVal) * 255;
                opacity = (maxVal / 255) * appState.solid_bright;
            }
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
        const SNAKE_BASE_OPACITY = 0.8;
        const normalizeColor = (rgb) => {
            const m = Math.max(rgb[0], rgb[1], rgb[2]);
            if (m === 0) return [0, 0, 0];
            return [
                Math.round((rgb[0] / m) * 255),
                Math.round((rgb[1] / m) * 255),
                Math.round((rgb[2] / m) * 255)
            ];
        };
        const toSnakeColor = (rgb) => {
            const n = normalizeColor(rgb);
            const a = (Math.max(rgb[0], rgb[1], rgb[2]) / 255) * SNAKE_BASE_OPACITY;
            return { n, a, rgba: `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})` };
        };

        const snakeColors = appState.snake_color_mode === 'single'
            ? [appState.snake_color_1]
            : appState.snake_color_mode === 'gradient'
                ? [appState.snake_color_1, appState.snake_color_2]
                : null;
        const maxVal = snakeColors ? Math.max(...snakeColors.flat()) : 255;

        if (maxVal === 0) {
            document.documentElement.style.setProperty('--glow-opacity', 0);
            ui.glowLayer.style.background = "radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)";
            ui.glowLayer.style.backgroundSize = "";
            ui.glowLayer.style.backgroundPosition = "";
        } else {
            let grad = "";
            if(appState.snake_color_mode === 'single') {
                const c1 = toSnakeColor(appState.snake_color_1);
                document.documentElement.style.setProperty('--glow-rgb', `${c1.n.join(',')}`);
                document.documentElement.style.setProperty('--glow-opacity', c1.a);
                grad = `linear-gradient(90deg, transparent 0%, ${c1.rgba} 50%, transparent 100%)`;
            } else if (appState.snake_color_mode === 'gradient') {
                const c1 = toSnakeColor(appState.snake_color_1);
                const c2 = toSnakeColor(appState.snake_color_2);
                const avg = [
                    Math.round((c1.n[0] + c2.n[0]) / 2),
                    Math.round((c1.n[1] + c2.n[1]) / 2),
                    Math.round((c1.n[2] + c2.n[2]) / 2)
                ];
                document.documentElement.style.setProperty('--glow-rgb', `${avg.join(',')}`);
                document.documentElement.style.setProperty('--glow-opacity', Math.max(c1.a, c2.a));
                grad = `linear-gradient(90deg, transparent 0%, ${c1.rgba} 40%, ${c2.rgba} 60%, transparent 100%)`;
            } else {
                document.documentElement.style.setProperty('--glow-rgb', `255, 255, 255`);
                document.documentElement.style.setProperty('--glow-opacity', SNAKE_BASE_OPACITY);
                grad = `linear-gradient(90deg, rgba(255, 0, 0, ${SNAKE_BASE_OPACITY}), rgba(255, 165, 0, ${SNAKE_BASE_OPACITY}), rgba(255, 255, 0, ${SNAKE_BASE_OPACITY}), rgba(0, 128, 0, ${SNAKE_BASE_OPACITY}), rgba(0, 0, 255, ${SNAKE_BASE_OPACITY}), rgba(75, 0, 130, ${SNAKE_BASE_OPACITY}), rgba(238, 130, 238, ${SNAKE_BASE_OPACITY}), rgba(255, 0, 0, ${SNAKE_BASE_OPACITY}))`;
            }
            ui.glowLayer.style.background = grad;
            ui.glowLayer.style.backgroundSize = "200% 100%"; 
            let speed = appState.snake_speed * 50; 
            let offset = (now * speed) % 200;
            if(!appState.snake_cw) offset = -offset;
            ui.glowLayer.style.backgroundPosition = `${offset}% 0%`;
        }
    } else {
        ui.glowLayer.style.background = `radial-gradient(circle, rgba(var(--glow-rgb), var(--glow-opacity)) 0%, rgba(var(--glow-rgb), var(--glow-opacity)) 100%)`;
        ui.glowLayer.style.backgroundSize = ""; ui.glowLayer.style.backgroundPosition = "";
    }
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

ui.defaults.addEventListener('click', () => {
     hideCoachmark(coachmarks.defaults);
     appState = {
        mode: "solid",
        solid_color: [255, 230, 0], solid_bright: 0.8,
        fade_color: [255, 200, 0], fade_color_2: [0, 255, 179], fade_use_2: false, fade_min: 0.1, fade_max: 0.8, fade_speed: 0.5,
        snake_color_mode: "rainbow", snake_color_1: [255, 0, 0], snake_color_2: [0, 0, 255],
        snake_single_color: [255, 0, 0], snake_grad_color_1: [255, 0, 0], snake_grad_color_2: [255, 102, 0],
        snake_cw: true, snake_speed: 1.0
     };
     ui.modeSelect.value = "solid";
     drawControls();
     sendData(true);
});
    
