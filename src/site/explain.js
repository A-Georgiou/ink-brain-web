// Plays narrated steps the way the app's ExplainPlayer does: a step draws as its line starts and holds until the line ends.
import { voice } from "./voice.js";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The app's speaking-time estimate, used when there is no recorded line.
const readingTime = (text) => Math.min(15_000, Math.max(1_200, String(text).trim().split(/\s+/).length * 340));

// A cancellable run: everything awaited through it settles early once stopped.
export function createRun() {
    let wake;
    const stopped = new Promise((resolve) => (wake = resolve));
    const run = {
        stopped: false,
        stop() {
            run.stopped = true;
            wake();
        },
        wait: (promiseOrMs) => Promise.race([typeof promiseOrMs === "number" ? sleep(promiseOrMs) : promiseOrMs, stopped]),
    };
    return run;
}

// Speaks one line if sound is on, otherwise waits as long as the line would take; returns early if the run stops.
export async function say(run, { name, index, text, owner, minimum = 0, pace = 1 }) {
    const clip = await voice.play(name, index, owner);
    const spoken = (voice.duration(name, index) ?? readingTime(text) / 1000) * 1000;
    if (clip) await run.wait(Promise.all([clip.ended, sleep(minimum)]));
    else await run.wait(Math.max(spoken * pace, minimum));
    if (run.stopped) voice.stop(owner);
}

export async function playSteps(run, { name, steps, owner, onStep, pace = 1 }) {
    for (const [index, step] of steps.entries()) {
        if (run.stopped) return false;
        voice.prefetch(name, index + 2);
        const minimum = (await onStep(index, step)) ?? 0;
        await say(run, { name, index: index + 1, text: step.say, owner, minimum, pace });
        if (run.stopped) return false;
        await run.wait(300);
    }
    return !run.stopped;
}
