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

## Homepage behavior

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
