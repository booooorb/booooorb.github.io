(function (global) {
    function createBrainSurfingControls(options) {
        const {
            state,
            canvas,
            layout,
            physics,
            particles,
            constants,
            onRestart,
            ensureWaveSound,
            ensureActionSound,
            playFlip,
            pauseWaveSound,
        } = options;

        function primaryKey(event) {
            return event.code === "Space" ||
                event.key === " " ||
                event.key === "ArrowUp" ||
                event.key === "w" ||
                event.key === "W";
        }

        function isInteractiveElement(target) {
            return Boolean(target?.closest("button, select, option, input, label, a, summary"));
        }

        function clearHeldInput() {
            state.primaryDown = false;
            state.pressInAir = false;

            clearHoldTimer();
        }

        function clearHoldTimer() {
            if (state.holdTimerId === null) return;

            clearTimeout(state.holdTimerId);
            state.holdTimerId = null;
        }

        function handlePrimaryDown() {
            if (state.isGameOver || state.primaryDown) return;

            state.primaryDown = true;
            ensureWaveSound?.();
            ensureActionSound?.();

            if (physics.canJumpNow()) {
                physics.jump();
                return;
            }

            if (state.trickLocked) return;

            state.pressInAir = true;
            state.holdTimerId = setTimeout(() => {
                if (!state.pressInAir || state.trickLocked || state.currentTrick || state.isGameOver) return;

                state.currentTrick = "glide";
                state.glideActive = true;
                state.trickLocked = true;
                state.trickTimer = 0;
            }, constants.holdThreshold);
        }

        function handlePrimaryUp() {
            if (!state.primaryDown) return;

            state.primaryDown = false;
            clearHoldTimer();
            if (state.isGameOver || !state.player) return;

            if (state.currentTrick === "glide") {
                state.currentTrick = null;
                state.glideActive = false;
                state.pressInAir = false;
                return;
            }

            if (
                state.pressInAir &&
                !state.player.onGround &&
                !state.canCoyoteJump &&
                !state.trickLocked &&
                !state.currentTrick
            ) {
                state.currentTrick = "flip";
                state.trickTimer = 0;
                state.trickLocked = true;
                state.flipAnimTimeLeft = constants.flipDuration * (2 / 3);
                state.score += 1000;
                particles.spawnFloatingText("+1000");
                playFlip?.();
            }

            state.pressInAir = false;
        }

        function pauseForInactiveTab() {
            state.isTabPaused = true;
            state.lastTime = performance.now();
            clearHeldInput();
            pauseWaveSound?.();
        }

        function resumeFromInactiveTab() {
            if (document.hidden) return;
            state.isTabPaused = false;
            state.lastTime = performance.now();
        }

        function bind() {
            canvas.addEventListener("pointermove", layout.setWaveProbeFromPointer);
            canvas.addEventListener("pointerdown", layout.setWaveProbeFromPointer);
            canvas.addEventListener("pointerleave", () => {
                state.waveProbeX = null;
            });

            window.addEventListener("keydown", (event) => {
                if (primaryKey(event)) {
                    event.preventDefault();
                    handlePrimaryDown();
                }

                if ((event.key === "r" || event.key === "R") && state.isGameOver) {
                    onRestart?.();
                }
            });

            window.addEventListener("keyup", (event) => {
                if (primaryKey(event)) handlePrimaryUp();
            });

            window.addEventListener("pointerdown", (event) => {
                if (isInteractiveElement(event.target)) return;
                event.preventDefault();

                if (state.isGameOver) {
                    onRestart?.();
                    return;
                }

                handlePrimaryDown();
            });

            window.addEventListener("pointerup", handlePrimaryUp);
            window.addEventListener("blur", pauseForInactiveTab);
            window.addEventListener("focus", resumeFromInactiveTab);

            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    pauseForInactiveTab();
                    return;
                }

                resumeFromInactiveTab();
            });
        }

        return {
            bind,
            clearHeldInput,
        };
    }

    global.createBrainSurfingControls = createBrainSurfingControls;
})(window);
