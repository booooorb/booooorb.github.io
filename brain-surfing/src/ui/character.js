(function (global) {
    function createBrainSurfingCharacter(options) {
        const {
            state,
            viewport,
            images,
            constants,
        } = options;

        function createPlayer() {
            state.player = {
                x: viewport.width / 2 - constants.playerSize / 2,
                y: state.groundY - constants.playerSize,
                vy: 0,
                onGround: false,
                angle: 0,
                airBaseAngle: 0,
            };
        }

        function drawCurrentPlayerSprite(targetCtx) {
            const canFlipDraw =
                images.flipBoard.complete &&
                images.flipPenguin.complete &&
                images.flipBoard.naturalWidth > 0 &&
                images.flipPenguin.naturalWidth > 0;
            const canGlideDraw = images.glidePenguin.complete && images.glidePenguin.naturalWidth > 0;

            if (state.glideActive && canGlideDraw) {
                targetCtx.drawImage(
                    images.glidePenguin,
                    -constants.playerSize / 2,
                    -constants.playerSize / 2 - 30,
                    constants.playerSize + 10,
                    constants.playerSize + 23
                );
                return;
            }

            if (state.flipAnimTimeLeft > 0 && canFlipDraw) {
                targetCtx.drawImage(
                    images.flipBoard,
                    -constants.playerSize / 2,
                    -constants.playerSize / 2,
                    constants.playerSize,
                    constants.playerSize
                );
                targetCtx.save();
                targetCtx.translate(0, -constants.playerSize * 0.35);
                targetCtx.rotate((1 - state.flipAnimTimeLeft / constants.flipDuration) * 4 * Math.PI);
                targetCtx.drawImage(
                    images.flipPenguin,
                    -constants.playerSize / 2,
                    -constants.playerSize / 2,
                    constants.playerSize,
                    constants.playerSize
                );
                targetCtx.restore();
                return;
            }

            if (images.player.complete && images.player.naturalWidth > 0) {
                targetCtx.drawImage(
                    images.player,
                    -constants.playerSize / 2,
                    -constants.playerSize / 2,
                    constants.playerSize,
                    constants.playerSize
                );
                return;
            }

            targetCtx.fillStyle = "#00000000";
            targetCtx.fillRect(
                -constants.playerSize / 2,
                -constants.playerSize / 2,
                constants.playerSize,
                constants.playerSize
            );
        }

        function draw(ctx) {
            const player = state.player;
            if (state.hidePlayer || state.isGameOver || state.shatterPieces.length || !player) return;

            const centerX = player.x + constants.playerSize / 2;
            const centerY = player.y + constants.playerSize / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(player.angle || 0);
            drawCurrentPlayerSprite(ctx);
            ctx.restore();
        }

        function captureSprite() {
            const spriteCanvas = document.createElement("canvas");
            spriteCanvas.width = constants.shatterSourceSize;
            spriteCanvas.height = constants.shatterSourceSize;
            const spriteCtx = spriteCanvas.getContext("2d");
            if (!spriteCtx) return null;

            spriteCtx.translate(constants.shatterSourceSize / 2, constants.shatterSourceSize / 2);
            spriteCtx.rotate(state.player?.angle || 0);
            drawCurrentPlayerSprite(spriteCtx);

            return spriteCanvas;
        }

        return {
            createPlayer,
            drawCurrentPlayerSprite,
            draw,
            captureSprite,
        };
    }

    global.createBrainSurfingCharacter = createBrainSurfingCharacter;
})(window);
