// The top bar: a glass background once the page scrolls, the mobile menu and the section you are reading.
export function initNav() {
    const nav = document.querySelector("[data-nav]");
    const toggle = nav.querySelector("[data-menu-toggle]");
    const menu = nav.querySelector("#mobile-menu");

    const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 12);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });

    const setMenu = (open) => {
        menu.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setMenu(menu.hidden));
    menu.addEventListener("click", (event) => event.target.closest("a") && setMenu(false));
    addEventListener("keydown", (event) => event.key === "Escape" && !menu.hidden && setMenu(false));

    const links = [...nav.querySelectorAll(".nav-links a")];
    const spy = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) for (const link of links) link.setAttribute("aria-current", String(link.hash === `#${entry.target.id}`));
            }
        },
        { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const section of document.querySelectorAll("main section")) spy.observe(section);
}
