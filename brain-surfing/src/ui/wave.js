(function (global) {
    function createBrainSurfingWave(options) {
        const {
            state,
            viewport,
            images,
            clamp,
            constants,
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

        function drawWave(ctx) {
            if (state.terrainProfile.length !== viewport.width) return;

            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            for (let x = 0; x < viewport.width; x += 1) {
                if (x === 0) ctx.moveTo(x + 0.5, state.terrainProfile[x] + 0.5);
                else ctx.lineTo(x + 0.5, state.terrainProfile[x] + 0.5);
            }

            ctx.strokeStyle = "#000";
            ctx.stroke();
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
