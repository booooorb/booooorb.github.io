  function internetExplorerCenter() {
    const app = state.desktopApps.internetExplorer;
    if (!app?.owned) {
      return pt(state.width / 2, state.height / 2);
    }
    const rect = desktopToolIconRect("internetExplorer");
    return pt(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }

  function internetExplorerOrbitPoint(center, phase, radiusScale = 1) {
    const angle = state.internetExplorer.haloAngle;
    const local = pt(
      Math.cos(phase) * 102 * radiusScale,
      Math.sin(phase) * 50 * radiusScale
    );
    return pt(
      center.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
      center.y + local.x * Math.sin(angle) + local.y * Math.cos(angle)
    );
  }

  const INTERNET_EXPLORER_SPECK_SCALE = 0.04;
  const INTERNET_EXPLORER_SINGULARITY_COUNT = 50;
  const INTERNET_EXPLORER_CONVERGE_DURATION = 1.15;
  const INTERNET_EXPLORER_EXPAND_DURATION = 0.22;
  const INTERNET_EXPLORER_COLLAPSE_DURATION = 1.35;
  const INTERNET_EXPLORER_BLACKOUT_DURATION = 15;
  const INTERNET_EXPLORER_RETURN_DURATION = 0.85;

  function addInternetExplorerSpeck(cargo, orbit) {
    state.internetExplorer.specks.push({
      phase: orbit.phase,
      radiusScale: orbit.radiusScale,
      slotBias: orbit.slotBias,
      depth: cargo.internetExplorerDepth || 0,
      seed: rand(0, TAU),
      size: rand(1.1, 1.7),
    });
  }

  function internetExplorerSingularityActive() {
    return !!state.internetExplorer.singularity;
  }

  function internetExplorerBlackoutActive() {
    return state.internetExplorer.singularity?.phase === "blackout";
  }

  function internetExplorerIconHidden() {
    const singularity = state.internetExplorer.singularity;
    return !!singularity && singularity.phase !== "converge";
  }

  function internetExplorerBlackHoleCenter() {
    return state.internetExplorer.singularity?.center || internetExplorerCenter();
  }

  function internetExplorerBlackHoleWidth() {
    return motionQuery.matches
      ? clamp(state.width * 0.76, 320, 460)
      : clamp(state.width * 0.42, 560, 820);
  }

  function restartInternetExplorerBlackHoleGif() {
    if (!blackHoleEffect) {
      return;
    }
    const src = blackHoleEffect.dataset.src || blackHoleEffect.getAttribute("src");
    if (!src) {
      return;
    }
    blackHoleEffect.dataset.src = src;
    blackHoleEffect.removeAttribute("src");
    void blackHoleEffect.offsetWidth;
    blackHoleEffect.setAttribute("src", src);
  }

  function syncInternetExplorerBlackoutClass() {
    const blackout = internetExplorerBlackoutActive();
    stage?.classList.toggle("stage--black-hole", blackout);

    if (!blackHoleEffect) {
      return;
    }
    if (!blackout) {
      blackHoleEffect.hidden = true;
      blackHoleEffect.dataset.active = "0";
      return;
    }

    const center = internetExplorerBlackHoleCenter();
    const width = internetExplorerBlackHoleWidth();
    if (blackHoleEffect.hidden || blackHoleEffect.dataset.active !== "1") {
      restartInternetExplorerBlackHoleGif();
      blackHoleEffect.hidden = false;
      blackHoleEffect.dataset.active = "1";
    }
    blackHoleEffect.style.left = `${center.x}px`;
    blackHoleEffect.style.top = `${center.y}px`;
    blackHoleEffect.style.width = `${width}px`;
  }

  function startInternetExplorerSingularity(center) {
    const explorer = state.internetExplorer;
    if (explorer.singularity || explorer.specks.length < INTERNET_EXPLORER_SINGULARITY_COUNT) {
      return;
    }

    explorer.singularity = {
      phase: "converge",
      age: 0,
      center: pt(center.x, center.y),
      maxRadius: Math.hypot(state.width, state.height) * 0.62,
      seed: rand(0, TAU),
    };
  }

  function clearBlackHoleInterruptedTools() {
    if (state.chrome) {
      state.chrome.droids.length = 0;
      state.chrome.beams.length = 0;
      state.chrome.paths.length = 0;
      state.chrome.explosions.length = 0;
    }
    if (typeof clearChromeDroidElements === "function") {
      clearChromeDroidElements();
    }

    if (state.skype) {
      state.skype.cells.length = 0;
      state.skype.pops.length = 0;
    }

    for (const cargo of state.cargoes) {
      if (!cargo.skypeCellId) {
        continue;
      }
      cargo.skypeCellId = null;
      cargo.skypeCellProgress = 0;
    }
  }

  function releaseInternetExplorerSingularity() {
    const explorer = state.internetExplorer;
    const center = explorer.singularity?.center || internetExplorerCenter();
    explorer.singularity = null;
    explorer.specks.length = 0;
    explorer.returnTransition = {
      age: 0,
      duration: INTERNET_EXPLORER_RETURN_DURATION,
      center,
    };
    syncInternetExplorerBlackoutClass();
    for (const cargo of state.cargoes) {
      cargo.blackHoleProgress = 0;
      cargo.blackHoleSpin = 0;
      cargo.blackHoleAngle = 0;
      cargo.blackHoleRadius = 0;
      cargo.blackHoleOrbitSpeed = 0;
      cargo.blackHoleSpinDirection = 0;
    }
  }

  function updateInternetExplorerReturnTransition(dt) {
    const transition = state.internetExplorer.returnTransition;
    if (!transition) {
      return;
    }
    transition.age += dt;
    if (transition.age >= transition.duration) {
      state.internetExplorer.returnTransition = null;
    }
  }

  function updateInternetExplorerSuction(dt, center) {
    const pullRadius = Math.hypot(state.width, state.height);
    for (const cargo of [...state.cargoes]) {
      if (cargo.removed || cargo.dusting) {
        continue;
      }
      if (!cargo.visible && !cargo.grabbed && !cargo.ownerId) {
        continue;
      }

      if (cargo.ownerId || cargo.grabbed) {
        releaseCargoOwner(cargo);
      }
      releaseInternetExplorerCargo(cargo);

      const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const distance = dist(cargoCenter, center);
      if (distance > pullRadius + Math.hypot(cargo.width, cargo.height)) {
        continue;
      }

      const progress = clamp((cargo.blackHoleProgress || 0) + dt * lerp(0.58, 1.75, clamp(1 - distance / pullRadius, 0, 1)), 0, 1);
      if (!cargo.blackHoleRadius) {
        const offset = sub(cargoCenter, center);
        cargo.blackHoleRadius = Math.max(12, mag(offset));
        cargo.blackHoleAngle = Math.atan2(offset.y, offset.x);
        cargo.blackHoleSpinDirection = Math.random() < 0.5 ? -1 : 1;
        cargo.blackHoleOrbitSpeed = rand(4.8, 7.4) * cargo.blackHoleSpinDirection;
      }

      const pullT = cubicEaseInOut(progress);
      cargo.blackHoleAngle += cargo.blackHoleOrbitSpeed * dt * (1 + pullT * 2.8);
      cargo.blackHoleRadius = lerp(cargo.blackHoleRadius, lerp(Math.max(distance * 0.82, 8), 3, pullT), 0.12 + pullT * 0.2);
      const wobbleRadius = cargo.blackHoleRadius + Math.sin(state.time * 14 + cargo.id) * (1 - pullT) * 8;
      const targetCenter = pt(
        center.x + Math.cos(cargo.blackHoleAngle) * wobbleRadius,
        center.y + Math.sin(cargo.blackHoleAngle) * wobbleRadius * 0.64
      );
      const targetPos = pt(targetCenter.x - cargo.width / 2, targetCenter.y - cargo.height / 2);
      cargo.blackHoleProgress = progress;
      cargo.blackHoleSpin = (cargo.blackHoleSpin || rand(-2.6, 2.6)) + dt * (4 + progress * 16);
      cargo.visible = true;
      cargo.pos = lerpPt(cargo.pos, targetPos, 0.14 + progress * 0.34);

      if (progress >= 0.98 || dist(pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2), center) < 9) {
        removeCargo(cargo.id);
      }
    }
  }

  function updateInternetExplorerSingularity(dt) {
    updateInternetExplorerReturnTransition(dt);

    const singularity = state.internetExplorer.singularity;
    if (!singularity) {
      syncInternetExplorerBlackoutClass();
      return false;
    }

    singularity.age += dt;
    if (singularity.phase === "converge" && singularity.age >= INTERNET_EXPLORER_CONVERGE_DURATION) {
      singularity.phase = "expand";
      singularity.age = 0;
    } else if (singularity.phase === "expand" && singularity.age >= INTERNET_EXPLORER_EXPAND_DURATION) {
      singularity.phase = "collapse";
      singularity.age = 0;
    } else if (singularity.phase === "collapse" && singularity.age >= INTERNET_EXPLORER_COLLAPSE_DURATION) {
      singularity.phase = "blackout";
      singularity.age = 0;
      state.internetExplorer.specks.length = 0;
      clearBlackHoleInterruptedTools();
    } else if (singularity.phase === "blackout") {
      updateInternetExplorerSuction(dt, singularity.center);
      if (singularity.age >= INTERNET_EXPLORER_BLACKOUT_DURATION) {
        releaseInternetExplorerSingularity();
        return false;
      }
    }

    syncInternetExplorerBlackoutClass();
    return true;
  }

  function releaseInternetExplorerCargo(cargo) {
    if (!cargo?.internetExplorerOrbit) {
      return;
    }
    cargo.internetExplorerOrbit = null;
    cargo.internetExplorerScale = 1;
    cargo.internetExplorerDepth = 0;
  }

  function lerpInternetExplorerAngle(current, target, amount) {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * amount;
  }

  function activateInternetExplorer() {
    if (!isAppOwned("internetExplorer")) {
      return;
    }
    state.internetExplorer.active = true;
    finishToolToggle();
  }

  function updateInternetExplorer(dt) {
    const explorer = state.internetExplorer;
    const owned = isAppOwned("internetExplorer");
    explorer.active = owned;
    explorer.pulse += dt * (owned ? 5.4 : 2.6);

    if (!owned) {
      explorer.orbitItems.clear();
      explorer.specks.length = 0;
      explorer.singularity = null;
      syncInternetExplorerBlackoutClass();
      for (const cargo of state.cargoes) {
        releaseInternetExplorerCargo(cargo);
      }
      return;
    }

    const center = internetExplorerCenter();
    startInternetExplorerSingularity(center);
    if (updateInternetExplorerSingularity(dt)) {
      return;
    }

    const captureRadius = motionQuery.matches ? 188 : 248;
    const orbitingCargoes = [];

    for (const cargo of state.cargoes) {
      if (!cargo.visible || cargo.dusting || cargo.removed || cargo.vacuumProgress > 0.02) {
        releaseInternetExplorerCargo(cargo);
        continue;
      }

      const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const alreadyOrbiting = !!cargo.internetExplorerOrbit;
      if (!alreadyOrbiting && dist(cargoCenter, center) > captureRadius) {
        continue;
      }

      if (cargo.ownerId || cargo.grabbed) {
        releaseCargoOwner(cargo);
      }

      let orbit = cargo.internetExplorerOrbit;
      if (!orbit) {
        orbit = {
          phase: Math.atan2(cargoCenter.y - center.y, cargoCenter.x - center.x),
          startScale: cargo.internetExplorerScale || 1,
          shrinkAge: 0,
          completedOrbits: 0,
          radiusScale: rand(0.78, 1.16),
          slotBias: rand(-0.2, 0.2),
          attraction: 0,
        };
        cargo.internetExplorerScale = orbit.startScale;
        cargo.internetExplorerOrbit = orbit;
      }

      orbitingCargoes.push(cargo);
    }

    const count = orbitingCargoes.length;
    const visualCount = count + explorer.specks.length;
    const spinSpeed = (motionQuery.matches ? 0.85 : 1.08) * (1 + Math.min(visualCount, 20) * 0.16);
    if (visualCount > 0) {
      explorer.orbitSpin += spinSpeed * dt;
      while (explorer.orbitSpin - explorer.orbitSpinMilestone >= TAU) {
        explorer.orbitSpinMilestone += TAU;
        explorer.orbitCount += visualCount;
      }
    }

    explorer.specks.forEach((speck, index) => {
      const slotPhase = explorer.orbitSpin + (visualCount > 1 ? index * (TAU / visualCount) : 0) + speck.slotBias;
      speck.phase = lerpInternetExplorerAngle(speck.phase, slotPhase, 0.08);
      speck.depth = (Math.sin(speck.phase) + 1) * 0.5;
    });

    orbitingCargoes.forEach((cargo, index) => {
      const orbit = cargo.internetExplorerOrbit;
      const slotPhase = explorer.orbitSpin + (visualCount > 1 ? (explorer.specks.length + index) * (TAU / visualCount) : 0) + orbit.slotBias;
      orbit.phase = lerpInternetExplorerAngle(orbit.phase, slotPhase, 0.12);
      orbit.shrinkAge += dt * (1 + Math.min(count, 16) * 0.055);
      orbit.attraction = clamp(orbit.attraction + dt * 1.8, 0, 1);

      const orbitCenter = internetExplorerOrbitPoint(center, orbit.phase, orbit.radiusScale);
      const minScale = motionQuery.matches ? 0.065 : 0.035;
      const smallScale = motionQuery.matches ? 0.28 : 0.2;
      const fastShrinkDuration = motionQuery.matches ? 0.38 : 0.28;
      const slowShrinkDuration = motionQuery.matches ? 7.4 : 9.2;
      const fastT = clamp(orbit.shrinkAge / fastShrinkDuration, 0, 1);
      const slowT = clamp((orbit.shrinkAge - fastShrinkDuration) / slowShrinkDuration, 0, 1);
      const quickScale = lerp(orbit.startScale, smallScale, cubicEaseInOut(fastT));
      const targetScale = fastT < 1
        ? quickScale
        : lerp(smallScale, minScale, cubicEaseInOut(slowT));
      cargo.internetExplorerScale = lerp(cargo.internetExplorerScale || 1, targetScale, 0.14);
      cargo.internetExplorerDepth = (Math.sin(orbit.phase) + 1) * 0.5;
      const scale = cargo.internetExplorerScale;
      if (scale <= INTERNET_EXPLORER_SPECK_SCALE) {
        addInternetExplorerSpeck(cargo, orbit);
        explorer.orbitItems.delete(cargo.id);
        removeCargo(cargo.id);
        return;
      }
      const targetPos = pt(
        orbitCenter.x - cargo.width * 0.5,
        orbitCenter.y - cargo.height * 0.5
      );
      cargo.pos = lerpPt(cargo.pos, targetPos, 0.16 + orbit.attraction * 0.18);
      cargo.visible = true;
    });
  }

  class InternetExplorerAnimation extends ToolAnimationInterface {
    update(dt) {
      updateInternetExplorer(dt);
    }
  }

  class InternetExplorerTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "internetExplorer",
        hotkey: "i",
        animation: new InternetExplorerAnimation(context),
        toggle: activateInternetExplorer,
      });
    }
  }
