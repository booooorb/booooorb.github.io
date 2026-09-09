import { createSoundController } from "./audio/sound.js";
import { createArena } from "./effects/arena.js";
import { createGameController } from "./game/controller.js";
import { getElements } from "./ui/dom.js";
import { initMotion } from "./ui/motion.js";

const elements = getElements();
const sound = createSoundController();
const arena = createArena(elements.arena, sound, elements.arenaAnchor);
const controller = createGameController(elements, arena, sound);

controller.init();
if (document.readyState === "complete") initMotion();
else window.addEventListener("load", initMotion, { once: true });
