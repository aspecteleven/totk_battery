// VERSION = "v0.8"
import { Curtains, Plane } from "https://cdn.jsdelivr.net/npm/curtainsjs@8.1.4/src/index.mjs";

const defaultRippleSettings = {
    speed: 0.25,
    frequency: 48.0,
    amplitude: 0.005,
    edgeStart: 0.25,
    edgeEnd: 1.0,
    maskSrc: "../images/blur_vignette_alpha.png",
};

const panelRippleSettings = {
    "1": {
        speed: 0.7,
        frequency: 36.0,
        amplitude: 0.007,
        edgeStart: 0.2,
        edgeEnd: 1.0,
        maskSrc: "../images/panel1_vignette_alpha.png",
    },
    "4": {
        speed: 0.7,
        frequency: 36.0,
        amplitude: 0.007,
        edgeStart: 0.7,
        edgeEnd: 1.0,
        maskSrc: "../images/panel1_vignette_alpha.png",
    },
    "5": {
        speed: 0.4,
        frequency: 36.0,
        amplitude: 0.007,
        edgeStart: 0.7,
        edgeEnd: 1.0,
        maskSrc: "../images/panel1_vignette_alpha.png",
    },
    "6": {
        speed: 0.4,
        frequency: 36.0,
        amplitude: 0.007,
        edgeStart: 0.7,
        edgeEnd: 1.0,
        maskSrc: "../images/panel1_vignette_alpha.png",
    },
    "9": { amplitude: 0.0 },
    "10": { amplitude: 0.0 },
};

const vertexShader = `
precision mediump float;
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
varying vec2 vTextureCoord;

void main() {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

const fragmentShader = `
precision mediump float;
varying vec2 vTextureCoord;

uniform sampler2D uActiveTexture;
uniform sampler2D uNextTexture;
uniform sampler2D uMaskTexture;
uniform float uTime;
uniform float uTransition;
uniform float uRippleSpeed;
uniform float uRippleFrequency;
uniform float uRippleAmplitude;
uniform float uEdgeStart;
uniform float uEdgeEnd;

