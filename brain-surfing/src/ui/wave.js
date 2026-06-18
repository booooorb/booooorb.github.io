(function (global) {
    function createBrainSurfingWave(options) {
        const {
            state,
            viewport,
            images,
            clamp,
            constants,
        } = options;
        const retractionRuntime = {
            frameWidth: 132,
            frameHeight: 44,
            frameCount: 46,
            width: 46,
            duration: 1.6,
            speed: -800,
            opacity: 0.3,
            laneFractions: [0.18, 0.34, 0.5, 0.66, 0.82],
            laneCursor: 0,
            lastTime: null,
            nextSpawnAt: 0,
            initialized: false,
            viewportWidth: null,
            viewportHeight: null,
        };

        function loopedSample(values, index) {
            if (!Array.isArray(values) || !values.length || !Number.isFinite(index)) {
                return null;
            }

            let wrappedIndex = index % values.length;
            if (wrappedIndex < 0) wrappedIndex += values.length;
            const value = values[wrappedIndex];
            return Number.isFinite(value) ? value : null;
        }

        function hasOriginalEdfProbe() {
            return Boolean(state.lastUploadedEdfBuffer && state.eegProbeMeta);
        }

        function sampleIndexForCanvasX(x) {
            const width = Math.max(viewport.width, 1);
            const sampleRate = state.eegSampleRate || 50;
            const clampedX = clamp(Math.round(x), 0, width - 1);
            const headSample = Number.isFinite(state.currentHeadSample)
                ? state.currentHeadSample
                : Math.floor(state.lastEffectiveTime * sampleRate);
            return Math.round(headSample - (width - 1 - clampedX) * constants.horizontalSampleStep);
        }

        function readOriginalEdfPhysicalSampleAtTime(timeSec) {
            if (!hasOriginalEdfProbe()) return null;

            const meta = state.eegProbeMeta;
            const totalSamples = meta.originalSampleCount || (meta.channelSamplesPerRecord * meta.numRecords);
            if (!Number.isFinite(totalSamples) || totalSamples <= 0) return null;

            let sampleIndex = Math.round(timeSec * meta.originalSampleRate);
            sampleIndex %= totalSamples;
            if (sampleIndex < 0) sampleIndex += totalSamples;

            const recordIndex = Math.floor(sampleIndex / meta.channelSamplesPerRecord);
            const sampleInRecord = sampleIndex % meta.channelSamplesPerRecord;
            const byteOffset = meta.headerBytes +
                (recordIndex * meta.bytesPerRecord) +
                meta.channelRecordByteOffset +
                (sampleInRecord * 2);

            if (byteOffset < 0 || byteOffset + 2 > state.lastUploadedEdfBuffer.byteLength) {
                return null;
            }

            const view = new DataView(state.lastUploadedEdfBuffer);
            const digitalValue = view.getInt16(byteOffset, true);
            const physicalValue = meta.physicalMin + (digitalValue - meta.digitalMin) * meta.scale;
            return Number.isFinite(physicalValue) ? physicalValue : null;
        }

        function formatProbeLabel(sampleIndex) {
            const originalPhysicalValue = readOriginalEdfPhysicalSampleAtTime(sampleIndex / (state.eegSampleRate || 50));
            if (originalPhysicalValue !== null) {
                const unit = state.eegProbeMeta?.amplitudeUnit || state.eegPhysicalUnit || "uV";
                return `Original EDF magnitude: ${Math.abs(originalPhysicalValue).toFixed(1)} ${unit}`;
            }

            const physicalValue = loopedSample(state.eegPhysicalValues, sampleIndex);
            if (physicalValue !== null) {
                const unit = state.eegPhysicalUnit || "raw";
                return `Resampled magnitude: ${Math.abs(physicalValue).toFixed(1)} ${unit}`;
            }

            return "EDF magnitude unavailable";
        }

        function drawBackground(ctx) {
            if (!images.background.width || !state.terrainProfile.length) return;

            const width = viewport.width;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(width, 0);
            for (let x = width - 1; x >= 0; x -= 1) {
                ctx.lineTo(x + 0.5, state.terrainProfile[x] + 0.5);
            }
            ctx.closePath();
            ctx.clip();
            ctx.globalAlpha = 0.35;

            const imageWidth = images.background.width * state.bgScale;
            const imageHeight = images.background.height * state.bgScale;
            let startX = -state.bgScrollX;
            while (startX > 0) startX -= imageWidth;

            for (let x = startX; x < width; x += imageWidth) {
                ctx.drawImage(images.background, x, 0, imageWidth, imageHeight);
            }

            ctx.restore();
        }

        function traceWaveRidge(ctx, yOffset) {
            const offset = Number.isFinite(yOffset) ? yOffset : 0;

            for (let x = 0; x < viewport.width; x += 1) {
                const y = state.terrainProfile[x] + offset;
                if (x === 0) ctx.moveTo(x + 0.5, y + 0.5);
                else ctx.lineTo(x + 0.5, y + 0.5);
            }
        }

        function traceWaveBody(ctx, yOffset) {
            ctx.beginPath();
            traceWaveRidge(ctx, yOffset);
            ctx.lineTo(viewport.width - 0.5, state.groundY + 0.5);
            ctx.lineTo(0.5, state.groundY + 0.5);
            ctx.closePath();
        }

        function drawWaveTexture(ctx) {
            const time = state.eegTime || 0;
            const bandCount = 3;

            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            for (let band = 0; band < bandCount; band += 1) {
                const depth = 14 + band * 24;
                const amplitude = 2.3 + band * 0.55;
                const frequency = 0.0105 + band * 0.0012;
                const speed = 0.26 + band * 0.05;
                const alpha = Math.max(0.03, 0.09 - band * 0.018);
                const phase = time * speed + band * 1.1;

                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = `rgba(68, 39, 39, ${alpha})`;

                for (let x = 0; x < viewport.width; x += 16) {
                    const terrainY = state.terrainProfile[x];
                    const ripple = Math.sin(x * frequency + phase) * amplitude;
                    const drift = Math.cos(x * 0.005 + phase * 0.7) * 1.5;
                    const y = Math.min(state.groundY - 4, terrainY + depth + ripple + drift);

                    if (x === 0) ctx.moveTo(x + 0.5, y + 0.5);
                    else ctx.lineTo(x + 0.5, y + 0.5);
                }

                ctx.stroke();
            }

            ctx.strokeStyle = "rgba(68, 39, 39, 0.08)";
            ctx.lineWidth = 1;
            for (let x = 12; x < viewport.width; x += 34) {
                const terrainY = state.terrainProfile[x];
                const startY = Math.min(state.groundY - 10, terrainY + 8 + Math.sin(time * 0.35 + x * 0.01) * 2);
                const endY = Math.min(state.groundY - 6, startY + 10);

                ctx.beginPath();
                ctx.moveTo(x + 0.5, startY + 0.5);
                ctx.lineTo(x + 5.5, endY + 0.5);
                ctx.stroke();
            }

            ctx.restore();
        }

        function randomRange(min, max) {
            return min + Math.random() * (max - min);
        }

        function terrainYAt(x) {
            if (!state.terrainProfile.length) return null;
            const sampleX = clamp(Math.round(x), 0, Math.max(0, viewport.width - 1));
            const y = state.terrainProfile[sampleX];
            return Number.isFinite(y) ? y : null;
        }

        function maxWaveRetractions() {
            return Math.max(22, Math.min(42, Math.floor(viewport.width / 30)));
        }

        function isFarEnoughFromOtherRetractions(candidate, items) {
            const minX = retractionRuntime.width * 3.75;
            const minY = candidate.height * 3.7;

            return items.every((item) => {
                const dx = candidate.x + candidate.width * 0.5 - (item.x + item.width * 0.5);
                const dy = candidate.y - item.y;
                return Math.hypot(dx / minX, dy / minY) >= 1;
            });
        }

        function makeWaveRetraction(now, options, existingItems) {
            const spawnOptions = options || {};
            const width = retractionRuntime.width;
            const height = width * (retractionRuntime.frameHeight / retractionRuntime.frameWidth);
            const items = existingItems || [];

            for (let attempt = 0; attempt < 28; attempt += 1) {
                const x = spawnOptions.anywhere
                    ? randomRange(-width * 0.1, viewport.width - width * 0.9)
                    : randomRange(viewport.width + width * 0.25, viewport.width + width * 2.6);
                const terrainY = terrainYAt(x + width * 0.5);
                if (terrainY === null) continue;

                const upperY = terrainY + height * 1.25;
                const lowerY = state.groundY - height * 0.7;
                if (lowerY <= upperY) continue;

                const laneIndex = (retractionRuntime.laneCursor + attempt) % retractionRuntime.laneFractions.length;
                const laneFraction = retractionRuntime.laneFractions[laneIndex];
                const laneJitter = randomRange(-height * 0.75, height * 0.75);
                const candidate = {
                    x,
                    y: clamp(upperY + (lowerY - upperY) * laneFraction + laneJitter, upperY, lowerY),
                    width,
                    height,
                    bornAt: now - (spawnOptions.age || 0),
                    lifespan: retractionRuntime.duration,
                    speed: retractionRuntime.speed,
                    opacity: retractionRuntime.opacity,
                };

                if (isFarEnoughFromOtherRetractions(candidate, items)) {
                    retractionRuntime.laneCursor = (laneIndex + 1) % retractionRuntime.laneFractions.length;
                    return candidate;
                }
            }

            return null;
        }

        function seedWaveRetractions(now) {
            if (
                retractionRuntime.initialized &&
                retractionRuntime.viewportWidth === viewport.width &&
                retractionRuntime.viewportHeight === viewport.height
            ) {
                return;
            }

            state.waveRetractions = [];
            retractionRuntime.viewportWidth = viewport.width;
            retractionRuntime.viewportHeight = viewport.height;

            const initialCount = Math.max(8, Math.floor(maxWaveRetractions() * 0.85));
            for (let i = 0; i < initialCount; i += 1) {
                const item = makeWaveRetraction(now, {
                    anywhere: true,
                    age: randomRange(0, retractionRuntime.duration),
                }, state.waveRetractions);
                if (item) state.waveRetractions.push(item);
            }

            retractionRuntime.nextSpawnAt = now + randomRange(0.03, 0.08);
            retractionRuntime.initialized = true;
        }

        function updateWaveRetractions(now) {
            seedWaveRetractions(now);

            const items = state.waveRetractions || (state.waveRetractions = []);
            const lastTime = retractionRuntime.lastTime === null ? now : retractionRuntime.lastTime;
            const dt = clamp(now - lastTime, 0, 0.12);
            retractionRuntime.lastTime = now;

            for (let i = items.length - 1; i >= 0; i -= 1) {
                const item = items[i];
                item.x += item.speed * dt;

                const age = now - item.bornAt;
                if (age >= item.lifespan || item.x + item.width < -item.width * 0.6) {
                    items.splice(i, 1);
                }
            }

            const maxCount = maxWaveRetractions();
            while (items.length < maxCount && now >= retractionRuntime.nextSpawnAt) {
                const item = makeWaveRetraction(now, { anywhere: Math.random() < 0.55 }, items);
                if (item) items.push(item);
                retractionRuntime.nextSpawnAt = now + randomRange(0.04, 0.12);
            }
        }

        function drawWaveRetractions(ctx) {
            const image = images.waveRetractionSprite;
            if (!image?.width || !image.height || !state.terrainProfile.length) return;

            const now = performance.now() / 1000;
            updateWaveRetractions(now);
            ctx.save();

            for (const item of state.waveRetractions) {
                const centerX = item.x + item.width * 0.5;
                const terrainY = terrainYAt(centerX);
                if (terrainY === null) continue;

                const age = now - item.bornAt;
                const surfaceFade = clamp((item.y - terrainY - 6) / 32, 0, 1);
                if (surfaceFade <= 0) continue;

                const progress = clamp(age / retractionRuntime.duration, 0, 1);
                const fadeIn = clamp(age / 0.18, 0, 1);
                const fadeOut = clamp((item.lifespan - age) / 0.26, 0, 1);
                const frame = Math.min(
                    retractionRuntime.frameCount - 1,
                    Math.floor(progress * retractionRuntime.frameCount)
                );

                ctx.globalAlpha = item.opacity * fadeIn * fadeOut * surfaceFade;
                ctx.drawImage(
                    image,
                    frame * retractionRuntime.frameWidth,
                    0,
                    retractionRuntime.frameWidth,
                    retractionRuntime.frameHeight,
                    item.x,
                    item.y - item.height * 0.5,
                    item.width,
                    item.height
                );
            }

            ctx.restore();
        }

        function drawWave(ctx) {
            if (state.terrainProfile.length !== viewport.width) return;

            ctx.save();
            traceWaveBody(ctx);
            ctx.clip();
            drawWaveTexture(ctx);
            drawWaveRetractions(ctx);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            traceWaveRidge(ctx, 8);
            ctx.lineTo(viewport.width - 0.5, state.groundY + 0.5);
            ctx.lineTo(0.5, state.groundY + 0.5);
            ctx.closePath();
            ctx.fillStyle = "rgba(68, 39, 39, 0.06)";
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            traceWaveRidge(ctx, 0);
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.strokeStyle = "#000";
            ctx.stroke();
            ctx.restore();
        }

        function drawWaveProbe(ctx) {
            if (state.waveProbeX === null || state.terrainProfile.length !== viewport.width) return;

            const x = clamp(Math.round(state.waveProbeX), 0, Math.max(0, viewport.width - 1));
            const y = state.terrainProfile[x];
            if (!Number.isFinite(y)) return;

            const sampleIndex = sampleIndexForCanvasX(x);
            const label = formatProbeLabel(sampleIndex);
            const labelPaddingX = 10;
            const labelHeight = 28;

            ctx.save();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
            ctx.beginPath();
            ctx.moveTo(x + 0.5, constants.topMargin);
            ctx.lineTo(x + 0.5, state.groundY);
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + 0.5, y + 0.5, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.font = "bold 14px 'Courier New', monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            const textWidth = ctx.measureText(label).width;
            const boxWidth = textWidth + labelPaddingX * 2;
            let boxX = x + 16;
            if (boxX + boxWidth > viewport.width - 8) boxX = viewport.width - boxWidth - 8;
            if (boxX < 8) boxX = 8;

            let boxY = y - 42;
            if (boxY < 8) boxY = Math.min(y + 16, viewport.height - labelHeight - 8);

            ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
            ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(boxX, boxY, boxWidth, labelHeight);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#000";
            ctx.fillText(label, boxX + labelPaddingX, boxY + labelHeight / 2 + 0.5);
            ctx.restore();
        }

        return {
            drawBackground,
            drawWave,
            drawWaveProbe,
        };
    }

    global.createBrainSurfingWave = createBrainSurfingWave;
})(window);
