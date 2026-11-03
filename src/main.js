// inkbrain.app: wires up the page.
import "./styles/base.css";
import "./styles/sections.css";
import { startAurora } from "./site/aurora.js";
import { initDemos } from "./site/demos.js";
import { initDownload } from "./site/download.js";
import { initFilm } from "./site/film.js";
import { initHero, initReveal, initSpotlight } from "./site/motion.js";
import { initNav } from "./site/nav.js";
import { initPanels } from "./site/panels.js";
import { initStage } from "./site/stage.js";
import { bindSoundToggles } from "./site/voice.js";

window.__inkReady = true;
// The colour field is decoration, so it starts once the page has painted.
(window.requestIdleCallback ?? ((fn) => setTimeout(fn, 600)))(() => startAurora(document.querySelector(".aurora")), { timeout: 1500 });
initNav();
initHero();
initReveal();
initSpotlight();
bindSoundToggles();
initStage(document.querySelector("[data-stage]"));
initPanels();
initFilm();
initDownload();
initDemos();
