(function (global) {
    function createBrainSurfingPhysics(options) {
        const {
            state,
            viewport,
            constants,
            updateStage,
            spawnFloatingText,
            triggerScoreFlash,
            playCrash,
            updateWaveSound,
        } = options;

        function loopedSample(values, index) {
            if (!Array.isArray(values) || !values.length || !Number.isFinite(index)) {
                return null;
            }

            let wrappedIndex = index % values.length;
            if (wrappedIndex < 0) wrappedIndex += values.length;
            const value = values[wrappedIndex];
            return Number.isFinite(value) ? value : null;
        }

        function sampleEEG(index) {
            if (!state.eegReady || !state.eegLength) {
                return 0;
            }

            let sum = 0;
            for (let offset = -constants.smoothWindow; offset <= constants.smoothWindow; offset += 1) {
                sum += loopedSample(state.eegValues, index + offset) || 0;
            }

            return sum / (constants.smoothWindow * 2 + 1);
        }

        function jump() {
            const player = state.player;
            if (!player || (!player.onGround && !state.canCoyoteJump)) return;

            player.onGround = false;
            player.vy = constants.jumpVelocity;
            player.airBaseAngle = player.angle - 0.02;
            player.angle = player.airBaseAngle;
            state.canCoyoteJump = false;
            state.coyoteTimer = 0;
        }

        function canJumpNow() {
            const player = state.player;
            if (!player) return false;
            if (player.onGround || state.canCoyoteJump) return true;
            if (!state.terrainProfile.length) return false;

            const index = Math.max(0, Math.min(viewport.width - 1, Math.round(player.x + constants.playerSize / 2)));
            return Math.abs(player.y + constants.playerSize - state.terrainProfile[index]) <= 8;
        }

        function computeTerrain(dt, optionsOverride) {
            const { trackPlayer = true, updateAudio = true } = optionsOverride || {};
            const player = state.player;
            const baselineY = state.groundY;
            const width = viewport.width;
            const wasOnGround = player.onGround;
            const sampleRate = state.eegSampleRate || 50;

            state.eegTime += dt * constants.eegScrollSpeed;
            const localTimeSec = state.eegTime + state.eegStartOffsetSec;
            state.lastEffectiveTime = localTimeSec + state.eegDisplayOffsetSec;
            updateStage(localTimeSec);

            const headSample = Math.floor(localTimeSec * sampleRate);
            state.currentHeadSample = headSample;
            const maxWaveHeight = baselineY - constants.topMargin;
            state.terrainProfile = new Array(width);

            for (let x = 0; x < width; x += 1) {
                const sampleIndex = Math.round(headSample - (width - 1 - x) * constants.horizontalSampleStep);
                let amplitude = (sampleEEG(sampleIndex) + 1) / 2;
                amplitude = Math.min(1, Math.max(0, amplitude * constants.ampScale));
                state.terrainProfile[x] = Math.max(constants.topMargin, baselineY - amplitude * maxWaveHeight);
            }

            if (trackPlayer) {
                const left = Math.max(0, Math.floor(player.x));
                const right = Math.min(width - 1, Math.ceil(player.x + constants.playerSize));
                let contactY = null;

                for (let i = left; i <= right; i += 1) {
                    const y = state.terrainProfile[i];
                    if (contactY === null || y < contactY) contactY = y;
                }

                if (contactY !== null && player.y + constants.playerSize >= contactY - 4 && player.vy >= 0) {
                    player.y = contactY - constants.playerSize;
                    player.vy = 0;
                    player.onGround = true;
                } else {
                    player.onGround = false;
                }

                const centerIndex = Math.max(0, Math.min(width - 1, Math.round(player.x + constants.playerSize / 2)));
                const leftIndex = Math.max(0, centerIndex - 2);
                const rightIndex = Math.min(width - 1, centerIndex + 2);
                const targetAngle = Math.atan2(
                    state.terrainProfile[rightIndex] - state.terrainProfile[leftIndex],
                    rightIndex - leftIndex || 1
                );

                if (player.onGround && Number.isFinite(targetAngle)) {
                    player.angle += (targetAngle - player.angle) * 0.25;
                    player.airBaseAngle = player.angle;
                }

                if (!wasOnGround && player.onGround) {
                    const failedFlip = state.currentTrick === "flip" && state.trickTimer < constants.flipDuration;
                    const failedGlide = state.currentTrick === "glide";

                    if (failedFlip || failedGlide) {
                        state.score = Math.max(0, state.score - constants.trickFailPenalty);
                        spawnFloatingText("-1500", "red");
                        triggerScoreFlash();
                        playCrash();
                    }

                    state.currentTrick = null;
                    state.trickTimer = 0;
                    state.trickLocked = false;
                    state.glideActive = false;
                }
            }

            state.currentWaveAmp = (sampleEEG(headSample) + 1) / 2;
            if (updateAudio) {
                updateWaveSound(player.onGround, state.currentWaveAmp, state.currentTrick);
            }
        }

        function applyPlayerMotion(dt) {
            const player = state.player;
            const gravity = state.currentTrick === "glide" ? constants.glideGravity : constants.gravity;

            if (state.currentTrick === "glide") {
                player.vy = 80;
            }

            player.vy += gravity * dt;
            player.y += player.vy * dt;
        }

        function updateTilt(dt) {
            const player = state.player;
            if (player.onGround) return;

            const targetAngle = player.vy < 0 ? -constants.maxAirTilt : constants.maxAirTilt;
            const currentOffset = player.angle - player.airBaseAngle;
            const speed = state.glideActive ? 0.5 : player.angle < Math.PI / 12 ? 4 : 1.5;

            player.angle = player.airBaseAngle + currentOffset + (targetAngle - currentOffset) * speed * dt;
        }

        return {
            jump,
            canJumpNow,
            computeTerrain,
            applyPlayerMotion,
            updateTilt,
        };
    }

    global.createBrainSurfingPhysics = createBrainSurfingPhysics;
})(window);
