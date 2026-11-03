// Ink Brain's overlay, replayed in a frame: the page drives it the way the app's main process drives the real one.
import "../engine/overlay/overlay.css";
import "./overlay.css";
import { Annotations } from "../engine/overlay/annotations.js";

const $ = (selector) => document.querySelector(selector);

// The page behind the replay; the host asks for the full-resolution frame only when it will be shown that large.
const page = new URLSearchParams(location.search).has("hd") ? "/media/heart-page" : "/media/heart-page-1x";
$("#page").innerHTML = `<source type="image/avif" srcset="${page}.avif" /><source type="image/webp" srcset="${page}.webp" /><img src="/media/heart-page.jpg" width="1512" height="827" alt="" draggable="false" />`;
const body = document.body;
const post = (message) => parent.postMessage(message, location.origin);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ICONS = {
    mic: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z"/></svg>`,
    live: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7.8 8.2a5.4 5.4 0 0 0 0 7.6M16.2 8.2a5.4 5.4 0 0 1 0 7.6M4.9 5.3a9.5 9.5 0 0 0 0 13.4M19.1 5.3a9.5 9.5 0 0 1 0 13.4"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="13" height="13"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="14" height="14"><path stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>`,
    pen: `<svg viewBox="0 0 32 32" width="32" height="32"><path d="M4 28l2.2-7.4L21.6 5.2a2.6 2.6 0 0 1 3.7 0l1.5 1.5a2.6 2.6 0 0 1 0 3.7L11.4 25.8z" fill="#fff" stroke="#0d1117" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 28l2.2-7.4 5.2 5.2z" fill="#ff3ec9"/></svg>`,
};
$("#mic").innerHTML = ICONS.mic;
$("#stay").innerHTML = ICONS.live;
$(".bubble-stop").innerHTML = ICONS.stop;
$(".bubble-close").innerHTML = ICONS.close;
$("#pen").innerHTML = ICONS.pen;

const annotations = new Annotations({ svgRoot: $("#annotations"), labels: $("#labels"), boards: $("#boards"), pointer: $("#pointer"), ripples: $("#ripples") });

// The user's ink, drawn with the app's pen style: a glowing magenta line with a white core.
const pen = {
    canvas: $("#ink"),
    strokes: [],
    current: null,
    interactive: false,
    resize() {
        const dpr = devicePixelRatio || 1;
        this.canvas.width = Math.round(innerWidth * dpr);
        this.canvas.height = Math.round(innerHeight * dpr);
        this.ctx = this.canvas.getContext("2d");
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    },
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const points of this.strokes) {
            ctx.beginPath();
            points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            Object.assign(ctx, { shadowColor: "rgba(255, 62, 201, 0.85)", shadowBlur: 14, strokeStyle: "#ff3ec9", lineWidth: 4.5 });
            ctx.stroke();
            Object.assign(ctx, { shadowBlur: 0, strokeStyle: "rgba(255, 255, 255, 0.8)", lineWidth: 1.2 });
            ctx.stroke();
        }
    },
    clear() {
        this.strokes = [];
        this.current = null;
        this.canvas.classList.remove("settled");
        this.draw();
    },
    start([x, y]) {
        this.current = [[x, y]];
        this.strokes.push(this.current);
        this.draw();
    },
    extend([x, y]) {
        const last = this.current?.at(-1);
        if (!last || Math.hypot(x - last[0], y - last[1]) < 2) return;
        this.current.push([x, y]);
        this.draw();
    },
    finish() {
        const points = this.current;
        this.current = null;
        return points;
    },
};
pen.resize();

const boundsOf = (points) => {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const [x, y] = [Math.min(...xs), Math.min(...ys)];
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

pen.canvas.addEventListener("pointerdown", (event) => {
    if (!pen.interactive || event.button !== 0) return;
    if (pen.canvas.classList.contains("settled")) pen.clear();
    pen.canvas.setPointerCapture(event.pointerId);
    pen.start([event.clientX, event.clientY]);
});
pen.canvas.addEventListener("pointermove", (event) => {
    if (!pen.current) return;
    for (const point of event.getCoalescedEvents?.() ?? [event]) pen.extend([point.clientX, point.clientY]);
});
const lift = () => {
    const points = pen.finish();
    if (points) post({ type: "stroke", bounds: boundsOf(points) });
};
pen.canvas.addEventListener("pointerup", lift);
pen.canvas.addEventListener("pointercancel", lift);
pen.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    pen.strokes.pop();
    pen.draw();
});

