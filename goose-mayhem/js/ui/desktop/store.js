  function desktopStoreHint() {
    return state.shop.message || "Buy apps, then double-click them on the desktop.";
  }

  function storeAppBadge(appId) {
    if (appId === "antiMalware") return "";
    if (appId === "recycleBin") return "RB";
    if (appId === "taskManager") return "TM";
    if (appId === "flamethrower") return "";
    if (appId === "katana") return "";
    if (appId === "nuke") return "NK";
    if (appId === "thunder") return "";
    if (appId === "gauntlet") return "IG";
    if (appId === "bread") return "BR";
    if (appId === "fist") return "";
    return appId.slice(0, 2).toUpperCase();
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
      icon.textContent = storeAppBadge(app.id);

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
