# inkbrain.app

The website for [Ink Brain](https://github.com/A-Georgiou/ink-brain), a companion for your Mac: circle anything on your screen, ask out loud, and watch it explained.

## Design philosophy

**Show the real thing.** Ink Brain explains by drawing on your screen, so the site explains Ink Brain the same way. None of the demos are recordings. Each one is written in the annotation, board and 3D scene language the app's model writes, then drawn live in your browser by the app's own renderers. What you see on the page is what the app can draw on your screen.

**Look like the app.** The site uses Ink Brain's own visual language rather than a separate marketing one: a near-black canvas, a slow aurora of purple, blue and green, the ink drop logo and the magenta loop the pen leaves behind. Text is set in the system font, so on a Mac it reads like part of macOS.

**Motion with a purpose.** Things draw themselves on like ink, one idea at a time, and each animation is there to show how something works. If your system asks for reduced motion, the decoration stops and the hero waits for you to press Replay.

**Light and quiet.** The page itself loads about 10 KB of JavaScript and 8 KB of CSS, gzipped. three.js and KaTeX load only inside the frames that need them, and the demos pause when they scroll out of view. Narration stays off until you turn the sound on, and every narrated step is captioned. There are no cookies, no analytics and no trackers.

**Honest.** The demos are labelled as examples, written in the app's language rather than recorded from it, and third-party material is credited.

**One clean way in.** Getting Ink Brain is a single command, and you can read the script at that address before running it:

```bash
curl -fsSL https://inkbrain.app/install.sh | bash
```

When a packaged Mac app is released, the download buttons switch to it automatically.

## Built with plain HTML, CSS and JavaScript

The site is a page with a few live demos, not an application, so it has no framework and no TypeScript. The content is hand-written HTML that still reads with JavaScript turned off. The styling is modern CSS: custom properties, `@property`, scroll-driven animation and `clamp()` sizing. Behaviour lives in small ES modules, one for each part of the page.

Plain JavaScript also means the demos run on the real thing. Ink Brain's renderers are plain JavaScript modules, so the site runs them exactly as the app does, copied in with only their import paths changed. The narration is pre-rendered with Kokoro, the on-device voice Ink Brain speaks with. Vite is the only build tool, and it turns all of this into a static site.

## Running it locally

```bash
npm install
npm run dev
```

## Credits and licence

The site is released under the [MIT License](LICENSE), like Ink Brain. 3D scenes are drawn with three.js, maths with KaTeX and sketches with Rough.js. The heart diagram is by Wapcaplet, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Diagram_of_the_human_heart_(cropped).svg). The handwriting fallback font is Kalam, under the SIL Open Font License.
