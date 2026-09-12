# booooorb.github.io

A static project index for GitHub Pages. Serve this directory with
`python3 -m http.server 4173` and visit
`http://localhost:4173`. No build step or package installation is required.
Use a web server (including Go Live or GitHub Pages) so the detail dialogs can
load their Markdown descriptions. Browsers block these requests when opening
`index.html` directly with a `file://` URL.

For VS Code's **Go Live**, select the root `index.html` in the Explorer before
starting Live Server. The workspace server root is `/`; Live Server opens the
currently selected HTML file, so selecting `legacy/index.html` launches the
fallback explicitly. The updated homepage is at `http://127.0.0.1:5500/` on
Live Server's default port.

The homepage contains three playable games, eight external project links, and
an Ideas placeholder. The menu shows eight projects per page, with numbered
page buttons and previous/next controls beside the project count. Search,
tag filters and Type/Language switching reset to page 1; changing grid/list
views preserves the current page.

The layout uses the available window height, shrinking thumbnails and spacing
to keep the header, eight project slots, and footer visible together. Portrait
phones use two columns; short landscape windows use four columns and a compact
sidebar. Project titles and taglines automatically shrink to remain on one line.

Project year badges sit at the top right of the thumbnail. Subtitles contain
only the project’s tags, ordered Interactive, Software, Research, Web, ML. The
ML filter and search also recognize “machine learning.” VeryShop’s year is 2025.
The Ideas placeholder has no tags or year until it becomes a project.

## Project and menu details

Click any project, About, Resume, Github, or CV to open the same detail dialog.
Projects show a preview, name, both Type and Language tags, and a description.
The detail tags always show both groups, regardless of the homepage's selected
filter mode. Closing the dialog preserves the filters, page, and grid/list view.
Use the close button, Escape, or the backdrop to return to the menu.

The three hosted games have a **Play** button. Repository projects, including
GFFootball for now, have a **View GitHub repo** button. VeryShop has a **Visit
website** button linking to `https://veryshop.ca/`. The Github menu item opens a
preview first, with a button to visit the profile. About and Ideas have no
external action.

### Editing descriptions

Each item has a `description.md` in its own folder. Edit the text and save it;
reopening the dialog loads the latest file, with no build step. Publish the
edited files as usual to update the live site.

- Games: `brain-surfing/description.md`, `stroop-typing/description.md`,
  `goose-mayhem/description.md`.
- Other projects: `bw2-trainer-class-music-editor/description.md`,
  `woo-display/description.md`, `gf-football/description.md`,
  `dlc-gait-assembler/description.md`,
  `myoassist-lumbar-flexion-model/description.md`, `sbl-annotator/description.md`,
  `field-activity-detector/description.md`, `veryshop/description.md`.
- Menu: `about/description.md`, `resume/description.md`,
  `github/description.md`, `cv/description.md`.
- Placeholder: `ideas/description.md`.

Supported Markdown: paragraphs separated by blank lines, headings, **bold**,
*italic*, inline `code`, links, and flat bulleted or numbered lists. Raw HTML
is displayed as text. Relative links resolve from the description's folder.
Titles and tags remain in `index.html` (menu titles are in `menu.js`), so there
is no need to repeat the title in the description.

### Previews and documents

Games reuse their card images. Other projects have a replaceable `preview.svg`
in their folder; set `data-preview` on the card to use another image. The Github
preview is `github/preview.svg`; About uses `assets/menu/rat.webp`.

Resume and CV contain clearly labeled placeholder PDFs and previews:

| Item | Download file | Preview image |
| --- | --- | --- |
| Resume | `resume/resume.pdf` | `resume/preview.png` |
| CV | `cv/cv.pdf` | `cv/preview.png` |

Replace each PDF and its preview image when the real document is ready, and
update the corresponding `description.md`. Keep these paths to avoid code
changes. The previews are static images without links or embedded PDF viewers:
opening a dialog or clicking its preview never requests or downloads the PDF.
Only **Download** requests the document, saving it as `JY-Resume.pdf` or
`JY-CV.pdf`. Menu image paths and download settings live in `menu.js`.

