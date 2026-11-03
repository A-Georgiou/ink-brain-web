// Getting Ink Brain: install tabs, copy buttons, a note for other systems and, once one exists, the packaged release.
const REPO = "A-Georgiou/ink-brain";

function initTabs() {
    const tabs = [...document.querySelectorAll(".install [role=tab]")];
    const select = (tab, focus = false) => {
        for (const other of tabs) {
            const selected = other === tab;
            other.setAttribute("aria-selected", String(selected));
            other.tabIndex = selected ? 0 : -1;
            document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
        }
        if (focus) tab.focus();
    };
    for (const [index, tab] of tabs.entries()) {
        tab.addEventListener("click", () => select(tab));
        tab.addEventListener("keydown", (event) => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
            if (step) select(tabs[(index + step + tabs.length) % tabs.length], true);
        });
    }
}

function initCopy() {
    for (const button of document.querySelectorAll("[data-copy]")) {
        const label = button.querySelector("span");
        button.addEventListener("click", async () => {
            const text = button.parentElement.querySelector("[data-copy-source]").textContent.trim();
            try {
                await navigator.clipboard.writeText(text);
                button.classList.add("is-copied");
                if (label) label.textContent = "Copied";
                setTimeout(() => {
                    button.classList.remove("is-copied");
                    if (label) label.textContent = "Copy";
                }, 1800);
            } catch {
                const range = document.createRange();
                range.selectNodeContents(button.parentElement.querySelector("[data-copy-source]"));
                getSelection().removeAllRanges();
                getSelection().addRange(range);
            }
        });
    }
}

function platform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "an iPhone or iPad";
    if (/Macintosh|Mac OS X/.test(ua)) return null;
    if (/Android/.test(ua)) return "Android";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux|CrOS/.test(ua)) return "Linux";
    return null;
}

function initPlatformNote() {
    const note = document.querySelector("[data-os-note]");
    const other = platform();
    if (!note || !other) return;
    note.textContent = `It looks like you are on ${other}. Ink Brain runs on macOS for now, so open this page on your Mac to install it.`;
    note.hidden = false;
}

// When a release ships a Mac app, the download buttons fetch it directly instead of pointing at the installer.
async function initRelease() {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5`, { headers: { Accept: "application/vnd.github+json" } });
        if (!response.ok) return;
        const release = (await response.json()).find((r) => !r.draft && !r.prerelease);
        if (!release) return;
        const assets = (release.assets ?? []).filter((asset) => /\.(dmg|zip)$/i.test(asset.name) && /mac|darwin|osx|\.dmg$/i.test(asset.name));
        const arm = /arm64|apple|silicon/i;
        const isArm = await appleSilicon();
        const asset = assets.find((a) => /\.dmg$/i.test(a.name) && (isArm === null || arm.test(a.name) === isArm)) ?? assets.find((a) => /\.dmg$/i.test(a.name)) ?? assets[0];
        if (!asset) return;
        const box = document.querySelector("[data-release]");
        box.querySelector("[data-release-link]").href = asset.browser_download_url;
        box.querySelector("[data-release-label]").textContent = `Download Ink Brain ${release.tag_name}`;
        box.querySelector("[data-release-meta]").textContent = `${asset.name} · ${(asset.size / 1e6).toFixed(0)} MB · or use the installer below`;
        box.hidden = false;
        for (const link of document.querySelectorAll("[data-download]")) link.href = asset.browser_download_url;
    } catch {
        // Offline or rate limited: the installer stays the way to get Ink Brain.
    }
}

async function appleSilicon() {
    const hints = await navigator.userAgentData?.getHighEntropyValues?.(["architecture"]).catch(() => null);
    if (hints?.architecture) return hints.architecture === "arm";
    return null;
}

export function initDownload() {
    initTabs();
    initCopy();
    initPlatformNote();
    if ("requestIdleCallback" in window) requestIdleCallback(initRelease, { timeout: 4000 });
    else setTimeout(initRelease, 2000);
}
