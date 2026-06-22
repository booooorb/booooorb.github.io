  function preserveFutureTimer(target, key, dt, previousTime) {
    if (!target || !Number.isFinite(target[key]) || target[key] <= previousTime) {
      return;
    }
    target[key] += dt;
  }

  function preserveFrozenGooseTimers(dt, previousTime) {
    for (const goose of state.geese) {
      preserveFutureTimer(goose, "pauseUntil", dt, previousTime);
      preserveFutureTimer(goose, "nextMayhemTime", dt, previousTime);
      preserveFutureTimer(goose, "honkUntil", dt, previousTime);
      preserveFutureTimer(goose, "nextHonkTime", dt, previousTime);
      preserveFutureTimer(goose, "nextSeparationSampleAt", dt, previousTime);
      preserveFutureTimer(goose, "spotifyAvoidUntil", dt, previousTime);
      preserveFutureTimer(goose.taskData, "finishTime", dt, previousTime);
      preserveFutureTimer(goose.taskData, "nextTurnTime", dt, previousTime);
      preserveFutureTimer(goose.taskData, "waitUntil", dt, previousTime);
    }
  }

  function tick(dt) {
    const previousTime = state.time;
    state.time += dt;
    const geeseFrozen = mediaPlayerFreezeActive();

    if (geeseFrozen) {
      preserveFrozenGooseTimers(dt, previousTime);
    } else {
      rebuildGooseSpatialIndex();
      for (const goose of state.geese) {
        updateGooseTask(goose);
        updateMovement(goose, dt);
        updateHonk(goose);
      }
    }

    updateCargoes();
    updateAntiMalware(dt);
    updateRecycleBin(dt);
    updateTaskManager(dt);
    toolManager.update(dt);
  }
