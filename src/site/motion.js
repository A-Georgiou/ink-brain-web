// Page motion: reveals on scroll, the hero's entrance, hand-drawn rings, card spotlights and counters.
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A hand-drawn loop like the user's pen: slightly wobbly and overshooting where it started.
export function wobble(cx, cy, rx, ry, seed = 7, turns = 1.09) {
    let n = seed;
    const rnd = () => (n = (n * 16807) % 2147483647) / 2147483647 - 0.5;
    const points = [];
    for (let i = 0; i <= 56; i++) {
        const a = ((-110 + (i * 360 * turns) / 56) * Math.PI) / 180;
        const k = 1 + rnd() * 0.03 + 0.035 * Math.sin((i / 56) * Math.PI);
        points.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
    }
    let d = `M${points[0].map((v) => v.toFixed(1)).join(",")}`;
    for (let i = 0; i < points.length - 1; i++) {
        const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${[...c1, ...c2, ...p2].map((v) => v.toFixed(1)).join(",")}`;
    }
    return d;
}

// A hand-drawn ink loop around an element, redrawn at its real pixel size so the stroke and the draw-on stay true.
export function inkRing(host, { padX = 0.06, padY = 0.2, seed = 7, className = "ink-ring" } = {}) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const paths = ["ink-under", "ink"].map((cls) => {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("class", cls);
        path.setAttribute("pathLength", "1");
        svg.append(path);
        return path;
    });
    host.append(svg);
    const draw = () => {
        const [width, height] = [host.offsetWidth, host.offsetHeight];
        const [w, h] = [width * (1 + 2 * padX), height * (1 + 2 * padY)];
        svg.setAttribute("viewBox", `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`);
        Object.assign(svg.style, { left: `${-width * padX}px`, top: `${-height * padY}px`, width: `${w}px`, height: `${h}px` });
        const d = wobble(w / 2, h / 2, w * 0.46, h * 0.42, seed);
        for (const path of paths) path.setAttribute("d", d);
    };
    draw();
    new ResizeObserver(draw).observe(host);
    return svg;
}

export function initReveal() {
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add("is-in");
                observer.unobserve(entry.target);
            }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    for (const el of document.querySelectorAll("[data-reveal]")) observer.observe(el);
}

export function initHero() {
    const hero = document.querySelector(".hero");
    const staged = [hero.querySelector(".pill"), ...hero.querySelectorAll(".hero-title .word"), ...hero.querySelectorAll("[data-hero-in]:not(.pill)")];
    staged.forEach((el, index) => el.style.setProperty("--delay", `${0.08 + index * 0.07}s`));
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-in")));
    const ring = inkRing(hero.querySelector("[data-circle]"), { padX: 0.035, padY: 0.16, seed: 11, className: "ink-ring circle-ring" });
    setTimeout(() => ring.classList.add("is-drawn"), still() ? 0 : 1250);
    const finale = document.querySelector("[data-finale] .finale-word");
    if (finale) inkRing(finale, { padX: 0, padY: 0.04, seed: 23, className: "ink-ring finale-ring" });
}

// Cards light their border under the pointer.
export function initSpotlight() {
    let pending = null;
    addEventListener(
        "pointermove",
        (event) => {
            pending = event;
            requestAnimationFrame(() => {
                if (!pending) return;
                const card = pending.target.closest?.(".card");
                if (card) {
                    const box = card.getBoundingClientRect();
                    card.style.setProperty("--mx", `${pending.clientX - box.left}px`);
                    card.style.setProperty("--my", `${pending.clientY - box.top}px`);
                }
                pending = null;
            });
        },
        { passive: true },
    );
}

export function initCounters() {
    for (const el of document.querySelectorAll("[data-count-to]")) {
        const [from, to] = [Number(el.dataset.countFrom), Number(el.dataset.countTo)];
        el.textContent = from.toFixed(2);
        new IntersectionObserver(([entry], observer) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            const start = performance.now();
            const tick = (now) => {
                const t = still() ? 1 : Math.min(1, (now - start - 400) / 1300);
                const eased = t <= 0 ? 0 : 1 - (1 - t) ** 3;
                el.textContent = (from + (to - from) * eased).toFixed(2);
                if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, { threshold: 0.5 }).observe(el);
    }
}
