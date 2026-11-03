// Small live demos: the composer typing, the board tile's tracer, the terminal session and the voice sample.
import { voice } from "./voice.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs a loop only while its element is on screen.
function whileVisible(el, loop) {
    let visible = false;
    let running = false;
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !running) {
            running = true;
            loop(() => visible).finally(() => (running = false));
        }
    }).observe(el);
}

function initComposer() {
    const typed = document.querySelector("[data-typed]");
    if (!typed) return;
    const text = typed.dataset.typed;
    if (still()) return void (typed.textContent = text);
    whileVisible(typed, async (visible) => {
        await sleep(700);
        while (visible()) {
            for (let i = 1; i <= text.length && visible(); i++) {
                typed.textContent = text.slice(0, i);
                await sleep(55 + Math.random() * 60);
            }
            await sleep(2600);
            for (let i = text.length; i >= 0 && visible(); i--) {
                typed.textContent = text.slice(0, i);
                await sleep(18);
            }
            await sleep(700);
        }
    });
}

function initTracer() {
    const curve = document.querySelector(".art-tiles .curve");
    const dot = document.querySelector(".art-tiles .tracer");
    if (!curve || !dot) return;
    const length = curve.getTotalLength();
    whileVisible(curve, async (visible) => {
        await sleep(700);
        const start = performance.now();
        dot.style.opacity = "1";
        while (visible()) {
            const t = ((performance.now() - start) / 3600) % 2;
            const along = t < 1 ? t : 2 - t;
            const eased = along < 0.5 ? 4 * along ** 3 : 1 - (-2 * along + 2) ** 3 / 2;
            const point = curve.getPointAtLength(length * eased);
            dot.setAttribute("cx", point.x);
            dot.setAttribute("cy", point.y);
            await new Promise(requestAnimationFrame);
        }
    });
}

function initTerminal() {
    const terminal = document.querySelector("[data-terminal]");
    if (!terminal) return;
    const lines = [...terminal.querySelectorAll(".t-line")];
    const show = async () => {
        for (const line of lines) {
            const typed = line.querySelector("[data-type]");
            const text = typed?.textContent ?? "";
            if (typed && !still()) typed.textContent = "";
            line.classList.add("is-shown");
            if (typed && !still()) {
                for (let i = 1; i <= text.length; i++) {
                    typed.textContent = text.slice(0, i);
                    await sleep(28 + Math.random() * 40);
                }
                await sleep(380);
            } else await sleep(still() ? 0 : 420);
        }
    };
    new IntersectionObserver(([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        show();
    }, { threshold: 0.4 }).observe(terminal);
}

// The voice tile: an idle shimmer, or the real level of Ink Brain's voice while the sample plays.
function initVoiceSample() {
    const button = document.querySelector("[data-voice-sample]");
    const canvas = document.querySelector("[data-wave]");
    if (!button || !canvas) return;
    const label = button.querySelector("[data-voice-sample-label]");
    const ctx = canvas.getContext("2d");
    const owner = button;
    let playing = false;
    const bins = new Uint8Array(128);
    const BARS = 46;

    const resize = () => {
        const dpr = devicePixelRatio || 1;
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    new ResizeObserver(resize).observe(canvas);

    const draw = (now) => {
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        const live = playing && voice.analyser;
        if (live) voice.analyser.getByteFrequencyData(bins);
        const gap = width / BARS;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "#a371f7");
        gradient.addColorStop(0.6, "#58a6ff");
        gradient.addColorStop(1, "#3fb950");
        ctx.fillStyle = gradient;
        for (let i = 0; i < BARS; i++) {
            const centre = 1 - Math.abs(i - BARS / 2) / (BARS / 2);
            const level = live ? bins[2 + Math.floor((i / BARS) * 60)] / 255 : 0.12 + 0.1 * Math.sin(now / 520 + i * 0.5) * Math.sin(now / 900 + i * 0.21);
            const h = Math.max(4, height * (live ? level * (0.35 + 0.65 * centre) : level * (0.5 + centre)));
            const w = gap * 0.42;
            ctx.beginPath();
            ctx.roundRect(i * gap + (gap - w) / 2, (height - h) / 2, w, h, w / 2);
            ctx.fill();
        }
    };
    whileVisible(canvas, async (visible) => {
        while (visible()) {
            draw(performance.now());
            await new Promise(requestAnimationFrame);
        }
    });

    const setPlaying = (on) => {
        playing = on;
        button.setAttribute("aria-pressed", String(on));
        label.textContent = on ? "Stop the sample" : "Play a sample";
    };
    button.addEventListener("click", async () => {
        if (playing) {
            voice.stop(owner);
            return setPlaying(false);
        }
        setPlaying(true);
        const clip = await voice.play("bert", 0, owner, true);
        if (!clip) return setPlaying(false);
        await clip.ended;
        setPlaying(false);
    });
}

export function initDemos() {
    initComposer();
    initTracer();
    initTerminal();
    initVoiceSample();
}
