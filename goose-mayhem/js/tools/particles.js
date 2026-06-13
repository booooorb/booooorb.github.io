  function flameParticleBudget() {
    const tier = effectTier();
    if (tier === 2) return 180;
    if (tier === 1) return 250;
    return 340;
  }

  function smokeParticleBudget() {
    const tier = effectTier();
    if (tier === 2) return 130;
    if (tier === 1) return 190;
    return 250;
  }

  function emberParticleBudget() {
    const tier = effectTier();
    if (tier === 2) return 110;
    if (tier === 1) return 150;
    return 210;
  }

  function flameSpawnCount() {
    const tier = effectTier();
    if (tier === 2) return 8;
    if (tier === 1) return 12;
    return 16;
  }

  function nukeParticleBudget() {
    const tier = effectTier();
    if (tier === 2) return 180;
    if (tier === 1) return 240;
    return 320;
  }

  function nukeDebrisBudget() {
    const tier = effectTier();
    if (tier === 2) return 120;
    if (tier === 1) return 180;
    return 250;
  }

  function pushTrimmed(list, particle, budget) {
    list.push(particle);
    if (list.length > budget) {
      list.splice(0, list.length - budget);
    }
  }

  function spawnSmoke(origin, drift = pt(0, -1), intensity = 1, spread = 18) {
    const direction = mag(drift) ? norm(drift) : pt(0, -1);
    const side = perp(direction);
    const lifetime = rand(0.45, 0.9) * lerp(0.86, 1.2, intensity);
    pushTrimmed(state.flamethrower.smokeParticles, {
      pos: add(origin, mul(side, rand(-spread, spread))),
      vel: add(
        mul(direction, rand(18, 52) * intensity),
        pt(rand(-20, 20), rand(-56, -10))
      ),
      size: rand(15, 28) * lerp(0.84, 1.3, intensity),
      life: lifetime,
      maxLife: lifetime,
    }, smokeParticleBudget());
  }

  function spawnEmber(origin, drift = pt(0, -1), intensity = 1, spread = 12) {
    const direction = mag(drift) ? norm(drift) : pt(0, -1);
    const side = perp(direction);
    const lifetime = rand(0.24, 0.56) * lerp(0.9, 1.18, intensity);
    pushTrimmed(state.flamethrower.emberParticles, {
      pos: add(origin, mul(side, rand(-spread, spread))),
      vel: add(
        mul(direction, rand(80, 190) * intensity),
        add(mul(side, rand(-90, 90)), pt(rand(-18, 18), rand(-44, 14)))
      ),
      size: rand(2.2, 5.8) * lerp(0.9, 1.26, intensity),
      life: lifetime,
      maxLife: lifetime,
      spin: rand(-5, 5),
      angle: rand(0, TAU),
    }, emberParticleBudget());
  }

  function spawnNukeParticle(center, speedScale = 1) {
    const angle = rand(0, TAU);
    const velocity = add(
      mul(angleVec(angle), rand(120, 540) * speedScale),
      pt(rand(-40, 40), rand(-300, -90) * speedScale)
    );
    const lifetime = rand(0.45, 0.98);
    pushTrimmed(state.nuke.particles, {
      pos: pt(center.x, center.y),
      vel: velocity,
      size: rand(10, 28) * speedScale,
      life: lifetime,
      maxLife: lifetime,
      color: Math.random() < 0.18
        ? COLORS.nukeBlastCore
        : Math.random() < 0.58
          ? COLORS.nukeBlastMid
          : COLORS.nukeBlastEdge,
    }, nukeParticleBudget());
  }

  function spawnNukeDebris(cargo, center) {
    const pieces = Math.round(clamp((cargo.width * cargo.height) / 2400, 6, 16));
    for (let i = 0; i < pieces; i += 1) {
      const spawn = pt(
        cargo.pos.x + rand(8, cargo.width - 8),
        cargo.pos.y + rand(16, cargo.height - 8)
      );
      const away = norm(sub(spawn, center));
      const velocity = add(
        mul(mag(away) ? away : angleVec(rand(0, TAU)), rand(140, 380)),
        pt(rand(-40, 40), rand(-220, -80))
      );
      const lifetime = rand(0.7, 1.5);
      pushTrimmed(state.nuke.debris, {
        pos: spawn,
        vel: velocity,
        angle: rand(0, TAU),
        spin: rand(-7, 7),
        width: rand(10, 24),
        height: rand(6, 14),
        life: lifetime,
        maxLife: lifetime,
      }, nukeDebrisBudget());
    }
  }
