// VERSION = "v0.31"
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
        if (!element.dataset.typewriterDefault) {
            element.dataset.typewriterDefault = element.innerHTML;
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
        if (id === "8") {
            resetPanel8();
        }
        runTypewriterForPanel(target);
        updatePanelJump(id);
        if (id === "4") {
            startPanel4Sequence();
        } else {
            cancelPanel4Sequence();
        }

        if (id === "6") {
            startPanel6Sequence();
        } else {
            cancelPanel6Sequence();
        }

        if (id === "7") {
            startPanel7Sequence();
        } else {
            cancelPanel7Sequence();
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
        opacity: style.getPropertyValue(`--link-step-${index}-opacity`).trim() || "1",
        blend: style.getPropertyValue(`--link-step-${index}-blend`).trim() || "normal",
    });

    const applyPanel4Step = (step) => {
        if (!panel4Link) return;
        panel4Link.style.setProperty("--link-x", step.x);
        panel4Link.style.setProperty("--link-y", step.y);
        panel4Link.style.setProperty("--link-scale", step.scale);
        panel4Link.style.setProperty("--link-blend", step.blend);
    };

    const setLinkOpacity = (value) => {
        if (!panel4Link) return;
        panel4Link.style.setProperty("--link-opacity", value);
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
        setLinkOpacity(steps[0].opacity);
        await delay(steps[0].hold);
        for (let i = 1; i < steps.length; i += 1) {
            if (!isActive()) return;
            setLinkOpacity("0");
            await delay(fadeDuration);
            if (!isActive()) return;
            applyPanel4Step(steps[i]);
            setLinkOpacity(steps[i].opacity);
            await delay(fadeDuration + steps[i].hold);
        }

        if (!isActive()) return;
        setLinkOpacity("0");
        await delay(fadeDuration);
        if (!isActive()) return;
        const nextId = getNextPanelId("4");
        if (nextId) {
            goToPanel(nextId);
        }
    };

    const panel6 = container.querySelector(".panel-6");
    const panel6Link = panel6 ? panel6.querySelector(".link-walk-6") : null;
    const panel6Text = panel6 ? panel6.querySelector(".blessing-text") : null;
    let panel6SequenceId = 0;

    const getPanel6Step = (index, style) => ({
        x: style.getPropertyValue(`--link6-step-${index}-x`).trim() || "50%",
        y: style.getPropertyValue(`--link6-step-${index}-y`).trim() || "70%",
        scale: style.getPropertyValue(`--link6-step-${index}-scale`).trim() || "1",
        shadow: style.getPropertyValue(`--link6-step-${index}-shadow`).trim() || "0.65",
    });

    const applyPanel6Step = (step) => {
        if (!panel6Link) return;
        panel6Link.style.setProperty("--link6-x", step.x);
        panel6Link.style.setProperty("--link6-y", step.y);
        panel6Link.style.setProperty("--link6-scale", step.scale);
        panel6Link.style.setProperty("--link6-shadow-opacity", step.shadow);
    };

    const setPanel6Opacity = (value) => {
        if (!panel6Link) return;
        panel6Link.style.setProperty("--link6-opacity", value);
    };

    const setBlessingTextState = (opacity, blur) => {
        if (!panel6Text) return;
        panel6Text.style.setProperty("--bless-opacity", opacity);
        panel6Text.style.setProperty("--bless-blur", blur);
    };

    const cancelPanel6Sequence = () => {
        panel6SequenceId += 1;
    };

    const startPanel6Sequence = async () => {
        if (!panel6) return;
        const sequenceId = ++panel6SequenceId;
        const isActive = () => sequenceId === panel6SequenceId && panel6.classList.contains("is-active");
        const panel6Style = getComputedStyle(panel6);
        const steps = [
            { ...getPanel6Step(1, panel6Style), hold: 1000 },
            { ...getPanel6Step(2, panel6Style), hold: 1000 },
            { ...getPanel6Step(3, panel6Style), hold: 1000 },
            { ...getPanel6Step(4, panel6Style), hold: 1000 },
        ];
        const fadeDuration = 1050;
        const textFadeDuration = 2000;
        const textHoldDuration = 4500;
        const walkDelay = 2000;

        if (panel6Link) {
            applyPanel6Step(steps[0]);
            setPanel6Opacity("1");
        }

        if (panel6Text) {
            setBlessingTextState("0", "12px");
            await delay(1500);
            if (!isActive()) return;
            setBlessingTextState("1", "0px");
            await delay(textFadeDuration + textHoldDuration);
            if (!isActive()) return;
            setBlessingTextState("0", "12px");
            await delay(textFadeDuration + walkDelay);
        } else {
            await delay(walkDelay);
        }

        if (!panel6Link) return;

        setPanel6Opacity("1");
        await delay(steps[0].hold);
        for (let i = 1; i < steps.length; i += 1) {
            if (!isActive()) return;
            setPanel6Opacity("0");
            await delay(fadeDuration);
            if (!isActive()) return;
            applyPanel6Step(steps[i]);
            setPanel6Opacity("1");
            await delay(fadeDuration + steps[i].hold);
        }

        if (!isActive()) return;
        await delay(2000);
        if (!isActive()) return;
        const nextId = getNextPanelId("6");
        if (nextId) {
            goToPanel(nextId);
        }
    };

    const panel7 = container.querySelector(".panel-7");
    const panel7Link = panel7 ? panel7.querySelector(".link-walk-7") : null;
    const panel7Chest = panel7 ? panel7.querySelector(".chest") : null;
    const panel7RewardPopup = panel7 ? panel7.querySelector(".reward-popup") : null;
    const panel7ActionBtn = panel7 ? panel7.querySelector(".panel7-action-btn") : null;
    const panel7ActionLabel = panel7 ? panel7.querySelector(".panel7-action-label") : null;
    const panel7RewardBody = panel7 ? panel7.querySelector(".reward-body") : null;
    let panel7SequenceId = 0;
    let panel7Opened = false;
    let panel7Completed = false;
    let panel7PopupTimeout = null;

    const getPanel7Step = (index, style) => ({
        x: style.getPropertyValue(`--link7-step-${index}-x`).trim() || "50%",
        y: style.getPropertyValue(`--link7-step-${index}-y`).trim() || "80%",
        scale: style.getPropertyValue(`--link7-step-${index}-scale`).trim() || "0.22",
        shadow: style.getPropertyValue(`--link7-step-${index}-shadow`).trim() || "0.6",
    });

    const applyPanel7Step = (step) => {
        if (!panel7Link) return;
        panel7Link.style.setProperty("--link7-x", step.x);
        panel7Link.style.setProperty("--link7-y", step.y);
        panel7Link.style.setProperty("--link7-scale", step.scale);
        panel7Link.style.setProperty("--link7-shadow-opacity", step.shadow);
    };

    const setPanel7Opacity = (value) => {
        if (!panel7Link) return;
        panel7Link.style.setProperty("--link7-opacity", value);
    };

    const showPanel7Button = (label) => {
        if (!panel7ActionBtn || !panel7ActionLabel) return;
        panel7ActionLabel.textContent = label;
        panel7ActionBtn.classList.remove("is-hidden");
    };

    const hidePanel7Button = () => {
        if (!panel7ActionBtn) return;
        panel7ActionBtn.classList.add("is-hidden");
    };

    const resetPanel7 = () => {
        panel7Opened = false;
        panel7Completed = false;
        if (panel7PopupTimeout) {
            clearTimeout(panel7PopupTimeout);
            panel7PopupTimeout = null;
        }
        hidePanel7Button();
        if (panel7Chest) {
            panel7Chest.classList.remove("is-open");
        }
        if (panel7RewardPopup) {
            panel7RewardPopup.classList.add("is-hidden");
        }
        if (panel7RewardBody) {
            delete panel7RewardBody.dataset.typed;
        }
    };

    const startPanel7Sequence = async () => {
        if (!panel7) return;
        const sequenceId = ++panel7SequenceId;
        const isActive = () => sequenceId === panel7SequenceId && panel7.classList.contains("is-active");
        const panel7Style = getComputedStyle(panel7);
        const steps = [
            { ...getPanel7Step(1, panel7Style), hold: 800 },
            { ...getPanel7Step(2, panel7Style), hold: 800 },
        ];
        const fadeDuration = 700;

        resetPanel7();
        if (panel7Link) {
            applyPanel7Step(steps[0]);
            setPanel7Opacity("1");
        }
        await delay(steps[0].hold);
        if (!isActive()) return;
        if (panel7Link) {
            setPanel7Opacity("0");
            await delay(fadeDuration);
            if (!isActive()) return;
            applyPanel7Step(steps[1]);
            setPanel7Opacity("1");
        }
        await delay(steps[1].hold);
        if (!isActive()) return;
        showPanel7Button("Open chest");
    };

    const cancelPanel7Sequence = () => {
        panel7SequenceId += 1;
    };

    const panel8 = container.querySelector(".panel-8");
    const panel8Body = panel8 ? panel8.querySelector(".dialog-body") : null;
    const panel8Choices = panel8 ? Array.from(panel8.querySelectorAll(".panel8-choice-btn")) : [];
    const panel8DefaultText = panel8Body?.dataset.typewriterDefault || "";
    let panel8ChoiceLocked = false;

    const resetPanel8 = () => {
        panel8ChoiceLocked = false;
        panel8Choices.forEach((button) => button.classList.add("is-hidden"));
        if (panel8Body) {
            if (panel8DefaultText) {
                panel8Body.dataset.typewriterSource = panel8DefaultText;
            }
            delete panel8Body.dataset.typed;
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

    const startTypewriter = (element, options = {}) => {
        if (!element || element.dataset.typed === "true") return;
        const { onComplete } = options;
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
                if (typeof onComplete === "function") {
                    onComplete();
                }
            }
        };

        typeNext();
    };

    const runTypewriterForPanel = (panel) => {
        const targets = Array.from(panel.querySelectorAll("[data-typewriter=\"true\"]"))
            .filter((element) => element.dataset.typewriterAuto !== "false");
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

    const toTitleCase = (value) =>
        value
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase());

    const submitPanelName = () => {
        if (!namePopupInput) return;
        const name = toTitleCase(namePopupInput.value.trim());
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
            goToPanel(3);
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

    if (panel7ActionBtn) {
        panel7ActionBtn.addEventListener("click", (event) => {
            event.preventDefault();
            panel7ActionBtn.blur();
            if (!panel7 || !panel7.classList.contains("is-active")) return;
            if (!panel7Opened) {
                panel7Opened = true;
                hidePanel7Button();
                if (panel7Chest) {
                    panel7Chest.classList.add("is-open");
                }
                panel7PopupTimeout = setTimeout(() => {
                    if (!panel7 || !panel7.classList.contains("is-active")) return;
                    if (panel7RewardPopup) {
                        panel7RewardPopup.classList.remove("is-hidden");
                    }
                    if (panel7RewardBody) {
                        startTypewriter(panel7RewardBody, {
                            onComplete: () => {
                                panel7Completed = true;
                                showPanel7Button("Complete shrine");
                            },
                        });
                    } else {
                        panel7Completed = true;
                        showPanel7Button("Complete shrine");
                    }
                    panel7PopupTimeout = null;
                }, 1500);
                return;
            }
            if (panel7Completed) {
                goToPanel(8);
            }
        });
    }

    panel8Choices.forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            button.blur();
            if (!panel8 || !panel8.classList.contains("is-active")) return;
            if (panel8ChoiceLocked) return;
            panel8ChoiceLocked = true;
            panel8Choices.forEach((choice) => choice.classList.add("is-hidden"));
            const choice = button.dataset.choice;
            if (choice === "yes") {
                goToPanel(10);
                return;
            }
            if (panel8Body) {
                panel8Body.dataset.typewriterSource =
                    "Well, too bad for you, I'm going to anyway!";
                delete panel8Body.dataset.typed;
                startTypewriter(panel8Body, {
                    onComplete: () => {
                        if (panel8.classList.contains("is-active")) {
                            goToPanel(10);
                        }
                    },
                });
            } else {
                goToPanel(10);
            }
        });
    });

    panels.forEach((panel) => {
        panel.addEventListener("click", (event) => {
            if (!panel.classList.contains("is-active")) return;
            if (event.target.closest("button, a, input, select, textarea, [role=\"button\"]")) return;
            if (hasInteractiveContent(panel)) return;
            if (["4", "6"].includes(panel.dataset.panel)) return;

            const nextId = getNextPanelId(panel.dataset.panel);
            if (nextId) {
                goToPanel(nextId);
            }
        });
    });

    const initialPanel = container.querySelector(".panel.is-active");
    if (initialPanel) {
        if (initialPanel.dataset.panel === "8") {
            resetPanel8();
        }
        runTypewriterForPanel(initialPanel);
        updatePanelJump(initialPanel.dataset.panel);
        if (initialPanel.dataset.panel === "4") {
            startPanel4Sequence();
        }
        if (initialPanel.dataset.panel === "6") {
            startPanel6Sequence();
        }
        if (initialPanel.dataset.panel === "7") {
            startPanel7Sequence();
        }
    }

    window.setPanel = setActivePanel;
    window.goToPanel = goToPanel;
})();