### MP4 project overviews

Each of the eleven project cards is wired to `overview.mp4` in its own folder,
for example `stroop-typing/overview.mp4` or `woo-display/overview.mp4`. Add the
actual overview recordings at those paths. Override
the path with the card's `data-video` attribute in `index.html`, or remove the
attribute to disable video for that project. Use browser-compatible H.264 MP4
files on this site (cross-origin files need permission for canvas capture).

Video downloads, first-frame decoding, and preview dithering start as soon as
the page initializes, including projects on later pages. Each available clip
starts as a fully dithered still; pointer hover or keyboard focus immediately
starts its muted, inline loop. Opening the overview moves
the same player into the dialog, continuing from its current position. Leaving
the card or closing the dialog pauses at the current frame and gradually
reapplies the shared dither and color wash to that frame. The next interaction
resumes from that position. Closing a dialog returns its latest frame to the
card, even if the clip was started only inside the dialog.

Players use `preload="auto"` and prepare their first frame without playing;
browser data-saving policies may still defer downloads. A missing or unplayable
clip keeps the static preview. Touch devices play when the overview opens. Reduced-motion mode skips
hover playback and fades; opening a dialog explicitly still plays its clip.
Hidden cards and background tabs pause their players. Positions and frames are
kept for the current page session, not across reloads. Only paused frames are
filtered in the worker, capped at 1280 pixels along the longest edge; normal
video playback does not require continuous canvas processing.

## Homepage behavior

### Temporary dither lab

The **Dither lab** link next to **CV** opens `dither-lab/`. It shows six
Desktop Goose print presets: two grayscale dithers, then 12%, 24%, 38%, and
55% color washes. Select a print to adjust its grain, dither strength, color,
contrast, brightness, pattern, and ink tones. **Show original** compares the
unprocessed image; **100%** displays one source pixel per CSS pixel.

Processing runs in a web worker using the original 800 × 608 screenshot.
All presets start with one-pixel grain. Display previews use high-quality
downscaling to avoid moiré; PNG downloads use the full-resolution master.
Adjustments are saved locally and separately for each preset; **Reset this
preset** restores its starting settings. Lab adjustments do not change the
shared homepage preset.
To remove the experiment, delete `dither-lab/` and its marked link in
`index.html`. No build step, packages, or external services are needed.

### Automatic preview dithering

Project thumbnail images and images in the detail dialogs automatically use
the shared preset in `assets/dither/site-preset.js`: ordered newspaper screen,
2 source-pixel grain, 100% dither strength, 15% color wash, 100% contrast,
brightness +1, and two ink tones (black and white).

Add images inside `.project-media` or `.dialog-preview` as usual; no per-image
filter class or generated asset is needed. Newly inserted images, source
changes, cloned dialog previews, and responsive sizes are handled automatically.
Dialog artwork is also fetched, decoded, and filtered at startup, so opening
an overview can reuse its prepared master immediately. An early document-head
guard keeps source images hidden until the matching dither canvas is painted,
including on a cold load or when cached images arrive before the scripts.
If filtering or its module fails, the original image remains the fallback;
images also stay visible when JavaScript is disabled.
Use local preview assets or images served with appropriate CORS permission;
an unreadable image falls back to the original.

The original image files and their dimensions stay intact. Dithering runs in a
worker at native resolution, with pixel-area averaging for smaller displays.
The original `<img>` supplies accessible text and layout. Text placeholders,
navigation icons, and the already-dithered sidebar mascot keep their existing
appearance. Production filtering lives in `assets/dither/` and continues to
work if the temporary lab is removed.

Hover and keyboard focus reveal original colors over 1.5 seconds. Opening a
dialog continues the reveal from the thumbnail's current progress; leaving
restores the filtering. Reduced-motion mode makes these changes immediate.

