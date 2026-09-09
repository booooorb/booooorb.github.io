# booooorb.github.io

A static project index for GitHub Pages. Open `index.html` directly, or serve
this directory with `python3 -m http.server 4173` and visit
`http://localhost:4173`. No build step or package installation is required.

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

To fill a placeholder, edit its card in `index.html`: update the title, image,
metadata, and `data-*` search/filter attributes; change `data-status` to
`available`; and replace the outer `button` with an `a` with the project's real
`href`. Add its year in a `project-badge` inside the thumbnail. Set `data-language` to its dominant language in lowercase. Counts are calculated automatically.

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
