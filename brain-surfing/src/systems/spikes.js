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
    const JUMPER_JUMP_COOLDOWN = 0.1;
    const JUMPER_WIDTH_SCALE = 1.06;
    const JUMPER_AIR_TILT_UP = -Math.PI / 3.8;
    const JUMPER_AIR_TILT_DOWN = Math.PI / 4.2;
    const SMOKE_INTERVAL = 0.075;
    const SMOKE_LIFE_MIN = 0.35;
    const SMOKE_LIFE_MAX = 0.7;
    const TRAIL_INTERVAL = 0.04;
    const TRAIL_LIFE_MIN = 0.4;
    const TRAIL_LIFE_MAX = 0.7;
    const JUMPER_BOAT_INDEX = 5;
    const SHATTER_GRAVITY = 2200;
    const SHATTER_BLAST_SPEED = 440;
    const SHATTER_SPIN_SPEED = 18;
    const SHATTER_TILE_SIZE = 6;
    const SHATTER_WIND_ACCEL = -420;
    const SHATTER_PADDING = 32;

    const boatSources = global.BrainSurfingConfig?.assets?.boats || [];
    const BOAT_CONFIGS = boatSources.map((src, index) => ({
        src,
        scale: index === JUMPER_BOAT_INDEX ? 0.25 : index === 6 ? 0.3 : 1,
        widthScale: index === JUMPER_BOAT_INDEX ? JUMPER_WIDTH_SCALE : 1,
        emitsSmoke: index <= 4,
        emitsTrail: index === JUMPER_BOAT_INDEX,
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
        const widthScale = cfg.widthScale ?? 1;
        return {
            drawW: naturalW * scale * widthScale,
            drawH: naturalH * scale,
        };
    }

    function spriteTileHasPixels(data, width, sx, sy, sw, sh) {
        for (let y = sy; y < sy + sh; y += 1) {
            for (let x = sx; x < sx + sw; x += 1) {
                if (data[(y * width + x) * 4 + 3] > 16) return true;
            }
        }
        return false;
    }

    function createBoatShatterPieces(spike, cfg, drawW, drawH) {
        const pivotX = spike.x;
        const pivotY = spike.y + drawH;
        const img = cfg?.img;
        const spriteSize = Math.ceil(Math.max(drawW, drawH) + SHATTER_PADDING * 2);
        const pieces = [];
        let spriteCanvas = null;
        let spriteData = null;

        if (img?.complete && img.naturalWidth > 0) {
            spriteCanvas = document.createElement("canvas");
            spriteCanvas.width = spriteSize;
            spriteCanvas.height = spriteSize;
            const spriteCtx = spriteCanvas.getContext("2d");

            if (spriteCtx) {
                spriteCtx.translate(spriteSize / 2, spriteSize / 2);
                spriteCtx.rotate(spike.angle || 0);
                spriteCtx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
                spriteData = spriteCtx.getImageData(0, 0, spriteSize, spriteSize);
            }
        }

        if (spriteData) {
            const { data, width, height } = spriteData;
            for (let sy = 0; sy < height; sy += SHATTER_TILE_SIZE) {
                for (let sx = 0; sx < width; sx += SHATTER_TILE_SIZE) {
                    const sw = Math.min(SHATTER_TILE_SIZE, width - sx);
                    const sh = Math.min(SHATTER_TILE_SIZE, height - sy);
                    if (!spriteTileHasPixels(data, width, sx, sy, sw, sh)) continue;

                    const offsetX = sx + sw / 2 - width / 2;
                    const offsetY = sy + sh / 2 - height / 2;
                    const distance = Math.hypot(offsetX, offsetY) || 1;
                    const blast = SHATTER_BLAST_SPEED * (0.55 + Math.random() * 0.9);
                    const windPush = 280 + Math.random() * 220;

                    pieces.push({
                        source: spriteCanvas,
                        sx,
                        sy,
                        sw,
                        sh,
                        x: pivotX + offsetX,
                        y: pivotY + offsetY,
                        vx: (offsetX / distance) * blast * 0.35 - windPush + (Math.random() - 0.5) * 60,
                        vy: (offsetY / distance) * blast * 0.22 - (180 + Math.random() * 280),
                        rotation: (Math.random() - 0.5) * 0.6,
                        vr: (Math.random() - 0.5) * SHATTER_SPIN_SPEED,
                    });
                }
            }
        }

        if (!pieces.length) {
            for (let i = 0; i < 48; i += 1) {
                const angle = (Math.PI * 2 * i) / 48 + (Math.random() - 0.5) * 0.12;
                const blast = SHATTER_BLAST_SPEED * (0.45 + Math.random() * 0.7);
                const windPush = 240 + Math.random() * 200;

                pieces.push({
                    source: null,
                    sx: 0,
                    sy: 0,
                    sw: 4 + Math.random() * 5,
                    sh: 4 + Math.random() * 5,
                    x: pivotX + (Math.random() - 0.5) * drawW * 0.7,
                    y: spike.y + drawH * 0.3 + (Math.random() - 0.5) * drawH * 0.5,
                    vx: Math.cos(angle) * blast * 0.35 - windPush,
                    vy: Math.sin(angle) * blast * 0.25 - (180 + Math.random() * 260),
                    rotation: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * SHATTER_SPIN_SPEED,
                });
            }
        }

        return pieces;
    }

    function getSpikeBounds(spike) {
        if (!spike || spike.y == null) return null;

        const cfg = BOAT_CONFIGS[spike.boatIndex];
        if (!cfg) return null;

        const { drawW, drawH } = getBoatDrawSize(cfg);
        return {
            left: spike.x - drawW / 2,
            right: spike.x + drawW / 2,
            top: spike.y,
            bottom: spike.y + drawH,
            drawW,
            drawH,
            cfg,
        };
    }

    function boundsOverlap(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    const SpikeSystem = {
        init({ onHit, jumpVelocity }) {
            this.onHit = typeof onHit === "function" ? onHit : null;
            this.jumpVelocity = typeof jumpVelocity === "number" ? jumpVelocity : -640;
            this.reset();
        },

        reset() {
            this.spikes = [];
            this.smoke = [];
            this.trails = [];
            this.shatterPieces = [];
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
                isJumper: boatIndex === JUMPER_BOAT_INDEX,
                jumpCooldown: 0,
                smokeTimer: Math.random() * SMOKE_INTERVAL,
                trailTimer: Math.random() * TRAIL_INTERVAL,
            });
        },

        spawnSmoke(spike, drawW, drawH) {
            const cfg = BOAT_CONFIGS[spike.boatIndex];
            if (!cfg?.emitsSmoke) return;

            const angle = spike.angle || 0;
            const exhaustX = (Math.random() - 0.5) * drawW * 0.28;
            const exhaustY = -drawH * (0.88 + Math.random() * 0.08);
            const worldX = spike.x + exhaustX * Math.cos(angle) - exhaustY * Math.sin(angle);
            const worldY = spike.y + drawH + exhaustX * Math.sin(angle) + exhaustY * Math.cos(angle);
            const life = SMOKE_LIFE_MIN + Math.random() * (SMOKE_LIFE_MAX - SMOKE_LIFE_MIN);

            this.smoke.push({
                x: worldX,
                y: worldY,
                vx: -(520 + Math.random() * 180),
                vy: -(120 + Math.random() * 80),
                size: 3 + Math.random() * 4,
                growth: 14 + Math.random() * 12,
                life,
                maxLife: life,
            });
        },

        spawnTrail(spike, drawW, drawH, speed) {
            const cfg = BOAT_CONFIGS[spike.boatIndex];
            if (!cfg?.emitsTrail || !spike.onGround) return;

            const angle = spike.angle || 0;
            const trailX = -drawW * 0.42;
            const trailY = -drawH * 0.06;
            const worldX = spike.x + trailX * Math.cos(angle) - trailY * Math.sin(angle);
            const worldY = spike.y + drawH + trailX * Math.sin(angle) + trailY * Math.cos(angle);

            this.trails.push({
                x: worldX + (Math.random() * 4 - 2),
                y: worldY + (Math.random() * 4 - 2),
                vx: -speed - (120 + Math.random() * 80),
                vy: -(40 + Math.random() * 40),
                life: TRAIL_LIFE_MIN + Math.random() * (TRAIL_LIFE_MAX - TRAIL_LIFE_MIN),
                size: 2 + Math.random() * 2,
            });
        },

        update(dt, terrainProfile, player, playerSize, canvasWidth, canvasHeight) {
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
                s.smokeTimer -= dt;
                while (cfg.emitsSmoke && s.smokeTimer <= 0) {
                    this.spawnSmoke(s, drawW, drawH);
                    s.smokeTimer += SMOKE_INTERVAL * (0.8 + Math.random() * 0.7);
                }
                s.trailTimer -= dt;

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

                while (cfg.emitsTrail && s.onGround && s.trailTimer <= 0) {
                    this.spawnTrail(s, drawW, drawH, speed);
                    s.trailTimer += TRAIL_INTERVAL * (0.9 + Math.random() * 0.5);
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

                    if (s.isJumper && !s.onGround) {
                        targetAngle += s.vy < 0 ? JUMPER_AIR_TILT_UP : JUMPER_AIR_TILT_DOWN;
                    }

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

            const shatteredSpikes = new Set();
            for (let i = 0; i < this.spikes.length; i += 1) {
                const a = this.spikes[i];
                const aBounds = getSpikeBounds(a);
                if (!aBounds) continue;

                for (let j = i + 1; j < this.spikes.length; j += 1) {
                    const b = this.spikes[j];
                    const bBounds = getSpikeBounds(b);
                    if (!bBounds || !boundsOverlap(aBounds, bBounds)) continue;

                    if (a.boatIndex === JUMPER_BOAT_INDEX && b !== a) {
                        shatteredSpikes.add(a);
                    }

                    if (b.boatIndex === JUMPER_BOAT_INDEX && a !== b) {
                        shatteredSpikes.add(b);
                    }
                }
            }

            if (shatteredSpikes.size) {
                for (let i = this.spikes.length - 1; i >= 0; i -= 1) {
                    const spike = this.spikes[i];
                    if (!shatteredSpikes.has(spike)) continue;

                    const bounds = getSpikeBounds(spike);
                    if (bounds) {
                        this.shatterPieces.push(
                            ...createBoatShatterPieces(spike, bounds.cfg, bounds.drawW, bounds.drawH)
                        );
                    }
                    this.spikes.splice(i, 1);
                }
            }

            this.smoke = this.smoke.filter((puff) => {
                puff.x += puff.vx * dt;
                puff.y += puff.vy * dt;
                puff.size += puff.growth * dt;
                puff.life -= dt;
                return puff.life > 0;
            });

            this.trails = this.trails.filter((particle) => {
                particle.x += particle.vx * dt;
                particle.y += particle.vy * dt;
                particle.vy += 250 * dt;
                particle.life -= dt;
                return particle.life > 0;
            });

            this.shatterPieces = (this.shatterPieces || []).filter((piece) => {
                piece.vx += SHATTER_WIND_ACCEL * dt;
                piece.vy += SHATTER_GRAVITY * dt;
                piece.x += piece.vx * dt;
                piece.y += piece.vy * dt;
                piece.rotation += piece.vr * dt;
                return piece.y - piece.sh < (canvasHeight || 0) + 400;
            });
        },

        draw(ctx, terrainProfile) {
            if (!terrainProfile?.length) return;

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            for (const puff of this.smoke || []) {
                const t = puff.life / puff.maxLife;
                ctx.globalAlpha = Math.max(0, t * 0.38);
                ctx.fillStyle = "#000";
                ctx.beginPath();
                ctx.arc(puff.x, puff.y, puff.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;

            for (const particle of this.trails || []) {
                ctx.fillStyle = "#000";
                ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
            }

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

            for (const piece of this.shatterPieces || []) {
                ctx.save();
                ctx.translate(piece.x, piece.y);
                ctx.rotate(piece.rotation);

                if (piece.source) {
                    ctx.drawImage(
                        piece.source,
                        piece.sx,
                        piece.sy,
                        piece.sw,
                        piece.sh,
                        -piece.sw / 2,
                        -piece.sh / 2,
                        piece.sw,
                        piece.sh
                    );
                } else {
                    ctx.fillStyle = "#000";
                    ctx.fillRect(-piece.sw / 2, -piece.sh / 2, piece.sw, piece.sh);
                }

                ctx.restore();
            }

            ctx.restore();
        },
    };

    global.SpikeSystem = SpikeSystem;
})(window);
