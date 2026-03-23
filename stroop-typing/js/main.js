import { createSoundController } from "./audio/sound.js";
import { createArena } from "./effects/arena.js";
import { createGameController } from "./game/controller.js";
import { getElements } from "./ui/dom.js";

const elements = getElements();
const sound = createSoundController();
const arena = createArena(elements.arena, sound);
const controller = createGameController(elements, arena, sound);

controller.init();
