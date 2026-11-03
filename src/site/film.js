// The film: a poster that starts playback, and chapters that seek to each question.
export function initFilm() {
    const video = document.querySelector("[data-film]");
    const cover = document.querySelector("[data-film-cover]");
    const chapters = [...document.querySelectorAll("[data-chapter]")];
    if (!video) return;

    const play = (at) => {
        cover.hidden = true;
        if (Number.isFinite(at)) {
            if (video.readyState === 0) video.preload = "auto";
            video.currentTime = at;
        }
        video.play().catch(() => {});
    };

    cover.addEventListener("click", () => play());
    for (const button of chapters) button.addEventListener("click", () => play(Number(button.dataset.chapter)));

    video.addEventListener("timeupdate", () => {
        const now = video.currentTime;
        const active = chapters.findLast((button) => Number(button.dataset.chapter) <= now + 0.25);
        for (const button of chapters) button.setAttribute("aria-current", String(button === active));
    });

    for (const link of document.querySelectorAll("[data-play-film]")) {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            document.getElementById("film").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            play();
        });
    }
}
