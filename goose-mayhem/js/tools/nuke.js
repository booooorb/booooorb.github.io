  function nukeClampPoint(point) {
    return pt(
      clamp(point.x, 38, Math.max(38, state.width - 38)),
      clamp(point.y, 52, Math.max(52, state.height - 34))
    );
  }

  function toggleNuke(force) {
    const desired = toolToggleDesired(state.nuke, force);
    if (desired && (state.nuke.armed || state.nuke.dropping)) {
      syncToolUi();
      return;
    }

    state.nuke.active = desired;
    if (desired) {
      deactivateExclusiveTools("nuke");
    }
    finishToolToggle();
  }

  function dropNuke(point) {
    if (state.nuke.armed || state.nuke.dropping) {
      return;
    }

    const target = nukeClampPoint(point);
    const dropHeight = clamp(Math.min(220, target.y - 18), 110, 220);
    state.nuke.active = false;
    state.nuke.dropping = true;
    state.nuke.armed = false;
    state.nuke.targetPos = target;
    state.nuke.pos = pt(target.x, target.y - dropHeight);
    state.nuke.velocityY = rand(40, 110);
    state.nuke.droppedAt = state.time;
    state.nuke.detonateAt = 0;
    state.hoveredCargoId = null;
    state.hoveredUiTarget = null;
    syncToolUi();
  }

  function detonateNuke() {
    const center = pt(state.nuke.pos.x, state.nuke.pos.y);
    const cargoes = [...state.cargoes];
    const fireCount = motionQuery.matches ? 12 : 22;
    const horizontalSpread = state.width * (motionQuery.matches ? 0.34 : 0.46);
    const verticalSpread = state.height * (motionQuery.matches ? 0.22 : 0.3);

    state.nuke.dropping = false;
    state.nuke.armed = false;
    state.nuke.flash = 1.35;
    state.nuke.blastAge = 0;
    state.nuke.blastPos = center;
    state.nuke.scorch = 1;
    state.nuke.cloud = {
      active: true,
      origin: pt(center.x, center.y),
      age: 0,
      duration: motionQuery.matches ? 1.7 : 2.35,
      drift: rand(-22, 22),
      phase: rand(0, TAU),
    };
    state.nuke.aftermathFires = Array.from(
      { length: fireCount },
      (_, index) => {
        const angle = rand(0, TAU);
        const band = index < fireCount * 0.4 ? rand(0.16, 0.46) : rand(0.48, 1);
        const offsetStrength = Math.sqrt(rand(0.18, 1)) * band;
        const offset = pt(
          Math.cos(angle) * horizontalSpread * offsetStrength,
          Math.sin(angle) * verticalSpread * offsetStrength
        );
        return {
          pos: pt(
            clamp(center.x + offset.x, 36, state.width - 36),
            clamp(center.y + offset.y, 44, state.height - 32)
          ),
          size: rand(22, 58),
          phase: rand(0, TAU),
          life: rand(10.5, 16.5),
          maxLife: rand(10.5, 16.5),
        };
      }
    );

    for (let i = 0; i < 95; i += 1) {
      spawnNukeParticle(center, rand(0.8, 1.18));
    }

    for (const cargo of cargoes) {
      spawnNukeDebris(cargo, center);
      const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      for (let i = 0; i < 8; i += 1) {
        spawnNukeParticle(lerpPt(center, cargoCenter, 0.72), rand(0.52, 0.86));
      }
    }

    for (let i = 0; i < 24; i += 1) {
      spawnSmoke(center, angleVec(rand(-Math.PI, 0)), rand(1.1, 1.7), 34);
    }
    for (let i = 0; i < 48; i += 1) {
      spawnEmber(center, angleVec(rand(-Math.PI, 0)), rand(1.1, 1.6), 36);
    }

    for (const cargo of cargoes) {
      removeCargo(cargo.id);
    }

    for (const goose of state.geese) {
      goose.pauseUntil = state.time + rand(0.18, 0.42);
      goose.sprinting = true;
      chooseTarget(goose, 120, 1.45);
    }

    syncToolUi();
  }

  function mushroomCloudMetrics(cloud = state.nuke.cloud) {
    if (!cloud.active || cloud.duration <= 0) {
      return null;
    }

    const lifeT = clamp(cloud.age / cloud.duration, 0, 1);
    const growDuration = Math.min(cloud.duration * 0.54, motionQuery.matches ? 0.94 : 1.22);
    const growT = clamp(cloud.age / Math.max(growDuration, 0.001), 0, 1);
    const settle = cubicEaseInOut(growT);
    const reveal = clamp((cloud.age - 0.04) / 0.24, 0, 1);
    const fade = 1 - clamp((lifeT - 0.48) / 0.52, 0, 1);
    const alpha = reveal * fade;
    const capWidth = lerp(
      Math.min(state.width, state.height) * 0.14,
      Math.min(state.width, state.height) * (motionQuery.matches ? 0.34 : 0.44),
      settle
    );
    const capHeight = capWidth * (motionQuery.matches ? 0.68 : 0.78);
    const stemHeight = lerp(36, Math.min(state.height * (motionQuery.matches ? 0.38 : 0.48), 420), settle);
    const stemWidth = lerp(24, capWidth * 0.3, settle);
    const collarWidth = capWidth * lerp(0.56, 0.88, settle);
    const collarHeight = capHeight * lerp(0.3, 0.42, settle);
    const driftT = cubicEaseInOut(clamp(lifeT * 1.3, 0, 1));
    const headX = cloud.origin.x + cloud.drift * driftT + Math.sin(cloud.phase) * (motionQuery.matches ? 3 : 6);
    const baseY = cloud.origin.y + 8;
    const headY = baseY - stemHeight - capHeight * 0.08;
    return {
      lifeT,
      alpha,
      settle,
      baseY,
      headX,
      headY,
      capWidth,
      capHeight,
      stemHeight,
      stemWidth,
      collarWidth,
      collarHeight,
    };
  }

  function updateNuke(dt) {
    const nuke = state.nuke;
    nuke.pulse += dt * (nuke.dropping || nuke.armed ? 8.8 : nuke.active ? 5.6 : 3.2);

    if (nuke.dropping) {
      nuke.velocityY += 2100 * dt;
      nuke.pos.y += nuke.velocityY * dt;
      nuke.pos.x = nuke.targetPos.x;
      if (nuke.pos.y >= nuke.targetPos.y) {
        nuke.pos.y = nuke.targetPos.y;
        nuke.velocityY = 0;
        nuke.dropping = false;
        nuke.armed = true;
        nuke.droppedAt = state.time;
        nuke.detonateAt = state.time + NUKE_FUSE;
        syncToolUi();
      }
    }

      if (nuke.armed && state.time >= nuke.detonateAt) {
        detonateNuke();
      }

    if (nuke.flash > 0) {
      nuke.flash *= Math.exp(-dt * 1.04);
      if (nuke.flash < 0.002) {
        nuke.flash = 0;
      }
    }

      if (nuke.blastAge >= 0) {
        nuke.blastAge += dt;
        if (nuke.blastAge > NUKE_BLAST_DURATION) {
          nuke.blastAge = -1;
        }
      }

    if (nuke.scorch > 0) {
      nuke.scorch *= Math.exp(-dt * 0.085);
      if (nuke.scorch < 0.002) {
        nuke.scorch = 0;
      }
    }

    if (nuke.cloud.active) {
      nuke.cloud.age += dt;
      nuke.cloud.phase += dt * 1.18;
      if (nuke.cloud.age >= nuke.cloud.duration) {
        nuke.cloud.active = false;
      } else {
        const cloud = mushroomCloudMetrics(nuke.cloud);
        if (cloud) {
          if (Math.random() < 0.17 * dt * 60 * cloud.alpha) {
            spawnSmoke(
              pt(
                cloud.headX + rand(-cloud.capWidth * 0.42, cloud.capWidth * 0.42),
                cloud.headY + rand(-cloud.capHeight * 0.18, cloud.capHeight * 0.08)
              ),
              pt(rand(-0.08, 0.08), -1),
              rand(0.94, 1.34),
              cloud.capWidth * 0.12
            );
          }
          if (nuke.cloud.age < 2.8 && Math.random() < 0.16 * dt * 60) {
            spawnEmber(
              pt(
                nuke.cloud.origin.x + rand(-cloud.stemWidth * 1.2, cloud.stemWidth * 1.2),
                nuke.cloud.origin.y + rand(-28, 6)
              ),
              pt(rand(-0.08, 0.08), -1),
              rand(0.76, 1.08),
              cloud.capWidth * 0.08
            );
          }
        }
      }
    }

    compactInPlace(nuke.aftermathFires, (fire) => {
      fire.life -= dt;
      fire.phase += dt * 5.6;
      return fire.life > 0;
    });

    if (nuke.scorch > 0 && nuke.aftermathFires.length) {
      for (const fire of nuke.aftermathFires) {
        if (Math.random() < 0.55 * dt * 60) {
          spawnSmoke(
            add(fire.pos, pt(rand(-fire.size * 0.2, fire.size * 0.2), rand(-8, 8))),
            pt(rand(-0.08, 0.08), -1),
            rand(0.7, 1.12),
            fire.size * 0.35
          );
        }
        if (Math.random() < 0.42 * dt * 60) {
          spawnEmber(
            add(fire.pos, pt(rand(-fire.size * 0.18, fire.size * 0.18), rand(-6, 6))),
            pt(rand(-0.1, 0.1), -1),
            rand(0.68, 1.04),
            fire.size * 0.22
          );
        }
      }
    }

    compactInPlace(nuke.particles, (particle) => {
      particle.life -= dt;
      particle.pos = add(particle.pos, mul(particle.vel, dt));
      particle.vel = add(mul(particle.vel, 0.94), pt(0, 220 * dt));
      particle.size *= 0.986;
      return particle.life > 0 && particle.size > 1.4;
    });

    compactInPlace(nuke.debris, (piece) => {
      piece.life -= dt;
      piece.pos = add(piece.pos, mul(piece.vel, dt));
      piece.vel = add(mul(piece.vel, 0.962), pt(0, 280 * dt));
      piece.angle += piece.spin * dt;
      return piece.life > 0;
    });
  }

  class NukeAnimation extends ToolAnimationInterface {
    update(dt) {
      updateNuke(dt);
    }

    drawDropped() {
      drawDroppedNuke();
    }

    drawCursor() {
      drawNukeCursor();
    }

    drawEffects() {
      drawNukeEffects();
    }
  }

  class NukeTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "nuke",
        hotkey: "n",
        animation: new NukeAnimation(context),
        toggle: toggleNuke,
      });
    }

    drop(point) {
      dropNuke(point);
    }
  }