### Menu controls

Menu interactions are handled by `menu.js`. Without JavaScript, all project
links remain available in an ordinary scrolling page. Fonts and menu artwork
are served locally. The sidebar has a continuously walking mouse animation
sized to fit its frame, followed by a Contact panel. The Type/Language switch changes
both the filter row and the tags beneath the projects. The footer count updates
with the active filters. The language list includes JavaScript, Python, Java,
Rust, Swift, CSS, and PHP. Rust is ready for future projects. Dominant languages
follow GitHub’s repository metadata (including CSS for GFFootball); local games
use JavaScript, and VeryShop uses PHP (WordPress/WooCommerce). Unspecified
languages display an em dash.

In the desktop landscape layout (wider than 700px), the mouse cycles through
seven thoughts in a shuffled order. Text types outward from the center in muted
gray, with 65–95ms letters, 220ms question marks, and 650ms individual dots.
Each completed thought holds for 2.6 seconds before fading out. The reserved
caption space keeps the mouse and Contact panel steady. Dialogue is hidden
on compact/portrait layouts, pauses in hidden tabs, and shows a static
“still walking...” when reduced motion is requested. Edit `mouseThoughts` in
`menu.js` to change the phrases.

Below Contact, desktop layouts (wider than 700px) show a monochrome logo carousel
adapted from the supplied React Bits LogoLoop. Its markup is in `index.html`,
styles are in `style.css`, and `assets/menu/logo-loop.js` handles the seamless
loop and smooth hover pause. Change `data-speed` to adjust pixels per second.
The four example technology logos are placeholders: their links have no `href`
and are marked `aria-disabled`. Add destinations and remove `aria-disabled`
when ready. The carousel is hidden on mobile, stops in hidden tabs, and displays
a single static row when reduced motion is requested.

To fill a placeholder, edit its card in `index.html`: update the title, image,
metadata, and `data-*` search/filter attributes; change `data-status` to
`available`; and replace the outer `button` with an `a` with the project's real
`href`. Add its year in a `project-badge` inside the thumbnail. Set `data-language` to its dominant language in lowercase. Counts are calculated automatically.
Add `description.md` inside the project folder. Set `data-play` to a playable
URL, `data-repo` to a GitHub URL, or `data-website` to a website URL for its
detail action. `data-description-src` can override the default description
path derived from the card's `href`.

The old homepage and its assets are kept in `legacy/`. To retire it, delete that
folder and remove the footer's `legacy` link. The new menu has no dependencies
on the legacy folder. Existing game directories are unchanged.

## External project folders

Each linked project has its own lowercase folder containing `index.html`, like
our local games. The page redirects to the destination using `location.replace`
(so Back returns to the menu), with a meta refresh and clickable link as fallbacks.
To host a project locally later, replace that folder's redirect page with its app.

| Folder | Destination |
| --- | --- |
| `bw2-trainer-class-music-editor/` | [BW2 Trainer Class Music Editor](https://github.com/booooorb/BW2-Trainer-Class-Music-Editor) |
| `woo-display/` | [WooDisplay](https://github.com/booooorb/WooDisplay) |
| `gf-football/` | [GFFootball](https://github.com/booooorb/GFFootball) |
| `dlc-gait-assembler/` | [DLC Gait Assembler](https://github.com/booooorb/dlc-gait-assembler) |
| `myoassist-lumbar-flexion-model/` | [28 Muscle MyoAssist Lumbar Model](https://github.com/booooorb/MyoAssist-Lumbar-Flexion-Model) |
| `sbl-annotator/` | [SBL Annotator](https://github.com/booooorb/SBL-Annotator) |
| `field-activity-detector/` | [Field Activity Detector](https://github.com/booooorb/2334-Oval-and-River-Soccer-Field-Activity-Detector) |
| `veryshop/` | [veryshop.ca](https://veryshop.ca/) |
