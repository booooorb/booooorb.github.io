  function desktopStoreHint() {
    return state.shop.message || "Buy apps, then double-click them on the desktop.";
  }

  function storeAppBadge(appId) {
    return "";
  }

  const storeIconImages = new Map();
  const storeIconBoundsCache = new WeakMap();

  function storeIconPath(appId) {
    const paths = {
      antiMalware: MALWAREBYTES_ICON_PATH,
      recycleBin: RECYCLE_BIN_ICON_PATH,
      taskManager: TASK_MANAGER_ICON_PATH,
      flamethrower: FIREFOX_ICON_PATH,
      katana: SNIPPING_TOOL_ICON_PATH,
      nuke: NUKE_ICON_PATH,
      thunder: WEATHER_ICON_PATH,
      gauntlet: GAUNTLET_ICON_PATH,
      bread: BREAD_ICON_PATH,
      paint: PAINT_ICON_PATH,
      spotify: SPOTIFY_ICON_PATH,
      mediaPlayer: MEDIA_PLAYER_ICON_PATH,
      notepad: NOTEPAD_ICON_PATH,
      minesweeper: MINESWEEPER_ICON_PATH,
      internetExplorer: INTERNET_EXPLORER_ICON_PATH,
      chrome: CHROME_ICON_PATH,
      skype: SKYPE_ICON_PATH,
      fist: RIOT_GAMES_ICON_PATH,
    };
    return paths[appId] || null;
  }

  function storeVisibleImageBounds(image) {
    const cached = storeIconBoundsCache.get(image);
    if (cached) {
      return cached;
    }

    const fallback = {
      x: 0,
      y: 0,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };

    try {
      const sampleMax = 160;
      const scale = Math.min(1, sampleMax / Math.max(image.naturalWidth, image.naturalHeight));
      const sampleWidth = Math.max(1, Math.round(image.naturalWidth * scale));
      const sampleHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sampleCtx.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      let minX = sampleWidth;
      let minY = sampleHeight;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < sampleHeight; y += 1) {
        for (let x = 0; x < sampleWidth; x += 1) {
          if (pixels[(y * sampleWidth + x) * 4 + 3] <= 12) {
            continue;
          }
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX < minX || maxY < minY) {
        storeIconBoundsCache.set(image, fallback);
        return fallback;
      }

      const padding = 1 / scale;
      const bounds = {
        x: Math.max(0, minX / scale - padding),
        y: Math.max(0, minY / scale - padding),
        width: Math.min(image.naturalWidth, (maxX - minX + 1) / scale + padding * 2),
        height: Math.min(image.naturalHeight, (maxY - minY + 1) / scale + padding * 2),
      };
      storeIconBoundsCache.set(image, bounds);
      return bounds;
    } catch (error) {
      void error;
      storeIconBoundsCache.set(image, fallback);
      return fallback;
    }
  }

  function drawStoreIconCanvas(canvas, image) {
    const cssSize = 46;
    const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(cssSize * pixelRatio);
    canvas.height = Math.round(cssSize * pixelRatio);
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    const iconCtx = canvas.getContext("2d");
    iconCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    iconCtx.clearRect(0, 0, cssSize, cssSize);

    const bounds = storeVisibleImageBounds(image);
    const boxSize = 36;
    const scale = Math.min(boxSize / bounds.width, boxSize / bounds.height);
    const drawWidth = bounds.width * scale;
    const drawHeight = bounds.height * scale;
    iconCtx.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      cssSize / 2 - drawWidth / 2,
      cssSize / 2 - drawHeight / 2,
      drawWidth,
      drawHeight
    );
  }

  function attachStoreIcon(icon, appId) {
    const src = storeIconPath(appId);
    if (!src) {
      icon.textContent = storeAppBadge(appId);
      return;
    }

    icon.textContent = "";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    icon.append(canvas);

    let image = storeIconImages.get(src);
    if (!image) {
      image = new Image();
      image.decoding = "async";
      image.src = src;
      storeIconImages.set(src, image);
    }

    if (image.complete && image.naturalWidth > 0) {
      drawStoreIconCanvas(canvas, image);
      return;
    }

    image.addEventListener("load", () => drawStoreIconCanvas(canvas, image), { once: true });
  }

  function syncShopUi() {
    if (currencyValue) {
      currencyValue.textContent = String(state.currency);
    }
    if (storeToggle) {
      if (storeToggle.classList.contains("xp-start")) {
        storeToggle.textContent = " Shop ";
        storeToggle.classList.toggle("xp-start--open", state.shop.open);
      } else {
        storeToggle.textContent = state.shop.open ? "Hide Apps" : "Buy Apps";
      }
      storeToggle.setAttribute("aria-expanded", state.shop.open ? "true" : "false");
    }
    if (storePanel) {
      storePanel.hidden = !state.shop.open;
    }
    if (storeHint) {
      storeHint.textContent = desktopStoreHint();
    }
    if (!storeList) {
      return;
    }

    storeList.replaceChildren();
    for (const app of STORE_APPS) {
      const owned = isAppOwned(app.id);
      const canAfford = state.currency >= app.price;
      const card = document.createElement("article");
      card.className = "store-card";
      card.dataset.appId = app.id;

      const header = document.createElement("div");
      header.className = "store-card__header";

      const icon = document.createElement("div");
      icon.className = `store-card__icon store-card__icon--${app.id}`;
      icon.setAttribute("aria-hidden", "true");
      attachStoreIcon(icon, app.id);

      const titleWrap = document.createElement("div");
      titleWrap.className = "store-card__title-wrap";

      const name = document.createElement("div");
      name.className = "store-card__name";
      name.textContent = app.name;

      const meta = document.createElement("div");
      meta.className = "store-card__meta";
      meta.textContent = owned ? "Already on desktop" : `${app.price} honk bucks`;

      const action = document.createElement("button");
      action.className = "store-card__action";
      action.type = "button";
      action.dataset.appId = app.id;
      action.textContent = owned ? "On Desktop" : app.price === 0 ? "Install Free" : `Buy ${app.price}`;
      action.disabled = owned || !canAfford;

      titleWrap.append(name, meta);
      header.append(icon, titleWrap);
      card.append(header, action);
      storeList.append(card);
    }
  }

  function toggleShop(force) {
    state.shop.open = typeof force === "boolean" ? force : !state.shop.open;
    syncShopUi();
  }

  function installDesktopApp(appId) {
    if (appId === "antiMalware") {
      state.antiMalware.iconPos = findDesktopIconSpot(appId);
      deployAntiMalware();
      return;
    }
    if (appId === "recycleBin") {
      state.recycleBin.iconPos = findDesktopIconSpot(appId);
      deployRecycleBin();
      return;
    }
    if (appId === "taskManager") {
      state.taskManager.iconPos = findDesktopIconSpot(appId);
      deployTaskManager();
      return;
    }

    const desktopApp = state.desktopApps[appId];
    if (!desktopApp) {
      return;
    }

    desktopApp.owned = true;
    desktopApp.selected = false;
    desktopApp.iconPos = findDesktopIconSpot(appId);
    if (appId === "internetExplorer") {
      state.internetExplorer.active = true;
    }
  }

  function purchaseDesktopApp(appId) {
    const entry = storeAppEntry(appId);
    if (!entry) {
      return false;
    }

    if (isAppOwned(appId)) {
      state.shop.message = `${entry.name} is already on the desktop.`;
      syncShopUi();
      return true;
    }

    if (state.currency < entry.price) {
      state.shop.message = `Need ${entry.price - state.currency} more honk bucks for ${entry.name}.`;
      syncShopUi();
      return false;
    }

    state.currency -= entry.price;
    installDesktopApp(appId);

    state.shop.message = `${entry.name} landed on the desktop.`;
    layoutToolApps();
    syncToolUi();
    render();
    return true;
  }

  function launchDesktopApp(appId) {
    if (!isAppOwned(appId)) {
      return;
    }

    clearDesktopSelections();
    setDesktopAppSelected(appId, true);

    if (appId === "antiMalware") {
      deployAntiMalware();
      state.antiMalware.windowOpen = true;
    } else if (appId === "recycleBin") {
      deployRecycleBin();
    } else if (appId === "taskManager") {
      openTaskManagerWindow();
    } else if (toolManager.has(appId)) {
      toolManager.launchTool(appId);
    }

    syncToolUi();
  }
