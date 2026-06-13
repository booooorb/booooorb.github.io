  class GooseTaskController {
    constructor(id) {
      this.id = id;
    }

    enter(goose, data = null) {
      goose.task = this.id;
      goose.taskData = data;
    }

    update(goose) {
      void goose;
    }
  }

  class WanderGooseTask extends GooseTaskController {
    constructor() {
      super(TASKS.WANDER);
    }

    enter(goose, options = {}) {
      const config = options || {};
      super.enter(goose, null);
      goose.sprinting = false;
      goose.pauseUntil = state.time + rand(...(config.pauseRange || [0.14, 0.42]));
      goose.nextMayhemTime = state.time + rand(...(config.mayhemRange || [1.2, 4.2]));
      chooseTarget(goose, config.minDistance ?? 90, config.roamScale ?? 0.95);
    }

    update(goose) {
      goose.sprinting = false;
      if (state.time < goose.pauseUntil) {
        goose.target = pt(goose.pos.x, goose.pos.y);
        return;
      }
      if (dist(goose.pos, goose.target) < 18) {
        goose.pauseUntil = state.time + rand(0.18, 0.72);
        chooseTarget(goose, 90, 0.92);
      }
    }
  }

  class MudTrailGooseTask extends GooseTaskController {
    constructor() {
      super(TASKS.TRACK_MUD);
    }

    enter(goose, options = {}) {
      super.enter(goose, {
        finishTime: state.time + rand(2.2, 4),
        nextTurnTime: state.time + rand(0.45, 1.1),
      });
      goose.sprinting = true;
      chooseTarget(goose, 150, 1.35);
      triggerHonk(goose, options.honkText || "HRONK");
    }

    update(goose) {
      goose.sprinting = true;
      const data = goose.taskData;
      if (!data) {
        return;
      }

      if (state.time > data.finishTime) {
        gooseTaskRegistry.enter(goose, TASKS.WANDER, {
          pauseRange: [0.2, 0.7],
          mayhemRange: [1.2, 4.4],
          minDistance: 80,
          roamScale: 0.92,
        });
        return;
      }

      if (dist(goose.pos, goose.target) < 18 || state.time > data.nextTurnTime) {
        chooseTarget(goose, 130, 1.42);
        data.nextTurnTime = state.time + rand(0.45, 1.1);
      }
    }
  }

  class CursorChaseGooseTask extends GooseTaskController {
    constructor() {
      super(TASKS.CHASE_CURSOR);
    }

    enter(goose, triggerPoint) {
      super.enter(goose, {
        origin: pt(triggerPoint.x, triggerPoint.y),
        giveUpDistance: rand(CURSOR_CHASE_GIVE_UP_DISTANCE - 30, CURSOR_CHASE_GIVE_UP_DISTANCE + 30),
      });
      goose.sprinting = true;
      goose.pauseUntil = 0;
      goose.target = state.pointer.inside ? clampPoint(state.pointer.pos) : clampPoint(triggerPoint);
      if (Math.random() < 0.45) {
        triggerHonk(goose, "HONK!");
      }
    }

    update(goose) {
      const data = goose.taskData;
      if (!data) {
        sendGooseBackToWander(goose, 0.9);
        return;
      }

      goose.sprinting = true;
      if (!state.pointer.inside) {
        sendGooseBackToWander(goose, 0.9);
        return;
      }

      const pointer = state.pointer.pos;
      if (
        dist(pointer, goose.pos) > data.giveUpDistance ||
        dist(pointer, data.origin) > data.giveUpDistance * 1.12
      ) {
        sendGooseBackToWander(goose, 0.9);
        return;
      }

      goose.target = clampPoint(pointer);
    }
  }

  class BreadChaseGooseTask extends GooseTaskController {
    constructor() {
      super(TASKS.BREAD_CHASE);
    }

    enter(goose) {
      if (goose.cargoId) {
        dropGooseCargo(goose);
      }
      super.enter(goose, null);
      goose.sprinting = true;
      goose.pauseUntil = 0;
      goose.target = state.pointer.inside
        ? clampPoint(state.pointer.pos)
        : clampPoint(goose.pos);
      if (Math.random() < 0.2) {
        triggerHonk(goose, "HONK!");
      }
    }

    update(goose) {
      if (!state.bread.active || !state.pointer.inside) {
        sendGooseBackToWander(goose, 0.88);
        return;
      }

      if (dist(goose.pos, state.pointer.pos) > breadChaseRange() * 1.05) {
        sendGooseBackToWander(goose, 0.88);
        return;
      }

      goose.sprinting = true;
      goose.pauseUntil = 0;
      goose.target = clampPoint(state.pointer.pos);
    }
  }

  class DragTabGooseTask extends GooseTaskController {
    constructor() {
      super(TASKS.DRAG_TAB);
    }

    enter(goose, cargo) {
      goose.cargoId = cargo.id;
      super.enter(goose, {
        stage: DRAG_STAGE.EXITING,
        screenDirection: setTargetOffscreen(goose, true),
        waitUntil: 0,
        dropPoint: pt(),
      });
      goose.sprinting = true;
      triggerHonk(goose, "HONK!");
    }

    reset(goose) {
      goose.task = TASKS.WANDER;
      goose.taskData = null;
      goose.cargoId = null;
      goose.sprinting = false;
    }

    update(goose) {
      goose.sprinting = true;
      const data = goose.taskData;
      const cargo = currentCargo(goose);
      if (!data || !cargo) {
        this.reset(goose);
        return;
      }

      if (data.stage === DRAG_STAGE.EXITING) {
        if (dist(goose.pos, goose.target) < 10) {
          data.stage = DRAG_STAGE.WAITING;
          data.waitUntil = state.time + rand(0.3, 0.8);
          goose.vel = pt();
        }
        return;
      }

      if (data.stage === DRAG_STAGE.WAITING) {
        goose.target = pt(goose.pos.x, goose.pos.y);
        goose.vel = pt();
        if (state.time >= data.waitUntil) {
          if (!hasTabCapacity(cargo.id)) {
            removeCargo(cargo.id);
            gooseTaskRegistry.enter(goose, TASKS.WANDER, {
              pauseRange: [0.25, 0.7],
              mayhemRange: [0.9, 2.2],
              minDistance: 90,
              roamScale: 0.92,
            });
            return;
          }

          data.stage = DRAG_STAGE.DRAGGING;
          data.dropPoint = dragDropPoint(cargo, data.screenDirection);
          cargo.visible = true;
          cargo.grabbed = true;
          cargo.ownerId = goose.id;
          goose.target = data.dropPoint;
        }
        return;
      }

      cargo.visible = true;
      cargo.grabbed = true;
      cargo.ownerId = goose.id;
      if (dist(goose.pos, goose.target) < 12) {
        cargo.grabbed = false;
        cargo.ownerId = null;
        goose.cargoId = null;
        gooseTaskRegistry.enter(goose, TASKS.WANDER, {
          pauseRange: [0.15, 0.5],
          mayhemRange: [1.2, 4.4],
          minDistance: 90,
          roamScale: 0.72,
        });
      }
    }
  }

  class GooseTaskRegistry {
    constructor(tasks) {
      this.tasks = new Map(tasks.map((task) => [task.id, task]));
    }

    get(taskId) {
      return this.tasks.get(taskId) || this.tasks.get(TASKS.WANDER);
    }

    enter(goose, taskId, data = null) {
      this.get(taskId).enter(goose, data);
    }

    update(goose) {
      this.get(goose.task).update(goose);
    }
  }

  const gooseTaskRegistry = new GooseTaskRegistry([
    new WanderGooseTask(),
    new MudTrailGooseTask(),
    new CursorChaseGooseTask(),
    new BreadChaseGooseTask(),
    new DragTabGooseTask(),
  ]);