void main() {
    vec2 uv = vTextureCoord;
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(uv, center);

    float ripplePhase = uTime * uRippleSpeed;
    float ripple = sin(dist * uRippleFrequency - ripplePhase) * uRippleAmplitude;

    float maskValue = texture2D(uMaskTexture, uv).a;
    float edgeMask = smoothstep(uEdgeStart, uEdgeEnd, maskValue);
    ripple *= edgeMask;

    vec2 dir = dist > 0.0 ? normalize(uv - center) : vec2(0.0);
    vec2 distortedUV = uv + dir * ripple;

    vec4 color1 = texture2D(uActiveTexture, distortedUV);
    vec4 color2 = texture2D(uNextTexture, distortedUV);
    float fade = smoothstep(0.0, 1.0, uTransition);
    gl_FragColor = mix(color1, color2, fade);
}
`;

const state = {
    curtains: null,
    plane: null,
    ready: false,
    transitioning: false,
    activeIndex: "1",
    container: null,
    currentMaskSrc: "",
    textures: {
        active: null,
        next: null,
        mask: null,
    },
    panelSources: new Map(),
    colorImages: new Map(),
    maskImages: new Map(),
};

const createColorImage = (color) => {
    if (state.colorImages.has(color)) {
        return state.colorImages.get(color);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    state.colorImages.set(color, img);
    return img;
};

const buildPanelSources = () => {
    state.panelSources.clear();
    const panelElements = Array.from(document.querySelectorAll(".panel"));
    panelElements.forEach((panel) => {
        const id = panel.dataset.panel;
        if (!id) return;
        const bgImg = panel.querySelector(".panel-bg");
        if (bgImg) {
            state.panelSources.set(id, bgImg);
            return;
        }
        const color = getComputedStyle(panel).backgroundColor || "#000";
        state.panelSources.set(id, createColorImage(color));
    });
};

const createPlaneTextures = () => {
    if (!state.plane) return;
    state.textures.active = state.plane.createTexture({ sampler: "uActiveTexture" });
    state.textures.next = state.plane.createTexture({ sampler: "uNextTexture" });
    state.textures.mask = state.plane.createTexture({ sampler: "uMaskTexture" });
};

const getRippleSettings = (panelId) => {
    const overrides = panelRippleSettings[panelId] || {};
    return { ...defaultRippleSettings, ...overrides };
};

const setMaskSource = (src) => {
    if (!state.textures.mask || !src || src === state.currentMaskSrc) return;
    state.currentMaskSrc = src;

    if (state.maskImages.has(src)) {
        state.textures.mask.setSource(state.maskImages.get(src));
        return;
    }

    const maskImage = new Image();
    maskImage.onload = () => {
        state.textures.mask.setSource(maskImage);
    };
    maskImage.src = src;
    state.maskImages.set(src, maskImage);
};

export const applyRippleSettings = (panelId) => {
    if (!state.plane) return;
    const settings = getRippleSettings(String(panelId));
    state.plane.uniforms.rippleSpeed.value = settings.speed;
    state.plane.uniforms.rippleFrequency.value = settings.frequency;
    state.plane.uniforms.rippleAmplitude.value = settings.amplitude;
    state.plane.uniforms.edgeStart.value = settings.edgeStart;
    state.plane.uniforms.edgeEnd.value = settings.edgeEnd;
    setMaskSource(settings.maskSrc);
};

export const initBackgrounds = () => {
    if (state.curtains) return;

    const canvas = document.getElementById("canvas");
    const planeElement = document.getElementById("webgl-plane");
    state.container = document.querySelector(".panels");
    if (!canvas || !planeElement) return;

    buildPanelSources();

    state.curtains = new Curtains({
        container: canvas,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });

    state.plane = new Plane(state.curtains, planeElement, {
        vertexShader,
        fragmentShader,
        widthSegments: 20,
        heightSegments: 20,
        uniforms: {
            time: { name: "uTime", type: "1f", value: 0 },
            transition: { name: "uTransition", type: "1f", value: 0 },
            rippleSpeed: { name: "uRippleSpeed", type: "1f", value: defaultRippleSettings.speed },
            rippleFrequency: { name: "uRippleFrequency", type: "1f", value: defaultRippleSettings.frequency },
            rippleAmplitude: { name: "uRippleAmplitude", type: "1f", value: defaultRippleSettings.amplitude },
            edgeStart: { name: "uEdgeStart", type: "1f", value: defaultRippleSettings.edgeStart },
            edgeEnd: { name: "uEdgeEnd", type: "1f", value: defaultRippleSettings.edgeEnd },
        },
    });

    state.plane.onReady(() => {
        createPlaneTextures();

        const firstSource = state.panelSources.get("1");
        const secondSource = state.panelSources.get("2") || firstSource;
        if (state.textures.active && firstSource) {
            state.textures.active.setSource(firstSource);
        }
        if (state.textures.next && secondSource) {
            state.textures.next.setSource(secondSource);
        }
        applyRippleSettings(state.activeIndex);

        if (state.container) {
            state.container.classList.add("use-webgl");
        }
        state.ready = true;
    });

    state.plane.onRender(() => {
        if (state.plane) {
            state.plane.uniforms.time.value += 0.02;
        }
    });

    state.curtains.onError(() => {
        if (state.container) {
            state.container.classList.remove("use-webgl");
        }
    });
};

export const triggerRippleTransition = (nextPanelIndex, duration = 1000) => {
    if (!state.ready || !state.plane || state.transitioning) return false;
    const nextIndex = String(nextPanelIndex);
    if (nextIndex === state.activeIndex) return false;

    const nextSource = state.panelSources.get(nextIndex);
    if (!nextSource || !state.textures.active || !state.textures.next) return false;

    state.textures.next.setSource(nextSource);
    state.transitioning = true;
    if (state.container) {
        state.container.classList.add("use-webgl");
    }

    const startTime = performance.now();

    const animate = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        state.plane.uniforms.transition.value = progress;

        if (progress < 1) {
            requestAnimationFrame(animate);
            return;
        }

        state.textures.active.setSource(nextSource);
        state.plane.uniforms.transition.value = 0;
        state.activeIndex = nextIndex;
        state.transitioning = false;
        applyRippleSettings(state.activeIndex);
    };

    requestAnimationFrame(animate);
    return true;
};