// The scripted pen: a cursor that draws a stroke along the given points.
async function drawPath(points, ms, token) {
    const cursor = $("#pen");
    const place = ([x, y]) => (cursor.style.transform = `translate(${x}px, ${y - 32}px)`);
    place(points[0]);
    cursor.classList.remove("hidden");
    await sleep(350);
    pen.start(points[0]);
    const start = performance.now();
    let drawn = 1;
    await new Promise((resolve) => {
        const frame = (now) => {
            if (token !== runToken) return resolve();
            const t = Math.min(1, (now - start) / ms);
            const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
            const upTo = Math.max(1, Math.round(eased * (points.length - 1)));
            for (; drawn <= upTo; drawn++) pen.extend(points[drawn]);
            place(points[upTo]);
            if (t < 1) requestAnimationFrame(frame);
            else resolve();
        };
        requestAnimationFrame(frame);
    });
    pen.finish();
    await sleep(250);
    cursor.classList.add("hidden");
}

// Words of a spoken question arrive the way the app's live transcript does.
async function type(text, ms, token) {
    const prompt = $("#prompt");
    const words = text.split(" ");
    prompt.classList.add("transcript");
    for (let i = 1; i <= words.length; i++) {
        if (token !== runToken) return;
        prompt.value = words.slice(0, i).join(" ");
        await sleep(ms / words.length);
    }
    prompt.classList.remove("transcript");
}

function showBubble({ x, y, question = "", activity = "", text = "", minimized = false }) {
    const bubble = $("#bubble");
    bubble.classList.remove("hidden");
    bubble.classList.toggle("minimized", minimized);
    Object.assign(bubble.style, { left: `${x}px`, top: `${y}px` });
    bubble.querySelector(".bubble-question").textContent = question ? `"${question}"` : "";
    bubble.querySelector(".bubble-activity").textContent = activity;
    const content = bubble.querySelector(".bubble-body");
    content.classList.toggle("waiting", !text && !minimized);
    content.replaceChildren(...(text ? [Object.assign(document.createElement("p"), { textContent: text })] : []));
}

function captions({ state, index = 0, total = 0, text = "", bottom = 54, docked = false }) {
    const box = $("#captions");
    if (state === "end") return box.classList.add("hidden");
    box.classList.remove("hidden");
    box.classList.toggle("docked", docked);
    box.style.bottom = `${bottom}px`;
    box.querySelector(".caption-steps").replaceChildren(...Array.from({ length: total }, (_, i) => Object.assign(document.createElement("i"), { className: i <= index && state === "step" ? "done" : "" })));
    box.querySelector(".caption-text").textContent = text;
}

function toast(text, ms = 3200) {
    const el = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
    $("#toasts").append(el);
    setTimeout(() => el.remove(), ms);
}

function reset() {
    annotations.clear();
    pen.clear();
    for (const id of ["#bubble", "#captions", "#composer", "#hint", "#pen"]) $(id).classList.add("hidden");
    body.classList.remove("pen", "thinking", "speaking", "listening");
    $("#prompt").value = "";
    $("#toasts").replaceChildren();
}

let runToken = 0;
const handlers = {
    reset() {
        runToken++;
        reset();
    },
    pen({ on, interactive = false }) {
        body.classList.toggle("pen", on);
        body.classList.toggle("listening", on);
        pen.interactive = on && interactive;
        pen.canvas.classList.toggle("active", pen.interactive);
        $("#composer").classList.toggle("hidden", !on);
        $("#hint").classList.toggle("hidden", !on);
        $("#prompt").placeholder = "Listening... circle or click anything and just talk";
        if (on) $("#prompt").value = "";
    },
    drawPath: ({ points, ms }) => drawPath(points, ms, runToken),
    type: ({ text, ms }) => type(text, ms, runToken),
    send() {
        handlers.pen({ on: false });
        pen.canvas.classList.add("settled");
        const shutter = $("#shutter");
        shutter.classList.remove("flash");
        void shutter.offsetWidth;
        shutter.classList.add("flash");
    },
    state({ thinking = false, speaking = false }) {
        body.classList.toggle("thinking", thinking);
        body.classList.toggle("speaking", speaking);
    },
    bubble: showBubble,
    draw: ({ shapes, group }) => annotations.draw(shapes, { clear: false, ttl: 0, group }).duration,
    captions,
    toast: ({ text }) => toast(text),
    clearInk: () => pen.clear(),
};

addEventListener("message", async (event) => {
    if (event.source !== parent || event.origin !== location.origin || !handlers[event.data?.type]) return;
    const result = await handlers[event.data.type](event.data);
    if (event.data.id) post({ type: "done", id: event.data.id, result });
});
addEventListener("keydown", (event) => {
    if (event.key === "Escape") post({ type: "key", key: "Escape" });
    if (event.code === "Space" && event.altKey && event.shiftKey) {
        event.preventDefault();
        post({ type: "key", key: "hotkey" });
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        pen.strokes.pop();
        pen.draw();
    }
});
for (const button of document.querySelectorAll(".bubble-stop, .bubble-close")) button.addEventListener("click", () => post({ type: "stop" }));
addEventListener("resize", () => pen.resize());

post({ type: "ready" });
