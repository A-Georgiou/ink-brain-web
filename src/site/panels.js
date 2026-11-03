// The board and 3D showcases: each panel plays an explanation written in Ink Brain's language through its own renderers.
import { createRun, playSteps } from "./explain.js";
import { voice } from "./voice.js";

const specs = import.meta.glob(["../specs/fourier.json", "../specs/turbofan.json", "../specs/gearbox.json"], { import: "default" });
const SOURCES = {
    fourier: "Example: a Fourier series, built from spinning circles",
    turbofan: "Example: a turbofan, cut open while it runs",
    gearbox: "Example: a planetary gear set in motion",
};

// The same payload the app sends its panel sandbox: the stage plus one list of actions per narrated step.
const payloadOf = (spec) =>
    spec.board
        ? { kind: "board", content: JSON.stringify({ elements: spec.board.elements, vars: spec.board.vars, steps: spec.steps.map((step) => step.board ?? []), autoplay: false }) }
        : { kind: "scene", content: JSON.stringify({ view: spec.scene.view, camera: spec.scene.camera, objects: spec.scene.objects, steps: spec.steps.map((step) => step.scene ?? []), autoplay: false }) };

function initPanel(figure, tabs) {
    const frame = figure.querySelector("iframe");
    const body = figure.querySelector("[data-panel-body]");
    const captions = figure.querySelector("[data-panel-captions]");
    const dots = captions.querySelector(".caption-steps");
    const text = captions.querySelector(".caption-text");
    const title = figure.querySelector("[data-panel-title]");
    const source = figure.querySelector("[data-panel-source]");
    const replay = figure.querySelector("[data-panel-replay]");
    const owner = figure;
    let name = figure.dataset.panel;
    let run = null;
    let visible = false;
    let started = false;
    let ready;
    const loaded = new Promise((resolve) => (ready = resolve));
    let rendered = null;

    const post = (message) => frame.contentWindow.postMessage(message, location.origin);
    addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
        const { type, message } = event.data ?? {};
        if (type === "ready") ready();
        else if (type === "rendered" || type === "error") {
            if (type === "error") console.warn(`Ink Brain panel: ${message}`);
            rendered?.(type === "rendered");
        } else if (type === "touched") body.classList.add("is-touched");
    });

    const load = () => {
        if (!frame.src) frame.src = frame.dataset.src;
    };

    async function play() {
        started = true;
        run?.stop();
        voice.stop(owner);
        const r = (run = createRun());
        replay.hidden = true;
        captions.hidden = true;
        load();
        const spec = await specs[`../specs/${name}.json`]();
        title.textContent = spec.title;
        if (source) source.textContent = SOURCES[name];
        await loaded;
        if (r.stopped) return;
        body.classList.remove("is-ready", "is-touched");
        const ok = await r.wait(
            new Promise((resolve) => {
                rendered = resolve;
                post(payloadOf(spec));
            }),
        );
        if (r.stopped) return;
        body.classList.add("is-ready");
        if (!ok) {
            replay.hidden = false;
            return;
        }
        await r.wait(700);
        captions.hidden = false;
        const total = spec.steps.length;
        await playSteps(r, {
            name,
            steps: spec.steps,
            owner,
            onStep(index, step) {
                post({ type: "step", index });
                dots.replaceChildren(...Array.from({ length: total }, (_, i) => Object.assign(document.createElement("i"), { className: i <= index ? "done" : "" })));
                text.textContent = step.say;
                return 1500;
            },
        });
        if (r !== run || r.stopped) return;
        await r.wait(1200);
        captions.hidden = true;
        replay.hidden = false;
    }

    replay.addEventListener("click", play);
    figure.querySelector("[data-touch-shield]")?.addEventListener("click", () => body.classList.add("is-interactive"));
    for (const tab of tabs) {
        tab.addEventListener("click", () => {
            for (const other of tabs) other.setAttribute("aria-selected", String(other === tab));
            name = tab.dataset.scene;
            play();
        });
    }

    // Warm the frame up well before it scrolls in, let it rest while far away, and play the first time it is mostly on screen.
    new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) load();
            if (frame.src) loaded.then(() => post({ type: "visible", visible: entry.isIntersecting }));
        },
        { rootMargin: "300px 0px" },
    ).observe(figure);
    new IntersectionObserver(
        ([entry]) => {
            visible = entry.isIntersecting;
            if (!visible) {
                voice.stop(owner);
                body.classList.remove("is-interactive");
            }
            else if (!started) play();
        },
        { threshold: 0.45 },
    ).observe(figure);
}

export function initPanels() {
    for (const figure of document.querySelectorAll("[data-panel]")) {
        const tabs = [...(figure.closest(".showcase")?.querySelectorAll("[data-scene]") ?? [])];
        initPanel(figure, tabs);
    }
}
