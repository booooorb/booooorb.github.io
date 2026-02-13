// spikes.js
(function (global) {
    const SPIKE_SPEED = 340;              // normal boat speed (px/s)
    const FAST_SPIKE_SPEED = 900;         // giga fast speed for boat7 (px/s)

    const SPIKE_INTERVAL_START = 4.0;     // seconds between boats at t=0
    const SPIKE_INTERVAL_MIN = 1.0;       // minimum interval
    const SPIKE_RAMP_DURATION = 80;      // seconds to ramp difficulty

    const BOAT_GRAVITY = 1600;           // fall speed for boats
    const BOAT_LAUNCH_MIN_RISE = 2.5;    // wave "kick" needed to hop
    const BOAT_JUMP_SCALE = 0.75;        // fraction of player jump speed
    const BOAT_BASE_SCALE = 0.25;        // global scale for boat sprites
    const BOAT_HOVER_OFFSET = 6;         // pixels above the wave so they don't hug it
    const EDGE_DETACH_THRESHOLD = 4;     // smaller = detach on gentler downward edges
    const REATTACH_MARGIN = 12;          // how much the wave must rise under them to reattach

    const BOAT_ROTATION_BLEND = 0.2;          // how quickly boats rotate toward target (smaller = smoother)
    const BOAT_MAX_ANGLE = Math.PI / 8;       // max tilt ~22.5°
    const BOAT_MAX_ANGLE_STEP = Math.PI / 90; // max change per frame ~2°
    const JUMPER_JUMP_COOLDOWN = 0;          // seconds between jumps for the special boat

    const BOAT_CONFIGS = [
        { src: "boat1.png", scale: 1 },
        { src: "boat2.png", scale: 1 },
        { src: "boat3.png", scale: 1 },
        { src: "boat4.png", scale: 1 },
        { src: "boat5.png", scale: 1 },
        { src: "boat6.png", scale: 0.25 },
        { src: "boat7.png", scale: 0.3 },  
    ];

    // Load images
    for (const cfg of BOAT_CONFIGS) {
        const img = new Image();
        img.src = cfg.src;
        cfg.img = img;
    }

    function getBoatDrawSize(cfg) {
        const img = cfg.img;
        const naturalW = (img && img.naturalWidth) ? img.naturalWidth : 32;
        const naturalH = (img && img.naturalHeight) ? img.naturalHeight : 32;

        const base = BOAT_BASE_SCALE;
        const perBoat = (cfg.scale != null ? cfg.scale : 1.0);
        const s = base * perBoat;

        const drawW = naturalW * s;
        const drawH = naturalH * s;
        return { drawW, drawH };
    }

    const SpikeSystem = {
        init({ onHit, jumpVelocity }) {
            this.onHit = (typeof onHit === "function") ? onHit : null;
            this.jumpVelocity = (typeof jumpVelocity === "number") ? jumpVelocity : -640;

            this.spikes = [];
            this.spikeTimer = SPIKE_INTERVAL_START;
            this.time = 0;
        },

        reset() {
            this.spikes = [];
            this.spikeTimer = SPIKE_INTERVAL_START;
            this.time = 0;
        },

        spawnSpike(canvasWidth) {
            if (!canvasWidth) return;

            const boatIndex = Math.floor(Math.random() * BOAT_CONFIGS.length);
            const cfg = BOAT_CONFIGS[boatIndex];
            const { drawW } = getBoatDrawSize(cfg);

            const spawnX = canvasWidth + drawW;

            const isJumper = (boatIndex === 5); // boat6 is the jumper

            this.spikes.push({
                x: spawnX,
                y: null,         // set when first touching wave
                vy: 0,
                onGround: false,
                lastGroundY: null,
                boatIndex,
                angle: 0,
                isJumper,
                jumpCooldown: 0,
            });
        },

        update(dt, terrainProfile, player, playerSize, canvasWidth) {
            if (!terrainProfile || terrainProfile.length === 0 || !player) return;

            this.time += dt;
            this.spikeTimer -= dt;
            while (this.spikeTimer <= 0) {
                this.spawnSpike(canvasWidth);

                const t = Math.min(this.time, SPIKE_RAMP_DURATION);
                const alpha = SPIKE_RAMP_DURATION > 0 ? t / SPIKE_RAMP_DURATION : 1;

                const baseInterval =
                    SPIKE_INTERVAL_START -
                    (SPIKE_INTERVAL_START - SPIKE_INTERVAL_MIN) * alpha;

                // Wide jitter: 0.2–3.0 × base
                const jitterFactor = 0.2 + Math.random() * 2.8;
                let interval = baseInterval * jitterFactor;
                if (interval < SPIKE_INTERVAL_MIN) interval = SPIKE_INTERVAL_MIN;

                this.spikeTimer += interval;
            }

            const BOAT_ROTATION_BLEND = 0.35;

            // bottom of penguin for collision
            const sampleY = player.y + playerSize * 0.9;
            const samplePoints = [
                { x: player.x + playerSize * 0.25, y: sampleY },
                { x: player.x + playerSize * 0.50, y: sampleY },
                { x: player.x + playerSize * 0.75, y: sampleY },
            ];

            // Boat physics and collision
            for (let i = this.spikes.length - 1; i >= 0; i--) {
                const s = this.spikes[i];
                if (s.jumpCooldown > 0) {
                    s.jumpCooldown -= dt;
                    if (s.jumpCooldown < 0) s.jumpCooldown = 0;
                }

                const cfg = BOAT_CONFIGS[s.boatIndex];
                if (!cfg) continue;

                let speed = SPIKE_SPEED;
                if (cfg.src === "boat7.png") {
                    speed = FAST_SPIKE_SPEED;
                }

                // Move left
                s.x -= speed * dt;

                // Cull off-screen
                if (s.x < -200) {
                    this.spikes.splice(i, 1);
                    continue;
                }

                const idx = Math.max(
                    0,
                    Math.min(terrainProfile.length - 1, Math.round(s.x))
                );
                const baseY = terrainProfile[idx];
                if (baseY == null) continue;

                const { drawW, drawH } = getBoatDrawSize(cfg);

                // First contact with wave
                if (s.y == null) {
                    s.y = baseY - drawH;
                    s.vy = 0;
                    s.onGround = true;
                    s.lastGroundY = baseY;
                }

                const prevBase = (typeof s.lastGroundY === "number") ? s.lastGroundY : baseY;
                const deltaBase = baseY - prevBase;   // > 0 = wave moved down (drop)
                const riseUp = prevBase - baseY;      // > 0 = wave moved up (ramp)

                if (s.onGround) {
                    // Jumper (boat6) behaviour
                    if (s.isJumper && s.jumpCooldown === 0 && riseUp > BOAT_LAUNCH_MIN_RISE) {
                        s.onGround = false;
                        s.vy = this.jumpVelocity * BOAT_JUMP_SCALE;
                        s.jumpCooldown = JUMPER_JUMP_COOLDOWN;  // start cooldown

                    } else if (deltaBase > EDGE_DETACH_THRESHOLD) {
                        s.onGround = false;
                    } else {
                        s.y = baseY - drawH - BOAT_HOVER_OFFSET;
                        s.vy = 0;
                    }
                }

                if (!s.onGround) {
                    // Apply gravity and fall
                    s.vy += BOAT_GRAVITY * dt;
                    s.y += s.vy * dt;

                    const boatBottom = s.y + drawH;
                    const landLine = baseY - BOAT_HOVER_OFFSET;

                    // Land on the wave again if we come down onto it
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

                    // Clamp to a limited tilt range
                    if (targetAngle > BOAT_MAX_ANGLE) targetAngle = BOAT_MAX_ANGLE;
                    if (targetAngle < -BOAT_MAX_ANGLE) targetAngle = -BOAT_MAX_ANGLE;

                    if (!Number.isFinite(s.angle)) {
                        s.angle = targetAngle;
                    } else {
                        let diff = targetAngle - s.angle;
                        if (diff > Math.PI) diff -= 2 * Math.PI;
                        if (diff < -Math.PI) diff += 2 * Math.PI;

                        const maxStep = BOAT_MAX_ANGLE_STEP;
                        if (diff > maxStep) diff = maxStep;
                        if (diff < -maxStep) diff = -maxStep;

                        s.angle += diff * BOAT_ROTATION_BLEND;
                    }
                }

                const left = s.x - drawW / 2;
                const right = s.x + drawW / 2;
                const top = s.y;
                const bottom = s.y + drawH;

                const hitLeft = left + drawW * 0.10;
                const hitRight = right - drawW * 0.10;
                const hitTop = top + drawH * 0.15;
                const hitBottom = bottom;

                for (const p of samplePoints) {
                    if (
                        p.x >= hitLeft &&
                        p.x <= hitRight &&
                        p.y >= hitTop &&
                        p.y <= hitBottom
                    ) {
                        if (this.onHit) this.onHit();
                        return; 
                    }
                }
            }
        },

        draw(ctx, terrainProfile) {
            if (!terrainProfile || terrainProfile.length === 0) return;
            if (!this.spikes || !this.spikes.length) return;

            ctx.save();
            ctx.imageSmoothingEnabled = false; 
            ctx.globalAlpha = 1;            // semi-transparent

            for (const s of this.spikes) {
                const cfg = BOAT_CONFIGS[s.boatIndex];
                const img = cfg && cfg.img;
                if (!cfg || !img || s.y == null) continue;

                const { drawW, drawH } = getBoatDrawSize(cfg);
                const angle = s.angle || 0;

                const pivotX = s.x;
                const pivotY = s.y + drawH;

                ctx.save();
                ctx.translate(pivotX, pivotY);
                ctx.rotate(angle);

                const left = -drawW / 2;
                const top = -drawH; // bottom at y=0

                if (img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, left, top, drawW, drawH);
                } else {
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(left, top, drawW, drawH);
                }

                ctx.restore();
            }

            ctx.restore();
        },
    };

    global.SpikeSystem = SpikeSystem;
})(window);
