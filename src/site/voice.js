// Narration in Ink Brain's own voice: one audio context, one speaker at a time, and sound toggles kept in sync.
import durations from "../specs/voice.json";

const buffers = new Map();
const listeners = new Set();
let context = null;
let analyser = null;
let enabled = false;
let current = null;

const url = (name, index) => `/media/voice/${name}-${index}.m4a`;

function load(name, index) {
    const key = `${name}-${index}`;
    if (!buffers.has(key)) {
        buffers.set(
            key,
            fetch(url(name, index))
                .then((response) => response.arrayBuffer())
                .then((data) => context.decodeAudioData(data))
                .catch(() => null),
        );
    }
    return buffers.get(key);
}

function ensureContext() {
    if (context) return;
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    analyser.connect(context.destination);
}

export const voice = {
    get enabled() {
        return enabled;
    },
    get analyser() {
        return analyser;
    },
    // Seconds of narration for a line (index 0 is a spoken answer, 1 onwards the explanation steps).
    duration: (name, index) => durations[name]?.[index] ?? null,
    onChange(listener) {
        listeners.add(listener);
        listener(enabled);
    },
    // Must run inside a click so browsers allow sound.
    setEnabled(on) {
        if (on) {
            ensureContext();
            context.resume();
        } else this.stop();
        enabled = on;
        for (const listener of listeners) listener(on);
    },
    prefetch(name, index) {
        if (context) load(name, index);
    },
    // Plays one line, stopping whoever was speaking; resolves to { ended } or null when sound is off or fails.
    async play(name, index, owner, force = false) {
        if (!enabled && !force) return null;
        ensureContext();
        if (force) context.resume();
        const buffer = await load(name, index);
        if (!buffer || (!enabled && !force)) return null;
        this.stop();
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        const ended = new Promise((resolve) => (source.onended = resolve));
        current = { source, owner };
        source.start();
        ended.then(() => {
            if (current?.source === source) current = null;
        });
        return { ended, duration: buffer.duration };
    },
    stop(owner) {
        if (!current || (owner && current.owner !== owner)) return;
        try {
            current.source.stop();
        } catch {
            // Already stopped.
        }
        current = null;
    },
    speaking: (owner) => Boolean(current && (!owner || current.owner === owner)),
};

// Every sound toggle on the page shows and flips the same setting.
export function bindSoundToggles(root = document) {
    const buttons = [...root.querySelectorAll("[data-sound]")];
    for (const button of buttons) button.addEventListener("click", () => voice.setEnabled(!voice.enabled));
    voice.onChange((on) => {
        for (const button of buttons) {
            button.setAttribute("aria-pressed", String(on));
            const label = button.querySelector("[data-sound-label]");
            if (label) label.textContent = on ? "Sound on" : "Sound off";
        }
    });
}
