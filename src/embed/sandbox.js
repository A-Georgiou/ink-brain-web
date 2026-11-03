// Renders one Ink Brain board or 3D scene and steps it on request, like the app's panel sandbox.
const root = document.getElementById("root");
let stage = null;
let dispose = null;
let pendingStep = -1;

const report = (message) => parent.postMessage(message, location.origin);

// The engines draw every frame; while the panel is off screen their frames are held back until it returns.
const nativeFrame = requestAnimationFrame.bind(window);
const nativeCancel = cancelAnimationFrame.bind(window);
const held = new Map();
let heldId = 0;
let paused = false;
window.requestAnimationFrame = (callback) => {
    if (!paused) return nativeFrame(callback);
    held.set(--heldId, callback);
    return heldId;
};
window.cancelAnimationFrame = (id) => (id < 0 ? held.delete(id) : nativeCancel(id));
function setPaused(next) {
    paused = next;
    if (paused) return;
    const callbacks = [...held.values()];
    held.clear();
    for (const callback of callbacks) nativeFrame(callback);
}
const describe = (error) => String(error?.message ?? error).slice(0, 2000);

addEventListener("error", (event) => report({ type: "error", message: describe(event.error ?? event.message) }));
addEventListener("unhandledrejection", (event) => report({ type: "error", message: describe(event.reason) }));

addEventListener("message", async (event) => {
    if (event.source !== parent || event.origin !== location.origin || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "visible") return setPaused(!event.data.visible);
    if (event.data.type === "step") {
        const index = Number(event.data.index);
        if (stage) stage.step(index);
        else pendingStep = Math.max(pendingStep, index);
        return;
    }
    const { kind, content } = event.data;
    if (kind !== "scene" && kind !== "board") return;
    try {
        dispose?.();
        dispose = null;
        stage = null;
        pendingStep = -1;
        root.replaceChildren();
        root.removeAttribute("style");
        const spec = JSON.parse(String(content));
        stage =
            kind === "scene"
                ? await (await import("../engine/overlay/scene.js")).renderScene(spec, { root, makeLabel })
                : await (await import("../engine/overlay/board.js")).renderBoard(spec, { root });
        dispose = stage.dispose;
        if (pendingStep >= 0) stage.step(pendingStep);
        report({ type: "rendered" });
    } catch (error) {
        report({ type: "error", message: describe(error) });
    }
});

// The app's label sprite, so 3D labels look the same as on the desktop.
function makeLabel(THREE, text, position, { color = "#e6edf3", background = "rgba(13, 17, 23, 0.78)", size = 0.32 } = {}) {
    const font = "600 44px -apple-system, system-ui, sans-serif";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(String(text)).width) + 32;
    canvas.height = 64;
    ctx.font = font;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, canvas.height / 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(String(text), 16, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set((size * canvas.width) / canvas.height, size, 1);
    sprite.renderOrder = 10;
    if (Array.isArray(position)) sprite.position.fromArray(position);
    else if (position) sprite.position.copy(position);
    return sprite;
}

addEventListener("pointerdown", () => report({ type: "touched" }));
report({ type: "ready" });
