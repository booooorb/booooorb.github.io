  function cargoDustProgress(cargo) {
    if (!cargo.dusting || state.time < cargo.dustStartAt) {
      return 0;
    }
    return clamp(
      (state.time - cargo.dustStartAt) / Math.max(cargo.dustDuration, 0.001),
      0,
      1
    );
  }

  function cargoDustColor(cargo) {
    if (cargo.kind === "meme") {
      return Math.random() < 0.28
        ? COLORS.gauntletDustHot
        : Math.random() < 0.58
          ? "rgba(222, 204, 186, 0.86)"
          : "rgba(188, 164, 144, 0.8)";
    }
    return Math.random() < 0.24
      ? COLORS.gauntletDustHot
      : Math.random() < 0.6
        ? COLORS.gauntletDustWarm
        : COLORS.gauntletDust;
  }

  function spawnGauntletDust(cargo, progress, burstScale = 1) {
    const count = Math.max(2, Math.round((motionQuery.matches ? 3 : 6) * burstScale));
    const wind = pt(rand(74, 138), rand(-42, 10));
    for (let i = 0; i < count; i += 1) {
      const local = pt(
        rand(12, cargo.width - 12),
        rand(18, cargo.height - 12)
      );
      const lifetime = rand(0.88, 1.58) * lerp(0.92, 1.16, progress);
      pushTrimmed(state.gauntlet.dustParticles, {
        pos: add(cargo.pos, local),
        vel: add(
          wind,
          pt(rand(-34, 34), rand(-46, 22))
        ),
        size: rand(2.6, 7.8) * lerp(0.9, 1.18, progress),
        life: lifetime,
        maxLife: lifetime,
        color: cargoDustColor(cargo),
        angle: rand(0, TAU),
        spin: rand(-3.2, 3.2),
      }, dustParticleBudget());
    }
  }

  function startCargoDusting(cargo, delay = 0) {
    if (!cargo || cargo.dusting) {
      return;
    }
    releaseCargoOwner(cargo);
    cargo.visible = true;
    cargo.grabbed = false;
    cargo.ownerId = null;
    cargo.dusting = true;
    cargo.dustStartAt = state.time + delay;
    cargo.dustDuration = rand(motionQuery.matches ? 0.95 : 1.15, motionQuery.matches ? 1.45 : 1.95);
    cargo.dustNextAt = cargo.dustStartAt;
    cargo.dustSeed = rand(0, 1000);
  }

  function triggerGauntletSnap() {
    if (state.gauntlet.snapping) {
      return;
    }

    const candidates = state.cargoes.filter((cargo) => cargo.visible && !cargo.dusting);
    if (!candidates.length) {
      return;
    }

    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = randInt(0, i);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const snapCount = Math.max(1, Math.ceil(candidates.length * 0.5));
    let maxEndTime = state.time;
    for (let i = 0; i < snapCount; i += 1) {
      const cargo = candidates[i];
      const delay = rand(0, motionQuery.matches ? 0.25 : 0.52);
      startCargoDusting(cargo, delay);
      maxEndTime = Math.max(maxEndTime, state.time + delay + cargo.dustDuration);
    }

    state.gauntlet.snapping = true;
    state.gauntlet.cooldownUntil = maxEndTime + 0.35;
    syncToolUi();
  }

  class GauntletAnimation extends ToolAnimationInterface {
    update(dt) {
      updateGauntlet(dt);
    }

    drawDust() {
      drawGauntletDust();
    }
  }

  class GauntletTool extends ToolInterface {
    constructor(context) {
      super(context, {
        id: "gauntlet",
        hotkey: "g",
        animation: new GauntletAnimation(context),
      });
    }

    launchFromDesktop() {
      triggerGauntletSnap();
    }
  }
