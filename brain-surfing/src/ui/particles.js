(function (global) {
    function createBrainSurfingParticles(options) {
        const {
            state,
            viewport,
            constants,
        } = options;

        function spriteTileHasPixels(data, width, sx, sy, sw, sh) {
            for (let y = sy; y < sy + sh; y += 1) {
                for (let x = sx; x < sx + sw; x += 1) {
                    if (data[(y * width + x) * 4 + 3] > 16) return true;
                }
            }
            return false;
        }

        function spawnFloatingText(text, color, radius) {
            const player = state.player;
            if (!player) return;

            const effectiveRadius = Number.isFinite(radius) ? radius : 0;
            const angle = Math.random() * Math.PI * 2;
            const distance = effectiveRadius * Math.random();

            state.floatingTexts.push({
                x: player.x + constants.playerSize / 2 + Math.cos(angle) * distance,
                y: player.y + constants.playerSize * 0.15 + Math.sin(angle) * distance,
                vy: -60,
                life: constants.floatTextLifetime,
                maxLife: constants.floatTextLifetime,
                text,
                color,
            });
        }

        function createShatterPiecesFromSprite(spriteCanvas, centerX, centerY, fallbackCount, sizeScale) {
            const spriteCtx = spriteCanvas?.getContext("2d");
            const spriteData = spriteCtx?.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
            const pieces = [];

            if (spriteData) {
                const { data, width, height } = spriteData;
                for (let sy = 0; sy < height; sy += constants.shatterTileSize) {
                    for (let sx = 0; sx < width; sx += constants.shatterTileSize) {
                        const sw = Math.min(constants.shatterTileSize, width - sx);
                        const sh = Math.min(constants.shatterTileSize, height - sy);
                        if (!spriteTileHasPixels(data, width, sx, sy, sw, sh)) continue;

                        const offsetX = sx + sw / 2 - width / 2;
                        const offsetY = sy + sh / 2 - height / 2;
                        const distance = Math.hypot(offsetX, offsetY) || 1;
                        const blast = constants.shatterBlastSpeed * (0.55 + Math.random() * 0.9);
                        const windPush = 280 + Math.random() * 220;

                        pieces.push({
                            source: spriteCanvas,
                            sx,
                            sy,
                            sw,
                            sh,
                            x: centerX + offsetX,
                            y: centerY + offsetY,
                            vx: (offsetX / distance) * blast * 0.35 - windPush + (Math.random() - 0.5) * 60,
                            vy: (offsetY / distance) * blast * 0.22 - (180 + Math.random() * 280),
                            rotation: (Math.random() - 0.5) * 0.6,
                            vr: (Math.random() - 0.5) * constants.shatterSpinSpeed,
                        });
                    }
                }
            }

            if (!pieces.length) {
                const count = fallbackCount || 72;
                const scale = sizeScale || constants.playerSize;
                for (let i = 0; i < count; i += 1) {
                    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.1;
                    const blast = constants.shatterBlastSpeed * (0.5 + Math.random() * 0.8);
                    const windPush = 280 + Math.random() * 220;

                    pieces.push({
                        source: null,
                        sx: 0,
                        sy: 0,
                        sw: 6 + Math.random() * 6,
                        sh: 6 + Math.random() * 6,
                        x: centerX + (Math.random() - 0.5) * scale * 0.7,
                        y: centerY + (Math.random() - 0.5) * scale * 0.7,
                        vx: Math.cos(angle) * blast * 0.35 - windPush,
                        vy: Math.sin(angle) * blast * 0.25 - (180 + Math.random() * 260),
                        rotation: Math.random() * Math.PI * 2,
                        vr: (Math.random() - 0.5) * constants.shatterSpinSpeed,
                    });
                }
            }

            return pieces;
        }

        function update(dt, emitTrail) {
            const shouldEmitTrail = emitTrail !== false;
            const player = state.player;

            if (shouldEmitTrail && player?.onGround && !state.shatterPieces.length) {
                for (let i = 0; i < 5; i += 1) {
                    state.particles.push({
                        x: player.x + constants.playerSize * 0.25 + (Math.random() * 4 - 2),
                        y: player.y + constants.playerSize - 2 + (Math.random() * 4 - 2),
                        vx: -(120 + Math.random() * 80),
                        vy: -(40 + Math.random() * 40),
                        life: 0.4 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2,
                    });
                }
            }

            state.particles = state.particles.filter((particle) => {
                particle.x += particle.vx * dt;
                particle.y += particle.vy * dt;
                particle.vy += 250 * dt;
                particle.life -= dt;
                return particle.life > 0;
            });

            state.floatingTexts = state.floatingTexts.filter((text) => {
                text.life -= dt;
                text.y += text.vy * dt;
                return text.life > 0;
            });
        }

        function updateShatterPieces(dt) {
            state.gameOverTimer += dt;
            state.gameOverFade = Math.max(
                0,
                Math.min(1, (state.gameOverTimer - constants.gameOverFadeDelay) / constants.gameOverFadeDuration)
            );

            state.shatterPieces = state.shatterPieces.filter((piece) => {
                piece.vx += constants.shatterWindAccel * dt;
                piece.vy += constants.shatterGravity * dt;
                piece.x += piece.vx * dt;
                piece.y += piece.vy * dt;
                piece.rotation += piece.vr * dt;
                return piece.y - piece.sh < viewport.height + 180;
            });
        }

        function draw(ctx) {
            ctx.save();
            state.shatterPieces.forEach((piece) => {
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
            });
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#000";
            state.particles.forEach((particle) => {
                ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
            });
            ctx.restore();

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "20px Liberation Mono, Courier, system-ui, sans-serif";
            state.floatingTexts.forEach((text) => {
                ctx.globalAlpha = Math.max(text.life / text.maxLife, 0);
                ctx.fillStyle = text.color === "red" ? "#a10000" : "#000";
                ctx.fillText(text.text, text.x, text.y);
            });
            ctx.restore();
        }

        return {
            spawnFloatingText,
            createShatterPiecesFromSprite,
            update,
            updateShatterPieces,
            draw,
        };
    }

    global.createBrainSurfingParticles = createBrainSurfingParticles;
})(window);
