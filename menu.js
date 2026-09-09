(() => {
  "use strict";
  const grid = document.querySelector("#project-grid");
  const cards = Array.from(grid.querySelectorAll(".project-card"));
  const search = document.querySelector("#project-search");
  const dialog = document.querySelector("#info-dialog");
  const PAGE_SIZE = 8;
  const state = { tagMode: "type", category: "all", page: 1 };
  const typeFilters = document.querySelector("#type-filters");
  const languageFilters = document.querySelector("#language-filters");
  const typeLabels = new Map(Array.from(typeFilters.querySelectorAll("[data-category]"), (button) => [button.dataset.category, button.textContent]));
  const languageLabels = new Map(Array.from(languageFilters.querySelectorAll("[data-category]"), (button) => [button.dataset.category, button.textContent]));
  const pagination = document.querySelector(".pagination");
  const pageNumbers = document.querySelector("#page-numbers");
  const previousPage = document.querySelector("#previous-page");
  const nextPage = document.querySelector("#next-page");
  const fittedText = cards.flatMap((card) => [card.querySelector("h2"), card.querySelector(".project-tagline")]);
  let captionFitFrame;

  const mascotDialogue = document.querySelector(".mascot-dialogue");
  const desktopDialogue = matchMedia("(min-width: 701px) and (orientation: landscape)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const mouseThoughts = [
    "almost there... probably...",
    "thinking about cheese...",
    "what was i doing again?",
    "this floor is endless...",
    "somebody moved the exit...",
    "this counts as cardio, right..?",
    "still walking...",
  ];
  let thoughtQueue = [];
  let lastThought;
  let dialogueTimer;

  function nextThought() {
    if (!thoughtQueue.length) {
      thoughtQueue = [...mouseThoughts];
      for (let i = thoughtQueue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [thoughtQueue[i], thoughtQueue[j]] = [thoughtQueue[j], thoughtQueue[i]];
      }
      // Every phrase appears once per round, without repeating across rounds.
      if (thoughtQueue.at(-1) === lastThought) {
        [thoughtQueue[0], thoughtQueue[thoughtQueue.length - 1]] = [thoughtQueue.at(-1), thoughtQueue[0]];
      }
    }
    lastThought = thoughtQueue.pop();
    return lastThought;
  }

  function typeThought() {
    const thought = nextThought();
    let cursor = 0;
    mascotDialogue.textContent = "";
    mascotDialogue.classList.add("is-visible");
    function typeCharacter() {
      const character = thought[cursor];
      // Delay before revealing punctuation, so even a final dot arrives slowly.
      const delay = character === "." ? 650 : character === "?" ? 220 : 65 + Math.random() * 30;
      dialogueTimer = setTimeout(() => {
        cursor += 1;
        mascotDialogue.textContent = thought.slice(0, cursor);
        if (cursor < thought.length) typeCharacter();
        else dialogueTimer = setTimeout(() => {
          mascotDialogue.classList.remove("is-visible");
          dialogueTimer = setTimeout(typeThought, 900);
        }, 2600);
      }, delay);
    }
    typeCharacter();
  }

  function updateDialogue() {
    clearTimeout(dialogueTimer);
    mascotDialogue.textContent = "";
    mascotDialogue.classList.remove("is-visible");
    if (!desktopDialogue.matches || document.hidden) return;
    if (reducedMotion.matches) {
      mascotDialogue.textContent = "still walking...";
      mascotDialogue.classList.add("is-visible");
      return;
    }
    dialogueTimer = setTimeout(typeThought, 700);
  }
  desktopDialogue.addEventListener("change", updateDialogue);
  reducedMotion.addEventListener("change", updateDialogue);
  document.addEventListener("visibilitychange", updateDialogue);
  updateDialogue();

  function fitCaptions() {
    // Start at the CSS size so titles and taglines can grow again after a resize or view change.
    fittedText.forEach((title) => title.style.removeProperty("font-size"));
    const sizes = fittedText.map((title) => {
      if (!title.clientWidth) return null;
      const style = getComputedStyle(title);
      const baseSize = parseFloat(style.fontSize);
      const range = document.createRange();
      range.selectNodeContents(title);
      const textWidth = range.getBoundingClientRect().width;
      const available = title.clientWidth - 1;
      if (textWidth <= available) return null;
      // Letter spacing remains constant when font size changes.
      const tracking = (parseFloat(style.letterSpacing) || 0) * title.textContent.length;
      return Math.max(1, Math.floor(baseSize * (available - tracking) / (textWidth - tracking) * 10) / 10);
    });
    fittedText.forEach((title, index) => {
      if (sizes[index] !== null) title.style.fontSize = `${sizes[index]}px`;
    });
  }

  function scheduleCaptionFit() {
    cancelAnimationFrame(captionFitFrame);
    captionFitFrame = requestAnimationFrame(fitCaptions);
  }
  const captionObserver = new ResizeObserver(scheduleCaptionFit);
  fittedText.forEach((title) => captionObserver.observe(title));
  document.fonts.ready.then(scheduleCaptionFit);
  window.addEventListener("resize", scheduleCaptionFit);

  function setPressed(selector, dataKey, value) {
    document.querySelectorAll(selector).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset[dataKey] === value));
    });
  }

  function renderPagination(pageCount) {
    // Keep the buttons stable across page changes so keyboard focus is retained.
    if (pageNumbers.children.length !== pageCount) {
      const buttons = Array.from({ length: pageCount }, (_, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.page = String(index + 1);
        button.textContent = String(index + 1);
        button.setAttribute("aria-label", `Page ${index + 1} of ${pageCount}`);
        button.setAttribute("aria-controls", "project-grid");
        return button;
      });
      pageNumbers.replaceChildren(...buttons);
    }
    for (const button of pageNumbers.children) {
      if (Number(button.dataset.page) === state.page) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    previousPage.disabled = state.page === 1;
    nextPage.disabled = state.page === pageCount;
    pagination.hidden = false;
  }

  function applyFilters({ keepPage = false } = {}) {
    if (!keepPage) state.page = 1;
    const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = cards.filter((card) => {
      const data = card.dataset;
      const haystack = `${data.title} ${data.language} ${data.tags.replaceAll("-", " ")} ${data.tags.includes("machine-learning") ? "ml" : ""}`.toLocaleLowerCase();
      const tags = state.tagMode === "language" ? [data.language] : data.categories.split(" ");
      return words.every((word) => haystack.includes(word))
        && (state.category === "all" || tags.includes(state.category));
    });
    const count = matches.length;
    const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
    state.page = Math.min(pageCount, Math.max(1, state.page));
    const start = (state.page - 1) * PAGE_SIZE;
    const visibleCards = new Set(matches.slice(start, start + PAGE_SIZE));
    cards.forEach((card) => { card.hidden = !visibleCards.has(card); });
    grid.hidden = count === 0;
    document.querySelector("#item-count").textContent = `${count} ${count === 1 ? "item" : "items"}`;
    document.querySelector("#empty-state").hidden = count !== 0;
    document.querySelector("#results-announcement").textContent = count
      ? `Showing projects ${start + 1}–${Math.min(start + PAGE_SIZE, count)} of ${count}. Page ${state.page} of ${pageCount}.`
      : "No projects found.";
    renderPagination(pageCount);
    setPressed("[data-category]", "category", state.category);
    setPressed("[data-tag-mode]", "tagMode", state.tagMode);
    scheduleCaptionFit();
  }

  function resetFilters() {
    search.value = "";
    state.category = "all";
    applyFilters();
  }
  document.querySelector(".search").addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  search.addEventListener("input", applyFilters);
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      applyFilters();
    });
  });
  document.querySelectorAll("[data-tag-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.tagMode === button.dataset.tagMode) return;
      state.tagMode = button.dataset.tagMode;
      state.category = "all";
      typeFilters.hidden = state.tagMode !== "type";
      languageFilters.hidden = state.tagMode !== "language";
      cards.forEach((card) => {
        const tagline = state.tagMode === "language"
          ? languageLabels.get(card.dataset.language)
          : card.dataset.tags.split(" ").map((tag) => typeLabels.get(tag)).filter(Boolean).join(" · ");
        card.querySelector(".project-tagline").textContent = tagline || "—";
      });
      applyFilters();
    });
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      grid.dataset.layout = button.dataset.view;
      setPressed("[data-view]", "view", button.dataset.view);
      scheduleCaptionFit();
    });
  });
  document.querySelector("#clear-search").addEventListener("click", () => {
    resetFilters();
    search.focus();
  });

  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button === previousPage) state.page -= 1;
    else if (button === nextPage) state.page += 1;
    else if (button.dataset.page) state.page = Number(button.dataset.page);
    applyFilters({ keepPage: true });
    if (button.disabled) pageNumbers.querySelector('[aria-current="page"]').focus();
  });

  const preview = document.querySelector("#dialog-preview");
  const description = document.querySelector("#dialog-description");
  const dialogTags = document.querySelector("#dialog-tags");
  const action = document.querySelector("#dialog-link");
  let descriptionRequest;

  // A small, text-only Markdown subset. Raw HTML is never inserted into the page.
  function appendInline(parent, text, baseURL) {
    const tokens = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`/g;
    let cursor = 0;
    for (const match of text.matchAll(tokens)) {
      parent.append(text.slice(cursor, match.index));
      let node;
      if (match[1]) {
        try {
          const url = new URL(match[2], baseURL);
          if (["https:", "http:", "mailto:"].includes(url.protocol)) {
            node = document.createElement("a");
            node.href = url.href;
            if (url.origin !== location.origin && url.protocol !== "mailto:") {
              node.target = "_blank";
              node.rel = "noopener noreferrer";
            }
            node.textContent = match[1];
          }
        } catch { /* Invalid links remain readable as plain text. */ }
      } else {
        node = document.createElement(match[3] ? "strong" : match[4] ? "em" : "code");
        node.textContent = match[3] || match[4] || match[5];
      }
      parent.append(node || match[0]);
      cursor = match.index + match[0].length;
    }
    parent.append(text.slice(cursor));
  }

  function renderMarkdown(markdown, baseURL) {
    const content = document.createDocumentFragment();
    let block;
    for (const line of markdown.replace(/\r\n?/g, "\n").trim().split("\n")) {
      if (!line.trim()) { block = null; continue; }
      const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
      const item = line.match(/^\s*(?:([-*+])|\d+\.)\s+(.+)$/);
      if (heading) {
        const title = document.createElement("h3");
        appendInline(title, heading[1], baseURL);
        content.append(title);
        block = null;
      } else if (item) {
        const listTag = item[1] ? "UL" : "OL";
        if (block?.tagName !== listTag) {
          block = document.createElement(listTag);
          content.append(block);
        }
        const entry = document.createElement("li");
        appendInline(entry, item[2], baseURL);
        block.append(entry);
      } else {
        if (block?.tagName !== "P") {
          block = document.createElement("p");
          content.append(block);
        } else block.append(" ");
        appendInline(block, line.trim(), baseURL);
      }
    }
    description.replaceChildren(content);
  }

  function renderTags(groups) {
    dialogTags.replaceChildren();
    for (const [label, tags] of groups) {
      if (!tags.length) continue;
      const row = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const values = document.createElement("dd");
      tags.forEach((tag) => {
        const value = document.createElement("span");
        value.textContent = tag;
        values.append(value);
      });
      row.append(term, values);
      dialogTags.append(row);
    }
    dialogTags.hidden = !dialogTags.children.length;
  }

  async function showDialog({ title, descriptionSrc, eyebrow = "PROJECT", media, image, imageAlt, documentPreview = false, tags = [], link, linkText, download }) {
    descriptionRequest?.abort();
    const request = new AbortController();
    descriptionRequest = request;
    document.querySelector("#dialog-title").textContent = title;
    document.querySelector("#dialog-eyebrow").textContent = eyebrow;
    preview.replaceChildren();
    preview.classList.toggle("document-preview", documentPreview);
    if (media) {
      const artwork = media.cloneNode(true);
      artwork.querySelectorAll(".project-badge").forEach((badge) => badge.remove());
      const thumbnail = artwork.querySelector("img");
      if (thumbnail) thumbnail.alt = `${title} preview`;
      else { artwork.setAttribute("role", "img"); artwork.setAttribute("aria-label", `${title} preview`); }
      preview.append(artwork);
    } else if (image) {
      const thumbnail = document.createElement("img");
      thumbnail.src = image;
      thumbnail.alt = imageAlt || `${title} preview`;
      preview.append(thumbnail);
    }
    preview.hidden = !preview.childElementCount;
    renderTags(tags);
    action.hidden = !link;
    ["href", "target", "rel", "download"].forEach((attribute) => action.removeAttribute(attribute));
    action.textContent = linkText || "";
    if (link) {
      action.href = link;
      if (download) action.setAttribute("download", download);
      else if (new URL(link, document.baseURI).origin !== location.origin) {
        action.target = "_blank";
        action.rel = "noopener noreferrer";
      }
    }
    description.textContent = "Loading description…";
    description.setAttribute("aria-busy", "true");
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    try {
      const response = await fetch(descriptionSrc, { signal: request.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Description returned ${response.status}`);
      const markdown = await response.text();
      if (request.signal.aborted) return;
      renderMarkdown(markdown, new URL(descriptionSrc, document.baseURI));
      if (!description.textContent.trim()) description.textContent = "Description coming soon.";
    } catch {
      if (request.signal.aborted) return;
      description.textContent = "Description is unavailable right now.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-button description-retry";
      retry.textContent = "Try again";
      retry.addEventListener("click", () => showDialog({ title, descriptionSrc, eyebrow, media, image, imageAlt, documentPreview, tags, link, linkText, download }));
      description.append(retry);
    } finally {
      if (!request.signal.aborted) description.setAttribute("aria-busy", "false");
    }
  }

  cards.forEach((card) => {
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-controls", "info-dialog");
    card.setAttribute("role", "button");
    card.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const data = card.dataset;
      showDialog({
        title: data.title,
        descriptionSrc: data.descriptionSrc || `${card.getAttribute("href")}description.md`,
        eyebrow: data.status === "placeholder" ? "COMING SOON" : "PROJECT",
        media: data.preview ? null : card.querySelector(".project-media"),
        image: data.preview,
        tags: [
          ["TYPE", data.categories.split(" ").map((tag) => typeLabels.get(tag)).filter(Boolean)],
          ["LANGUAGE", [languageLabels.get(data.language)].filter(Boolean)],
        ],
        link: data.play || data.repo || data.website,
        linkText: data.play ? "Play" : data.repo ? "View GitHub repo ↗" : "Visit website ↗",
      });
    });
    if (card.tagName === "A") card.addEventListener("keydown", (event) => {
      if (event.key === " ") { event.preventDefault(); card.click(); }
    });
  });
  const info = {
    about: {
      title: "About",
      descriptionSrc: "about/description.md",
      image: "assets/menu/rat.webp",
      imageAlt: "White halftone mouse on a black background",
    },
    resume: {
      title: "Resume",
      descriptionSrc: "resume/description.md",
      image: "resume/preview.png",
      imageAlt: "Resume document preview — placeholder",
      documentPreview: true,
      link: "resume/resume.pdf",
      linkText: "Download",
      download: "JY-Resume.pdf",
    },
    github: {
      title: "Github",
      descriptionSrc: "github/description.md",
      image: "github/preview.svg",
      imageAlt: "booooorb on GitHub",
      tags: [["TYPE", ["CODE", "PROFILE"]]],
      link: "https://github.com/booooorb",
      linkText: "View GitHub profile ↗",
    },
    cv: {
      title: "CV",
      descriptionSrc: "cv/description.md",
      image: "cv/preview.png",
      imageAlt: "CV document preview — placeholder",
      documentPreview: true,
      link: "cv/cv.pdf",
      linkText: "Download",
      download: "JY-CV.pdf",
    },
  };
  document.querySelectorAll("[data-info]").forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "info-dialog");
    button.addEventListener("click", () => showDialog({ ...info[button.dataset.info], eyebrow: "MENU" }));
  });
  dialog.addEventListener("close", () => {
    descriptionRequest?.abort();
    description.setAttribute("aria-busy", "false");
  });
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  const initialSearch = new URLSearchParams(window.location.search).get("search");
  if (initialSearch) search.value = initialSearch;
  applyFilters();
  document.documentElement.classList.add("menu-ready");
})();
