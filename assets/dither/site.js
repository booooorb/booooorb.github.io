import { installPreviewDither } from "./previews.js";
import { SITE_DITHER_PRESET } from "./site-preset.js";
import { installVideoPreviews } from "./videos.js";

try {
  const dither = installPreviewDither(SITE_DITHER_PRESET);
  installVideoPreviews(dither);
} catch (error) {
  document.documentElement.classList.remove("previews-enhanced");
  console.warn("Preview effects unavailable; showing original media.", error);
}
