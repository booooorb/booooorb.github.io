(function (global) {
    const SPIKE_SPEED = 340;
    const FAST_SPIKE_SPEED = 900;

    const SPIKE_INTERVAL_START = 4.0;
    const SPIKE_INTERVAL_MIN = 1.0;
    const SPIKE_RAMP_DURATION = 80;

    const BOAT_GRAVITY = 1600;
    const BOAT_LAUNCH_MIN_RISE = 2.5;
    const BOAT_JUMP_SCALE = 0.75;
    const BOAT_BASE_SCALE = 0.25;
    const BOAT_HOVER_OFFSET = 6;
    const EDGE_DETACH_THRESHOLD = 4;

    const BOAT_ROTATION_BLEND = 0.2;
    const BOAT_MAX_ANGLE = Math.PI / 8;
    const BOAT_MAX_ANGLE_STEP = Math.PI / 90;
    const JUMPER_JUMP_COOLDOWN = 0;

    const boatSources = global.BrainSurfingConfig?.assets?.boats || [];
    const BOAT_CONFIGS = boatSources.map((src, index) => ({
        src,
        scale: index === 5 ? 0.25 : index === 6 ? 0.3 : 1,
    }));

    for (const cfg of BOAT_CONFIGS) {
        const img = new Image();
        img.src = cfg.src;
        cfg.img = img;
    }

    function getBoatDrawSize(cfg) {
        const img = cfg.img;
        const naturalW = img?.naturalWidth || 32;
        const naturalH = img?.naturalHeight || 32;
        const scale = BOAT_BASE_SCALE * (cfg.scale ?? 1);
        return {
            drawW: naturalW * scale,
            drawH: naturalH * scale,
        };
    }

    const SpikeSystem = {
        init({ onHit, jumpVelocity }) {
            this.onHit = typeof onHit === "function" ? onHit : null;
            this.jumpVelocity = typeof jumpVelocity === "number" ? jumpVelocity : -640;
            this.reset();
        },

        reset() {
            this.spikes = [];
            this.spikeTimer = SPIKE_INTERVAL_START;
            this.time = 0;
        },

        spawnSpike(canvasWidth) {
            if (!canvasWidth || !BOAT_CONFIGS.length) return;

            const boatIndex = Math.floor(Math.random() * BOAT_CONFIGS.length);
            const cfg = BOAT_CONFIGS[boatIndex];
            const { drawW } = getBoatDrawSize(cfg);

            this.spikes.push({
                x: canvasWidth + drawW,
                y: null,
                vy: 0,
                onGround: false,
                lastGroundY: null,
                boatIndex,
                angle: 0,
                isJumper: boatIndex === 5,
                jumpCooldown: 0,
            });
        },

        update(dt, terrainProfile, player, playerSize, canvasWidth) {
            if (!terrainProfile?.length || !player) return;

            this.time += dt;
            this.spikeTimer -= dt;

            while (this.spikeTimer <= 0) {
                this.spawnSpike(canvasWidth);

                const alpha = Math.min(this.time, SPIKE_RAMP_DURATION) / SPIKE_RAMP_DURATION;
                const baseInterval =
                    SPIKE_INTERVAL_START - (SPIKE_INTERVAL_START - SPIKE_INTERVAL_MIN) * alpha;
                const jitterFactor = 0.2 + Math.random() * 2.8;

                this.spikeTimer += Math.max(SPIKE_INTERVAL_MIN, baseInterval * jitterFactor);
            }

            const sampleY = player.y + playerSize * 0.9;
            const samplePoints = [
                { x: player.x + playerSize * 0.25, y: sampleY },
                { x: player.x + playerSize * 0.5, y: sampleY },
                { x: player.x + playerSize * 0.75, y: sampleY },
            ];

            for (let i = this.spikes.length - 1; i >= 0; i--) {
                const s = this.spikes[i];
                if (s.jumpCooldown > 0) {
                    s.jumpCooldown = Math.max(0, s.jumpCooldown - dt);
                }

                const cfg = BOAT_CONFIGS[s.boatIndex];
                if (!cfg) continue;

                const speed = cfg.src.endsWith("boat7.png") ? FAST_SPIKE_SPEED : SPIKE_SPEED;
                s.x -= speed * dt;

                if (s.x < -200) {
                    this.spikes.splice(i, 1);
                    continue;
                }

                const idx = Math.max(0, Math.min(terrainProfile.length - 1, Math.round(s.x)));
                const baseY = terrainProfile[idx];
                if (baseY == null) continue;

                const { drawW, drawH } = getBoatDrawSize(cfg);

                if (s.y == null) {
                    s.y = baseY - drawH;
                    s.vy = 0;
                    s.onGround = true;
                    s.lastGroundY = baseY;
                }

                const prevBase = typeof s.lastGroundY === "number" ? s.lastGroundY : baseY;
                const deltaBase = baseY - prevBase;
                const riseUp = prevBase - baseY;

                if (s.onGround) {
                    if (s.isJumper && s.jumpCooldown === 0 && riseUp > BOAT_LAUNCH_MIN_RISE) {
                        s.onGround = false;
                        s.vy = this.jumpVelocity * BOAT_JUMP_SCALE;
                        s.jumpCooldown = JUMPER_JUMP_COOLDOWN;
                    } else if (deltaBase > EDGE_DETACH_THRESHOLD) {
                        s.onGround = false;
                    } else {
                        s.y = baseY - drawH - BOAT_HOVER_OFFSET;
                        s.vy = 0;
                    }
                }

                if (!s.onGround) {
                    s.vy += BOAT_GRAVITY * dt;
                    s.y += s.vy * dt;

                    const boatBottom = s.y + drawH;
                    const landLine = baseY - BOAT_HOVER_OFFSET;
                    if (boatBottom >= landLine && s.vy >= 0) {
                        s.y = landLine - drawH;
                        s.vy = 0;
                        s.onGround = true;
                    }
                }

                s.lastGroundY = baseY;

                const leftIdx = Math.max(0, idx - 4);
                const rightIdx = Math.min(terrainProfile.length - 1, idx + 4);
                const yL = terrainProfile[leftIdx];
                const yR = terrainProfile[rightIdx];
                if (yL != null && yR != null) {
                    const dx = rightIdx - leftIdx || 1;
                    const dy = yR - yL;
                    let targetAngle = Math.atan2(dy, dx);

                    targetAngle = Math.max(-BOAT_MAX_ANGLE, Math.min(BOAT_MAX_ANGLE, targetAngle));

                    if (!Number.isFinite(s.angle)) {
                        s.angle = targetAngle;
                    } else {
                        let diff = targetAngle - s.angle;
                        if (diff > Math.PI) diff -= 2 * Math.PI;
                        if (diff < -Math.PI) diff += 2 * Math.PI;

                        diff = Math.max(-BOAT_MAX_ANGLE_STEP, Math.min(BOAT_MAX_ANGLE_STEP, diff));
                        s.angle += diff * BOAT_ROTATION_BLEND;
                    }
                }

                const left = s.x - drawW / 2;
                const right = s.x + drawW / 2;
                const top = s.y;
                const bottom = s.y + drawH;

                const hitLeft = left + drawW * 0.1;
                const hitRight = right - drawW * 0.1;
                const hitTop = top + drawH * 0.15;

                for (const point of samplePoints) {
                    if (
                        point.x >= hitLeft &&
                        point.x <= hitRight &&
                        point.y >= hitTop &&
                        point.y <= bottom
                    ) {
                        if (this.onHit) this.onHit();
                        return;
                    }
                }
            }
        },

        draw(ctx, terrainProfile) {
            if (!terrainProfile?.length || !this.spikes?.length) return;

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            for (const s of this.spikes) {
                const cfg = BOAT_CONFIGS[s.boatIndex];
                const img = cfg?.img;
                if (!cfg || !img || s.y == null) continue;

                const { drawW, drawH } = getBoatDrawSize(cfg);
                const pivotX = s.x;
                const pivotY = s.y + drawH;

                ctx.save();
                ctx.translate(pivotX, pivotY);
                ctx.rotate(s.angle || 0);

                const left = -drawW / 2;
                const top = -drawH;
                if (img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, left, top, drawW, drawH);
                } else {
                    ctx.fillStyle = "#000";
                    ctx.fillRect(left, top, drawW, drawH);
                }
                ctx.restore();
            }

            ctx.restore();
        },
    };

    global.SpikeSystem = SpikeSystem;
})(window);
