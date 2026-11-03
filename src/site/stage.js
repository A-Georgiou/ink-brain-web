// The hero's live demo: Ink Brain explaining a heart diagram on Wikipedia through its real overlay, plus a pen to try it.
import heart from "../specs/heart-flow.json";
import { createRun, playSteps, say } from "./explain.js";
import { still } from "./motion.js";
import { voice } from "./voice.js";

const QUESTION = "Can you explain how blood flows through the heart?";
const SUMMARY = "The heart is two pumps working side by side. The right side sends used blood to the lungs to pick up oxygen, and the left side pumps that fresh blood out to the rest of your body. I'll trace the path on the diagram.";
// Where things sit on the 1512 by 982 point screen; the page starts below the browser's toolbar at y = 155.
const SCREEN_WIDTH = 1512;
const FIGURE = { x: 500, y: 190, w: 520, h: 680 };
const ANSWER_AT = { x: 1072, y: 470 };
const PILL_AT = { x: 24, y: 930 };
const OWNER = "stage";

// A hand-drawn loop like the user's pen: slightly wobbly and overshooting where it started, smoothed into a dense polyline.
function loopPoints(cx, cy, rx, ry, seed = 11) {
    let n = seed;
    const rnd = () => (n = (n * 16807) % 2147483647) / 2147483647 - 0.5;
    const raw = [];
    for (let i = 0; i <= 56; i++) {
        const a = ((-110 + (i * 360 * 1.09) / 56) * Math.PI) / 180;
        const k = 1 + rnd() * 0.03 + 0.035 * Math.sin((i / 56) * Math.PI);
        raw.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
    }
    const points = [];
    for (let i = 0; i < raw.length - 1; i++) {
        const [p0, p1, p2, p3] = [raw[Math.max(0, i - 1)], raw[i], raw[i + 1], raw[Math.min(raw.length - 1, i + 2)]];
        for (let s = 0; s < 6; s++) {
            const t = s / 6;
            points.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t * t + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t ** 3)));
        }
    }
    return [...points, raw.at(-1)];
}
const LOOP = loopPoints(758, 528, 296, 336);

const overlapShare = (a, b) => {
    const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return (w * h) / (b.w * b.h);
};

