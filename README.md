# inkbrain.app

The website for [Ink Brain](https://github.com/A-Georgiou/ink-brain): circle anything on your screen, ask, and see it explained.

The page's demos are written in Ink Brain's own annotation, board and 3D scene language and drawn by the app's engines, so every explanation on the site is rendered live in the browser rather than played from a video.

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
npm run lint
```

## How it is put together

| Path | Role |
| --- | --- |
| `index.html` | The page. |
| `src/site/` | Page behaviour: the hero demo (`stage.js`), the board and 3D showcases (`panels.js`), narration (`voice.js`, `explain.js`), the aurora background, the film, downloads and motion. |
| `src/engine/` | Ink Brain's renderers and overlay styles, vendored from the app with only import paths changed. |
| `embed/` | Frames the engines run in: `overlay.html` replays the overlay on a real page, `sandbox.html` renders boards and 3D scenes. |
| `src/specs/` | The demos: blood flow on a Wikipedia heart diagram, a Fourier series board, a cut-away turbofan and a planetary gear set, plus narration timings. |
| `public/media/` | The film, its poster, the page behind the hero demo and narration in Ink Brain's voice. |
| `public/install.sh` | The one-line installer served at `https://inkbrain.app/install.sh`. |

To pick up engine changes from the app, copy `src/overlay/{annotations,board,scene,shapes,parts}.js`, `src/overlay/overlay.css` and `src/shared/{board,scene,mathexpr,geometry}.mjs` into `src/engine/`, then point their imports at `../shared/`, `roughjs` and `katex` as the current files do.

## The installer

`public/install.sh` checks for macOS 14 or later, the Xcode Command Line Tools and Node.js 22.12 or later, offers to install Copilot CLI, then clones Ink Brain into `~/.ink-brain/app`, installs it, builds the native helper and adds an **Ink Brain** launcher to `~/Applications`. Running it again updates Ink Brain, and `--uninstall` removes it while keeping settings and memory in `~/.ink-brain`.

When a GitHub release of Ink Brain includes a `.dmg` or `.zip` for macOS, the download buttons switch to it automatically.

## Deploy

Pushing to `main` builds the site and publishes it with GitHub Pages (`.github/workflows/deploy.yml`).

One-time setup:

1. In the repository settings, under **Pages**, set **Source** to **GitHub Actions**, then push to `main` (or run the workflow by hand).
2. Optionally, verify `inkbrain.app` first in your GitHub account settings, under **Pages**, which protects it from takeover.
3. Under **Pages > Custom domain**, enter `inkbrain.app` and save. Add the domain here before creating the DNS records. With a workflow, this setting is what counts; `public/CNAME` is only a record of the domain.
4. At your domain registrar, remove any default records for the apex and add:

   | Type | Name | Value |
   | --- | --- | --- |
   | `A` | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
   | `AAAA` | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
   | `CNAME` | `www` | `a-georgiou.github.io` |

5. Check with `dig inkbrain.app +noall +answer -t A`, then tick **Enforce HTTPS** once it becomes available (it can take up to a day). `.app` domains only load over HTTPS.

## Licence

The site is released under the [MIT License](LICENSE). The vendored engine comes from Ink Brain, also MIT. The handwriting fallback font is Kalam, under the SIL Open Font License.
