// VERSION = "v0.18"
import { applyRippleSettings, initBackgrounds, triggerRippleTransition } from "./background-manager.js";
import { initPanel10App } from "./panel10_app.js";

(() => {
    initBackgrounds();
    initPanel10App();

    const container = document.querySelector(".panels");
    if (!container) return;

    const panels = Array.from(container.querySelectorAll(".panel"));
    const state = {
        activePanel: container.getAttribute("data-active") || "1",
        isAnimating: false,
    };

    const typewriterElements = Array.from(container.querySelectorAll("[data-typewriter=\"true\"]"));
    typewriterElements.forEach((element) => {
        if (!element.dataset.typewriterSource) {
            element.dataset.typewriterSource = element.innerHTML;
        }
    });

    const panelJumpButtons = Array.from(document.querySelectorAll(".panel-jump-btn"));
    const updatePanelJump = (panelId) => {
        panelJumpButtons.forEach((button) => {
            const isActive = button.dataset.panelJump === String(panelId);
            if (isActive) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });
    };

    const setActivePanel = (panelId) => {
        const id = String(panelId);
        const target = container.querySelector(`.panel[data-panel="${id}"]`);
        if (!target) return;

        const activeElement = document.activeElement;
        const activePanel = activeElement?.closest?.(".panel");
        if (activePanel && activePanel !== target) {
            target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
            target.removeAttribute("tabindex");
        }

        panels.forEach((panel) => {
            const isActive = panel === target;
            panel.classList.toggle("is-active", isActive);
            panel.setAttribute("aria-hidden", String(!isActive));
            panel.inert = !isActive;
        });
        container.setAttribute("data-active", id);
        state.activePanel = id;
        applyRippleSettings(id);
        runTypewriterForPanel(target);
        updatePanelJump(id);
        if (id === "4") {
            startPanel4Sequence();
        } else {
            cancelPanel4Sequence();
        }
    };

    const goToPanel = (panelId, duration = 1000) => {
        if (state.isAnimating) return;
        const id = String(panelId);
        if (id === state.activePanel) return;
        state.isAnimating = true;
        const didTrigger = triggerRippleTransition(id, duration);
        const swapDelay = didTrigger ? Math.round(duration / 2) : 0;

        if (swapDelay) {
            setTimeout(() => setActivePanel(id), swapDelay);
        } else {
            setActivePanel(id);
        }

        const endDelay = didTrigger ? duration : 0;
        if (endDelay) {
            setTimeout(() => {
                state.isAnimating = false;
            }, endDelay);
        } else {
            state.isAnimating = false;
        }
    };

    const getNextPanelId = (panelId) => {
        const index = panels.findIndex((panel) => panel.dataset.panel === String(panelId));
        if (index === -1 || index + 1 >= panels.length) return null;
        return panels[index + 1].dataset.panel;
    };

    const hasInteractiveContent = (panel) =>
        Boolean(panel.querySelector("button, a, input, select, textarea, [role=\"button\"]"));

    const panel4 = container.querySelector(".panel-4");
    const panel4Link = panel4 ? panel4.querySelector(".link-walk") : null;
    let panel4SequenceId = 0;

    const getPanel4Step = (index, style) => ({
        x: style.getPropertyValue(`--link-step-${index}-x`).trim() || "50%",
        y: style.getPropertyValue(`--link-step-${index}-y`).trim() || "70%",
        scale: style.getPropertyValue(`--link-step-${index}-scale`).trim() || "1",
    });

    const applyPanel4Step = (step) => {
        if (!panel4Link) return;
        panel4Link.style.setProperty("--link-x", step.x);
        panel4Link.style.setProperty("--link-y", step.y);
        panel4Link.style.setProperty("--link-scale", step.scale);
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const cancelPanel4Sequence = () => {
        panel4SequenceId += 1;
    };

    const startPanel4Sequence = async () => {
        if (!panel4 || !panel4Link) return;
        const sequenceId = ++panel4SequenceId;
        const isActive = () => sequenceId === panel4SequenceId && panel4.classList.contains("is-active");
        const panel4Style = getComputedStyle(panel4);
        const steps = [
            { ...getPanel4Step(1, panel4Style), hold: 1000 },
            { ...getPanel4Step(2, panel4Style), hold: 1000 },
            { ...getPanel4Step(3, panel4Style), hold: 1000 },
            { ...getPanel4Step(4, panel4Style), hold: 1000 },
        ];
        const fadeDuration = 1050;

        applyPanel4Step(steps[0]);
        panel4Link.style.opacity = "1";
        await delay(steps[0].hold);
        for (let i = 1; i < steps.length; i += 1) {
            if (!isActive()) return;
            panel4Link.style.opacity = "0";
            await delay(fadeDuration);
            if (!isActive()) return;
            applyPanel4Step(steps[i]);
            panel4Link.style.opacity = "1";
            await delay(fadeDuration + steps[i].hold);
        }

        if (!isActive()) return;
        panel4Link.style.opacity = "0";
        await delay(fadeDuration);
        if (!isActive()) return;
        const nextId = getNextPanelId("4");
        if (nextId) {
            goToPanel(nextId);
        }
    };

    const buildTypedNodes = (node, containerNode, chars) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, " ");
            const words = text.split(" ");
            words.forEach((word, index) => {
                if (word.length) {
                    const wordSpan = document.createElement("span");
                    wordSpan.className = "type-word";
                    Array.from(word).forEach((char) => {
                        const span = document.createElement("span");
                        span.className = "type-char";
                        span.textContent = char;
                        wordSpan.appendChild(span);
                        chars.push(span);
                    });
                    containerNode.appendChild(wordSpan);
                }
                if (index < words.length - 1) {
                    const spaceSpan = document.createElement("span");
                    spaceSpan.className = "type-char type-space";
                    spaceSpan.textContent = " ";
                    containerNode.appendChild(spaceSpan);
                    chars.push(spaceSpan);
                }
            });
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.tagName === "BR") {
            containerNode.appendChild(document.createElement("br"));
            return;
        }

        const clone = node.cloneNode(false);
        containerNode.appendChild(clone);
        Array.from(node.childNodes).forEach((child) => buildTypedNodes(child, clone, chars));
    };

    const startTypewriter = (element) => {
        if (!element || element.dataset.typed === "true") return;
        const template = document.createElement("template");
        const source = element.dataset.typewriterSource || element.innerHTML;
        template.innerHTML = source.trim();

        const fragment = document.createDocumentFragment();
        const chars = [];
        Array.from(template.content.childNodes).forEach((child) => buildTypedNodes(child, fragment, chars));

        element.innerHTML = "";
        element.appendChild(fragment);

        const panel = element.closest(".panel");
        const panelButtons = panel ? Array.from(panel.querySelectorAll(".typewriter-button")) : [];
        panelButtons.forEach((button) => button.classList.add("is-hidden"));

        const speed = Number(element.dataset.typewriterSpeed || 45);
        let index = 0;

        const typeNext = () => {
            if (index < chars.length) {
                chars[index].classList.add("is-visible");
                index += 1;
                setTimeout(typeNext, speed);
            } else {
                element.dataset.typed = "true";
                panelButtons.forEach((button) => button.classList.remove("is-hidden"));
            }
        };

        typeNext();
    };

    const runTypewriterForPanel = (panel) => {
        const targets = Array.from(panel.querySelectorAll("[data-typewriter=\"true\"]"));
        targets.forEach(startTypewriter);
    };

    const namePopupOverlay = container.querySelector(".panel-3 .name-popup-overlay");
    const namePopupBackdrop = container.querySelector("[data-name-popup-close]");
    const namePopupInput = container.querySelector("#panelNameInput");
    const namePopupSubmit = container.querySelector("#panelNameSubmit");
    const panel3Body = container.querySelector(".panel-3 .dialog-body");
    const panel3ButtonLabel = container.querySelector(".panel-3 .enter-btn-label");
    let panel3Submitted = false;

    const setNameSubmitVisibility = (show) => {
        if (!namePopupSubmit) return;
        namePopupSubmit.classList.toggle("is-visible", show);
    };

    const updateNameSubmitVisibility = () => {
        if (!namePopupInput) return;
        const hasName = namePopupInput.value.trim().length > 0;
        setNameSubmitVisibility(hasName);
    };

    const openNamePopup = () => {
        if (!namePopupOverlay) return;
        namePopupOverlay.classList.add("is-visible");
        namePopupOverlay.setAttribute("aria-hidden", "false");
        updateNameSubmitVisibility();
        if (namePopupInput) {
            namePopupInput.focus();
        }
    };

    const closeNamePopup = () => {
        if (!namePopupOverlay) return;
        namePopupOverlay.classList.remove("is-visible");
        namePopupOverlay.setAttribute("aria-hidden", "true");
    };

    const submitPanelName = () => {
        if (!namePopupInput) return;
        const name = namePopupInput.value.trim();
        if (!name) return;
        localStorage.setItem("zonai_user", name);
        closeNamePopup();
        panel3Submitted = true;
        if (panel3ButtonLabel) {
            panel3ButtonLabel.textContent = "Goodbye.";
        }
        if (panel3Body) {
            panel3Body.dataset.typewriterSource = `Welcome, ${name}. Travel south, to the <span class="dialog-red">Kish-Inbo Shrine.</span> There you will find a treasure that <span class="dialog-red">defeats the shadows.</span>`;
            delete panel3Body.dataset.typed;
            startTypewriter(panel3Body);
        }
    };

    const newGameButton = container.querySelector('.panel-1 .menu-item[data-index="0"]');
    if (newGameButton) {
        newGameButton.addEventListener("click", () => {
            newGameButton.blur();
            goToPanel(2);
        });
    }

    panelJumpButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.panelJump;
            if (target) {
                goToPanel(target);
            }
        });
    });

    const enterButtons = container.querySelectorAll(".enter-btn");
    enterButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            button.blur();
            const panel = button.closest(".panel");
            if (!panel) return;
            const nextId = getNextPanelId(panel.dataset.panel);
            if (panel.dataset.panel === "3") {
                if (panel3Submitted) {
                    if (nextId) goToPanel(nextId);
                } else {
                    openNamePopup();
                }
                return;
            }
            if (nextId) goToPanel(nextId);
        });
    });

    if (namePopupInput) {
        namePopupInput.addEventListener("input", updateNameSubmitVisibility);
        namePopupInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submitPanelName();
            }
        });
    }

    if (namePopupSubmit) {
        namePopupSubmit.addEventListener("click", (event) => {
            event.preventDefault();
            submitPanelName();
        });
    }

    if (namePopupBackdrop) {
        namePopupBackdrop.addEventListener("click", () => {
            closeNamePopup();
        });
    }

    panels.forEach((panel) => {
        panel.addEventListener("click", (event) => {
            if (!panel.classList.contains("is-active")) return;
            if (event.target.closest("button, a, input, select, textarea, [role=\"button\"]")) return;
            if (hasInteractiveContent(panel)) return;

            const nextId = getNextPanelId(panel.dataset.panel);
            if (nextId) {
                goToPanel(nextId);
            }
        });
    });

    const initialPanel = container.querySelector(".panel.is-active");
    if (initialPanel) {
        runTypewriterForPanel(initialPanel);
        updatePanelJump(initialPanel.dataset.panel);
        if (initialPanel.dataset.panel === "4") {
            startPanel4Sequence();
        }
    }

    window.setPanel = setActivePanel;
    window.goToPanel = goToPanel;
})();
