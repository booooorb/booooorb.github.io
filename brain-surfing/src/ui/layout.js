(function (global) {
    function createBrainSurfingLayout(options) {
        const {
            canvas,
            ctx,
            viewport,
            state,
            images,
            clamp,
            constants,
        } = options;

        function resizeBackground() {
            if (!images.background.height || !viewport.height) return;
            state.bgScale = viewport.height / images.background.height;
        }

        function rescaleRuntimeState(previousWidth, previousHeight) {
            if (!previousWidth || !previousHeight) return;

            const scaleX = viewport.width / previousWidth;
            const scaleY = viewport.height / previousHeight;
            if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return;

            if (state.player) {
                state.player.x *= scaleX;
                state.player.y *= scaleY;
            }

            if (state.waveProbeX !== null) {
                state.waveProbeX = clamp(state.waveProbeX * scaleX, 0, Math.max(0, viewport.width - 1));
            }

            state.particles.forEach((particle) => {
                particle.x *= scaleX;
                particle.y *= scaleY;
            });

            state.floatingTexts.forEach((text) => {
                text.x *= scaleX;
                text.y *= scaleY;
            });

            state.shatterPieces.forEach((piece) => {
                piece.x *= scaleX;
                piece.y *= scaleY;
            });

            state.terrainProfile = [];
        }

        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const nextWidth = Math.max(1, Math.round(rect.width || viewport.width || canvas.width));
            const nextHeight = Math.max(1, Math.round(rect.height || viewport.height || canvas.height));
            const previousWidth = viewport.width;
            const previousHeight = viewport.height;
            const deviceScale = clamp(window.devicePixelRatio || 1, 1, 2);

            viewport.width = nextWidth;
            viewport.height = nextHeight;

            canvas.width = Math.max(1, Math.round(nextWidth * deviceScale));
            canvas.height = Math.max(1, Math.round(nextHeight * deviceScale));
            ctx.setTransform(canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0);

            state.groundY = viewport.height - constants.groundMargin;
            resizeBackground();
            rescaleRuntimeState(previousWidth, previousHeight);
        }

        function setWaveProbeFromPointer(event) {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const x = ((event.clientX - rect.left) / rect.width) * viewport.width;
            const y = ((event.clientY - rect.top) / rect.height) * viewport.height;

            if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > viewport.width || y > viewport.height) {
                state.waveProbeX = null;
                return;
            }

            state.waveProbeX = clamp(x, 0, Math.max(0, viewport.width - 1));
        }

        return {
            resizeBackground,
            resizeCanvas,
            setWaveProbeFromPointer,
        };
    }

    global.createBrainSurfingLayout = createBrainSurfingLayout;
})(window);
