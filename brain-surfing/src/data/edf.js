(function (global) {
    function edfAscii(view, start, len) {
        let s = "";
        for (let i = 0; i < len; i += 1) {
            s += String.fromCharCode(view.getUint8(start + i));
        }
        return s;
    }

    function edfField(view, start, len) {
        return edfAscii(view, start, len).trim();
    }

    function edfNum(str) {
        const text = (str || "").trim().replace(",", ".");
        const value = Number(text);
        return Number.isFinite(value) ? value : NaN;
    }

    function mean(values) {
        let sum = 0;
        for (let i = 0; i < values.length; i += 1) {
            sum += values[i];
        }
        return values.length ? sum / values.length : 0;
    }

    function maxAbs(values) {
        let currentMax = 0;
        for (let i = 0; i < values.length; i += 1) {
            const amplitude = Math.abs(values[i]);
            if (amplitude > currentMax) currentMax = amplitude;
        }
        return currentMax;
    }

    function pickBestChannelIndex(labels, preferred) {
        if (!labels.length) return 0;

        const preferredLabels = preferred && preferred.length
            ? preferred
            : ["Fpz-Cz", "FpzCz", "Cz", "C3", "C4", "Pz", "Fz", "EEG", "eeg"];

        const normalize = (value) => (value || "").replace(/\s+/g, "").toLowerCase();

        let best = 0;
        let bestScore = -1;

        for (let i = 0; i < labels.length; i += 1) {
            const label = labels[i] || "";
            const normalizedLabel = normalize(label);
            let score = 0;

            for (let k = 0; k < preferredLabels.length; k += 1) {
                const normalizedPreference = normalize(preferredLabels[k]);
                if (normalizedPreference && normalizedLabel.includes(normalizedPreference)) {
                    score = Math.max(score, 100 - k);
                }
            }

            if (normalizedLabel.includes("eeg")) {
                score += 10;
            }

            if (score > bestScore) {
                bestScore = score;
                best = i;
            }
        }

        return best;
    }

    function resampleLinear(values, fromRate, toRate) {
        if (!values.length) return [];
        if (Math.abs(fromRate - toRate) < 1e-9) return values.slice();

        const durationSec = (values.length - 1) / fromRate;
        const outputLength = Math.max(1, Math.floor(durationSec * toRate) + 1);
        const output = new Array(outputLength);

        for (let i = 0; i < outputLength; i += 1) {
            const t = i / toRate;
            const position = t * fromRate;
            const leftIndex = Math.floor(position);
            const rightIndex = Math.min(values.length - 1, leftIndex + 1);
            const mix = position - leftIndex;
            const leftValue = values[leftIndex];
            const rightValue = values[rightIndex];

            output[i] = leftValue + (rightValue - leftValue) * mix;
        }

        return output;
    }

    function parseEdfClockToSec(clockStr) {
        const parts = (clockStr || "").trim().split(/[^0-9]+/).filter(Boolean);
        const hours = parseInt(parts[0] || "0", 10);
        const minutes = parseInt(parts[1] || "0", 10);
        const seconds = parseInt(parts[2] || "0", 10);
        return (hours * 3600) + (minutes * 60) + seconds;
    }

    function parseToJson(arrayBuffer, options) {
        const view = new DataView(arrayBuffer);
        const startTimeStr = edfField(view, 176, 8);
        const startTimeSec = parseEdfClockToSec(startTimeStr);
        const targetRate = typeof options?.targetRate === "number" ? options.targetRate : 50;
        const headerBytes = parseInt(edfField(view, 184, 8), 10);
        const rawRecords = edfField(view, 236, 8);
        const recordDuration = edfNum(edfField(view, 244, 8)) || 1;
        const signalCount = parseInt(edfField(view, 252, 4), 10);

        let recordCount = parseInt(rawRecords, 10);

        if (!Number.isFinite(headerBytes) || headerBytes < 256) {
            throw new Error("EDF parse error: bad headerBytes");
        }
        if (!Number.isFinite(signalCount) || signalCount <= 0) {
            throw new Error("EDF parse error: bad number of signals");
        }

        let offset = 256;
        const labels = [];
        for (let i = 0; i < signalCount; i += 1) {
            labels.push(edfField(view, offset + i * 16, 16));
        }
        offset += signalCount * 16;
        offset += signalCount * 80;

        const physicalDimensions = [];
        for (let i = 0; i < signalCount; i += 1) {
            physicalDimensions.push(edfField(view, offset + i * 8, 8));
        }
        offset += signalCount * 8;

        const physicalMin = [];
        for (let i = 0; i < signalCount; i += 1) {
            physicalMin.push(edfNum(edfField(view, offset + i * 8, 8)));
        }
        offset += signalCount * 8;

        const physicalMax = [];
        for (let i = 0; i < signalCount; i += 1) {
            physicalMax.push(edfNum(edfField(view, offset + i * 8, 8)));
        }
        offset += signalCount * 8;

        const digitalMin = [];
        for (let i = 0; i < signalCount; i += 1) {
            digitalMin.push(edfNum(edfField(view, offset + i * 8, 8)));
        }
        offset += signalCount * 8;

        const digitalMax = [];
        for (let i = 0; i < signalCount; i += 1) {
            digitalMax.push(edfNum(edfField(view, offset + i * 8, 8)));
        }
        offset += signalCount * 8;
        offset += signalCount * 80;

        const samplesPerRecord = [];
        for (let i = 0; i < signalCount; i += 1) {
            samplesPerRecord.push(parseInt(edfField(view, offset + i * 8, 8), 10));
        }
        offset += signalCount * 8;
        offset += signalCount * 32;

        const bytesPerRecord = samplesPerRecord.reduce((sum, count) => sum + count * 2, 0);
        if (!Number.isFinite(bytesPerRecord) || bytesPerRecord <= 0) {
            throw new Error("EDF parse error: bad bytesPerRecord");
        }

        const channelRecordByteOffsets = new Array(signalCount);
        let recordByteCursor = 0;
        for (let i = 0; i < signalCount; i += 1) {
            channelRecordByteOffsets[i] = recordByteCursor;
            recordByteCursor += samplesPerRecord[i] * 2;
        }

        if (!Number.isFinite(recordCount) || recordCount <= 0) {
            const inferredCount = Math.floor((arrayBuffer.byteLength - headerBytes) / bytesPerRecord);
            recordCount = Math.max(0, inferredCount);
        }

        let channelIndex = 0;
        if (
            typeof options?.channelIndex === "number" &&
            options.channelIndex >= 0 &&
            options.channelIndex < signalCount
        ) {
            channelIndex = options.channelIndex;
        } else {
            channelIndex = pickBestChannelIndex(labels, options?.preferredLabels);
        }

        const channelSamplesPerRecord = samplesPerRecord[channelIndex];
        if (!Number.isFinite(channelSamplesPerRecord) || channelSamplesPerRecord <= 0) {
            throw new Error("EDF parse error: bad samples/record for chosen channel");
        }

        const originalSampleRate = channelSamplesPerRecord / recordDuration;
        const channelPhysicalMin = physicalMin[channelIndex];
        const channelPhysicalMax = physicalMax[channelIndex];
        const channelDigitalMin = digitalMin[channelIndex];
        const channelDigitalMax = digitalMax[channelIndex];

        if (
            ![
                channelPhysicalMin,
                channelPhysicalMax,
                channelDigitalMin,
                channelDigitalMax,
            ].every(Number.isFinite) ||
            channelDigitalMax === channelDigitalMin
        ) {
            throw new Error("EDF parse error: bad scaling fields");
        }

        const scale = (channelPhysicalMax - channelPhysicalMin) / (channelDigitalMax - channelDigitalMin);
        const physicalValues = [];
        let pointer = headerBytes;

        for (let recordIndex = 0; recordIndex < recordCount; recordIndex += 1) {
            for (let signalIndex = 0; signalIndex < signalCount; signalIndex += 1) {
                const samples = samplesPerRecord[signalIndex];
                for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
                    if (pointer + 2 > arrayBuffer.byteLength) break;

                    const digitalValue = view.getInt16(pointer, true);
                    pointer += 2;

                    if (signalIndex === channelIndex) {
                        physicalValues.push(channelPhysicalMin + (digitalValue - channelDigitalMin) * scale);
                    }
                }
            }
        }

        if (!physicalValues.length) {
            throw new Error("EDF parse error: produced empty values array");
        }

        const resampledPhysicalValues = resampleLinear(physicalValues, originalSampleRate, targetRate);
        const visualValues = resampledPhysicalValues.slice();
        const centeredMean = mean(visualValues);

        for (let i = 0; i < visualValues.length; i += 1) {
            visualValues[i] -= centeredMean;
        }

        const visualScale = maxAbs(visualValues) || 1;
        for (let i = 0; i < visualValues.length; i += 1) {
            visualValues[i] /= visualScale;
        }

        return {
            sampleRate: targetRate,
            values: visualValues,
            visualValues,
            physicalValues: resampledPhysicalValues,
            amplitudeUnit: physicalDimensions[channelIndex] || "uV",
            channelIndex,
            channelLabel: labels[channelIndex],
            channelLabels: labels,
            startTimeSec,
            probeMeta: {
                headerBytes,
                numRecords: recordCount,
                bytesPerRecord,
                channelRecordByteOffset: channelRecordByteOffsets[channelIndex],
                channelSamplesPerRecord,
                originalSampleRate,
                originalSampleCount: physicalValues.length,
                physicalMin: channelPhysicalMin,
                digitalMin: channelDigitalMin,
                scale,
                amplitudeUnit: physicalDimensions[channelIndex] || "uV",
            },
        };
    }

    const BrainSurfingEdf = {
        parseToJson,
    };

    global.BrainSurfingEdf = BrainSurfingEdf;
    global.parseEdfToJson = parseToJson;
})(window);
