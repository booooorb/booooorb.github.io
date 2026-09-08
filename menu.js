(() => {
  "use strict";
  const grid = document.querySelector("#project-grid");
  const cards = Array.from(grid.querySelectorAll(".project-card"));
  const search = document.querySelector("#project-search");
  const statusFilter = document.querySelector("#status-filter");
  const sortOrder = document.querySelector("#sort-order");
  const filterToggle = document.querySelector("#filter-toggle");
  const filterPanel = document.querySelector("#filter-panel");
  const dialog = document.querySelector("#info-dialog");
  const PAGE_SIZE = 8;
  const state = { category: "all", selection: "all", page: 1 };
  const pagination = document.querySelector(".pagination");
  const pageNumbers = document.querySelector("#page-numbers");
  const previousPage = document.querySelector("#previous-page");
  const nextPage = document.querySelector("#next-page");
  const fittedText = cards.flatMap((card) => [card.querySelector("h2"), card.querySelector(".project-tagline")]);
  let captionFitFrame;

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
    const ordered = sortOrder.value === "name"
      ? [...cards].sort((a, b) => a.dataset.title.localeCompare(b.dataset.title))
      : cards;
    const matches = ordered.filter((card) => {
      const data = card.dataset;
      const haystack = `${data.title} ${data.tags.replaceAll("-", " ")} ${data.tags.includes("machine-learning") ? "ml" : ""}`.toLocaleLowerCase();
      return words.every((word) => haystack.includes(word))
        && (state.category === "all" || data.categories.split(" ").includes(state.category))
        && (state.selection === "all" || data.featured === "true")
        && (statusFilter.value === "all" || data.status === statusFilter.value);
    });
    const count = matches.length;
    const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
    state.page = Math.min(pageCount, Math.max(1, state.page));
    const start = (state.page - 1) * PAGE_SIZE;
    const visibleCards = new Set(matches.slice(start, start + PAGE_SIZE));
    cards.forEach((card) => { card.hidden = !visibleCards.has(card); });
    ordered.forEach((card) => grid.append(card));
    grid.hidden = count === 0;
    document.querySelector("#item-count").textContent = `${count} ${count === 1 ? "item" : "items"}`;
    document.querySelector("#empty-state").hidden = count !== 0;
    document.querySelector("#results-announcement").textContent = count
      ? `Showing projects ${start + 1}–${Math.min(start + PAGE_SIZE, count)} of ${count}. Page ${state.page} of ${pageCount}.`
      : "No projects found.";
    renderPagination(pageCount);
    setPressed("[data-category]", "category", state.category);
    setPressed("[data-selection]", "selection", state.selection);
    scheduleCaptionFit();
  }

  function resetFilters() {
    search.value = "";
    state.category = "all";
    state.selection = "all";
    statusFilter.value = "all";
    sortOrder.value = "default";
    applyFilters();
  }
  function closeFilters(restoreFocus = false) {
    filterPanel.hidden = true;
    filterToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) filterToggle.focus();
  }
  document.querySelector(".search").addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  search.addEventListener("input", applyFilters);
  statusFilter.addEventListener("change", applyFilters);
  sortOrder.addEventListener("change", applyFilters);
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      applyFilters();
    });
  });
  document.querySelectorAll("[data-selection]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selection = button.dataset.selection;
      applyFilters();
      closeFilters(true);
    });
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      grid.dataset.layout = button.dataset.view;
      setPressed("[data-view]", "view", button.dataset.view);
      scheduleCaptionFit();
    });
  });
  filterToggle.addEventListener("click", () => {
    const opening = filterPanel.hidden;
    filterPanel.hidden = !opening;
    filterToggle.setAttribute("aria-expanded", String(opening));
    if (opening) statusFilter.focus();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter-control")) closeFilters();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !filterPanel.hidden) closeFilters(true);
  });
  document.querySelector("#reset-filters").addEventListener("click", () => {
    resetFilters();
    closeFilters(true);
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

  function showDialog({ title, description, eyebrow = "PROJECTS", link, linkText }) {
    document.querySelector("#dialog-title").textContent = title;
    document.querySelector("#dialog-description").textContent = description;
    document.querySelector("#dialog-eyebrow").textContent = eyebrow;
    const action = document.querySelector("#dialog-link");
    action.hidden = !link;
    if (link) {
      action.href = link;
      action.textContent = linkText;
    }
    dialog.showModal();
  }
  cards.filter((card) => card.dataset.status === "placeholder").forEach((card) => {
    card.addEventListener("click", () => showDialog({
      title: card.dataset.title,
      description: card.dataset.description,
      eyebrow: "COMING SOON",
    }));
  });
  const info = {
    about: {
      title: "build. analyze. iterate.",
      description: "A growing collection of browser games, software experiments, and research projects. Explore browser games, GitHub projects, and VeryShop, with room for more to come.",
      eyebrow: "ABOUT JY",
    },
    resume: {
      title: "more to come.",
      description: "A resume has not been added yet. In the meantime, you can explore the projects on GitHub.",
      eyebrow: "RESUME",
      link: "https://github.com/booooorb",
      linkText: "view github profile ↗",
    },
    cv: {
      title: "more to come.",
      description: "A CV has not been added yet. In the meantime, you can explore the projects on GitHub.",
      eyebrow: "CV",
      link: "https://github.com/booooorb",
      linkText: "view github profile ↗",
    },
  };
  document.querySelectorAll("[data-info]").forEach((button) => {
    button.addEventListener("click", () => showDialog(info[button.dataset.info]));
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