export function initStage(root) {
    const frame = root.querySelector("iframe");
    const screen = root.querySelector("[data-stage-screen]");
    const caption = root.querySelector("[data-stage-caption]");
    const tryButton = root.querySelector("[data-try]");
    const tryLabel = root.querySelector("[data-try-label]");
    const replay = root.querySelector("[data-stage-start]");

    new ResizeObserver(([entry]) => root.style.setProperty("--k", String(entry.contentRect.width / SCREEN_WIDTH))).observe(screen);

    let ready;
    const loaded = new Promise((resolve) => (ready = resolve));
    const pending = new Map();
    let sequence = 0;
    const send = (type, data = {}) => frame.contentWindow?.postMessage({ type, ...data }, location.origin);
    const call = (type, data = {}) =>
        new Promise((resolve) => {
            const id = ++sequence;
            pending.set(id, resolve);
            send(type, { ...data, id });
        });

    let run = null;
    let mode = "idle";
    let visible = false;
    let resumeTimer = 0;

    const setCaption = (label, text) => {
        const strong = Object.assign(document.createElement("b"), { textContent: label });
        caption.replaceChildren(...(label ? [strong, " "] : []), text);
    };
    const setMode = (next) => {
        mode = next;
        root.classList.toggle("is-pen", next === "pen");
        tryButton.setAttribute("aria-pressed", String(next === "pen" || next === "asking" || next === "answer"));
        tryLabel.textContent = next === "pen" ? "Exit the pen" : next === "asking" || next === "answer" ? "Stop" : "Try the pen";
    };
    const stopRun = () => {
        run?.stop();
        run = null;
        voice.stop(OWNER);
        clearTimeout(resumeTimer);
    };

    // From the question being sent to the end of the narrated explanation, as the app plays it.
    async function answer(r) {
        send("send");
        send("state", { thinking: true });
        send("bubble", { ...ANSWER_AT, question: QUESTION, activity: "Looking at your screen" });
        setCaption("Ink Brain", "takes one screenshot, plus a close-up of what you circled.");
        await r.wait(1300);
        send("bubble", { ...ANSWER_AT, question: QUESTION, activity: "Thinking" });
        await r.wait(1100);
        if (r.stopped) return false;
        send("state", { speaking: true });
        send("bubble", { ...ANSWER_AT, question: QUESTION, activity: "Speaking", text: SUMMARY });
        setCaption("Ink Brain", "answers out loud first, then explains right on the diagram.");
        await say(r, { name: "heart", index: 0, text: SUMMARY, owner: OWNER, pace: 0.6 });
        if (r.stopped) return false;
        send("clearInk");
        send("bubble", { ...PILL_AT, minimized: true, activity: "Explaining" });
        const total = heart.steps.length;
        const done = await playSteps(r, {
            name: "heart",
            steps: heart.steps,
            owner: OWNER,
            pace: 0.9,
            onStep: async (index, step) => {
                const duration = await call("draw", { shapes: step.draw, group: "explain" });
                send("captions", { state: "step", index, total, text: step.say, bottom: 30, docked: true });
                setCaption(`Step ${index + 1} of ${total}`, step.say);
                return duration;
            },
        });
        send("captions", { state: "end" });
        send("state", {});
        send("bubble", { ...PILL_AT, minimized: true, activity: "" });
        return done;
    }

    async function attract() {
        stopRun();
        const r = (run = createRun());
        setMode("attract");
        replay.hidden = true;
        await loaded;
        while (!r.stopped) {
            send("reset");
            setCaption("", "Ink Brain's own drawing engine, explaining a diagram on Wikipedia.");
            await r.wait(1000);
            if (r.stopped) break;
            send("pen", { on: true });
            setCaption("You", "press ⌥⇧Space and circle the diagram.");
            await r.wait(600);
            await r.wait(call("drawPath", { points: LOOP, ms: 1700 }));
            if (r.stopped) break;
            setCaption("You", `ask out loud: “${QUESTION}”`);
            await r.wait(call("type", { text: QUESTION, ms: 2600 }));
            await r.wait(500);
            if (r.stopped || !(await answer(r))) break;
            await r.wait(8000);
        }
    }

    async function startPen() {
        stopRun();
        run = createRun();
        setMode("pen");
        replay.hidden = true;
        await loaded;
        send("reset");
        send("pen", { on: true, interactive: true });
        setCaption("Your turn:", "circle or click the heart diagram, with your mouse or finger.");
        frame.focus({ preventScroll: true });
    }

    async function ask() {
        const r = run;
        setMode("asking");
        setCaption("You", `ask: “${QUESTION}”`);
        await r.wait(call("type", { text: QUESTION, ms: 2000 }));
        await r.wait(400);
        if (r.stopped) return;
        setMode("answer");
        const done = await answer(r);
        if (!done || r !== run) return;
        replay.hidden = false;
        resumeTimer = setTimeout(() => visible && mode === "answer" && attract(), 12000);
    }

    function leave() {
        stopRun();
        send("reset");
        setMode("idle");
        if (visible && !still()) resumeTimer = setTimeout(attract, 900);
        else replay.hidden = false;
    }

    addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
        const data = event.data ?? {};
        if (data.type === "ready") ready();
        else if (data.type === "done") {
            pending.get(data.id)?.(data.result);
            pending.delete(data.id);
        } else if (data.type === "stroke" && mode === "pen") {
            const { x, y, w, h } = data.bounds;
            const clicked = Math.max(w, h) < 8 && x >= FIGURE.x && x <= FIGURE.x + FIGURE.w && y >= FIGURE.y && y <= FIGURE.y + FIGURE.h;
            if (clicked || overlapShare(data.bounds, FIGURE) > 0.3) ask();
            else send("toast", { text: "This demo knows one answer. Circle or click the heart diagram." });
        } else if (data.type === "key" && data.key === "hotkey") {
            if (mode === "pen") leave();
            else startPen();
        } else if (data.type === "key" && data.key === "Escape" && mode !== "attract") leave();
        else if (data.type === "stop") leave();
    });

    tryButton.addEventListener("click", () => (mode === "attract" || mode === "idle" ? startPen() : leave()));
    replay.addEventListener("click", attract);
    addEventListener("keydown", (event) => {
        if (event.code === "Space" && event.altKey && event.shiftKey) {
            event.preventDefault();
            root.scrollIntoView({ behavior: still() ? "auto" : "smooth", block: "center" });
            if (mode === "pen") leave();
            else startPen();
        } else if (event.key === "Escape" && mode !== "attract" && mode !== "idle") leave();
    });

    new IntersectionObserver(
        ([entry]) => {
            visible = entry.isIntersecting;
            if (!visible) {
                voice.stop(OWNER);
                if (mode === "attract") {
                    stopRun();
                    setMode("idle");
                }
            } else if (mode === "idle" && !still()) attract();
        },
        { threshold: 0 },
    ).observe(root);

    frame.src = `${frame.dataset.src}${screen.clientWidth * devicePixelRatio > 1600 ? "?hd" : ""}`;
    if (still()) {
        replay.hidden = false;
        loaded.then(() => setCaption("", "Press Replay to watch Ink Brain explain how blood flows through the heart."));
    }
}
