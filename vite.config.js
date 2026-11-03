import { resolve } from "node:path";
import { defineConfig } from "vite";

const page = (path) => resolve(import.meta.dirname, path);

export default defineConfig({
    build: {
        target: "es2022",
        assetsInlineLimit: 0,
        // three.js loads lazily inside the 3D panel only, so its large chunk is expected.
        chunkSizeWarningLimit: 900,
        rollupOptions: {
            input: {
                main: page("index.html"),
                overlay: page("embed/overlay.html"),
                sandbox: page("embed/sandbox.html"),
                notFound: page("404.html"),
            },
        },
    },
});
