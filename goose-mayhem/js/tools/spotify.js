  function spotifyOrigin() {
    const app = state.desktopApps.spotify;
    if (!app?.owned) {
      return pt(state.width / 2, state.height / 2);
    }
    const rect = desktopToolIconRect("spotify");
    return pt(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }

  function repelGooseFromSpotify(goose, origin, radius, power = 1) {
    const away = norm(sub(goose.pos, origin));
    const direction = mag(away) ? away : angleVec(rand(0, TAU));
    if (goose.cargoId) {
      dropGooseCargo(goose);
    }
    goose.sprinting = true;
    goose.pauseUntil = 0;
    goose.spotifyAvoidUntil = state.time + rand(3.6, 5.8);
    goose.nextMayhemTime = Math.max(goose.nextMayhemTime || 0, state.time + rand(3.2, 5.4));
    goose.target = clampPoint(add(goose.pos, mul(direction, radius * rand(0.55, 0.92) * power)));
    goose.vel = add(goose.vel, mul(direction, rand(220, 360) * power));
    if (Math.random() < 0.42) {
      triggerHonk(goose, "HONK!");
    }
  }

  function triggerSpotifyShockwave() {
    const origin = spotifyOrigin();
    const directRadius = motionQuery.matches ? 58 : 76;
    const waveRadius = Math.min(Math.max(state.width, state.height) * 0.5, motionQuery.matches ? 380 : 540);
    const directHits = [];

    const waveCount = motionQuery.matches ? 2 : 4;
    for (let i = 0; i < waveCount; i += 1) {
      state.spotify.waves.unshift({
        origin,
        age: -i * (motionQuery.matches ? 0.26 : 0.2),
        duration: motionQuery.matches ? 1.05 : 1.38,
        radius: waveRadius * lerp(0.82, 1.08, i / Math.max(waveCount - 1, 1)),
        directRadius,
      });
    }
    if (state.spotify.waves.length > 10) {
      state.spotify.waves.length = 10;
    }

    state.spotify.avoidZones.unshift({
      origin,
      age: 0,
      duration: motionQuery.matches ? 4.4 : 6.6,
      radius: waveRadius * 1.08,
      nextPulseAt: state.time + 0.24,
    });
    if (state.spotify.avoidZones.length > 3) {
      state.spotify.avoidZones.length = 3;
    }

    for (const cargo of state.cargoes) {
      if (!cargo.visible || cargo.dusting || cargo.removed) {
        continue;
      }
      const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const distance = dist(origin, center);
      if (distance <= directRadius + Math.hypot(cargo.width, cargo.height) * 0.22) {
        directHits.push(cargo);
      }
    }

    for (const cargo of directHits) {
      if (!cargo.removed) {
        spawnFistShards(cargo, origin);
        removeCargo(cargo.id);
      }
    }

    for (const goose of state.geese) {
      const distance = dist(origin, goose.pos);
      if (distance <= waveRadius) {
        repelGooseFromSpotify(goose, origin, waveRadius, clamp(1 - distance / waveRadius, 0.35, 1));
      }
    }

    syncToolUi();
  }

  function updateSpotify(dt) {
    state.spotify.pulse += dt * 5.2;
    compactInPlace(state.spotify.waves, (wave) => {
      wave.age += dt;
      return wave.age < wave.duration;
    });

    compactInPlace(state.spotify.avoidZones, (zone) => {
      zone.age += dt;
      if (zone.age >= zone.duration) {
        return false;
      }

      const strength = 1 - zone.age / zone.duration;
      const shouldPulse = state.time >= zone.nextPulseAt;
      if (shouldPulse) {
        zone.nextPulseAt = state.time + rand(0.36, 0.64);
      }

      for (const goose of state.geese) {
        const distance = dist(zone.origin, goose.pos);
        if (distance > zone.radius) {
          continue;
        }
        const away = norm(sub(goose.pos, zone.origin));
        const direction = mag(away) ? away : angleVec(rand(0, TAU));
        const closeness = clamp(1 - distance / zone.radius, 0, 1);
        if (goose.cargoId && (shouldPulse || closeness > 0.72)) {
          dropGooseCargo(goose);
        }
        goose.sprinting = true;
        goose.pauseUntil = 0;
        goose.spotifyAvoidUntil = Math.max(goose.spotifyAvoidUntil || 0, state.time + 1.2 + strength * 2.4);
        goose.nextMayhemTime = Math.max(goose.nextMayhemTime || 0, state.time + 1.4 + strength * 2.2);
        goose.target = clampPoint(add(goose.pos, mul(direction, lerp(120, 260, closeness) * (0.45 + strength * 0.55))));
        if (shouldPulse) {
          goose.vel = add(goose.vel, mul(direction, lerp(80, 210, closeness) * strength));
        }
      }
      return true;
    });
  }

  class SpotifyAnimation extends ToolAnimationInterface {
    update(dt) {
      updateSpotify(dt);
    }
  }

  class SpotifyTool extends ToolInterface {
    constructor(context) {
      super(context, {
        id: "spotify",
        hotkey: "s",
        animation: new SpotifyAnimation(context),
      });
    }

    launchFromDesktop() {
      triggerSpotifyShockwave();
    }
  }
