  function tick(dt) {
    state.time += dt;
    rebuildGooseSpatialIndex();
    for (const goose of state.geese) {
      updateGooseTask(goose);
      updateMovement(goose, dt);
      updateHonk(goose);
    }
    updateCargoes();
    updateAntiMalware(dt);
    updateRecycleBin(dt);
    updateTaskManager(dt);
    toolManager.update(dt);
  }
