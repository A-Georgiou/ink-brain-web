// The 404 page: the site's look, with the missing page circled in ink.
import "./styles/base.css";
import "./styles/notfound.css";
import { inkRing } from "./site/motion.js";

inkRing(document.querySelector(".lost-code"), { padX: 0, padY: 0.02, seed: 5 });
