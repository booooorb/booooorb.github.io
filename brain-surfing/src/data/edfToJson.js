// In-browser EDF (classic EDF with 16-bit little-endian samples) -> JSON shape used by the game:
//   {
//     sampleRate: number,
//     values: number[],        // normalized gameplay copy
//     physicalValues: number[],// resampled raw EDF values in the channel's physical unit
//     probeMeta: object,       // metadata for reading the original EDF sample stream
//     channelLabel?: string
//   }

(() => {
    function _edfAscii(view, start, len) {
        let s = "";
        for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(start + i));
        return s;
    }

    function _edfField(view, start, len) {
        return _edfAscii(view, start, len).trim();
    }

    function _edfNum(str) {
        const t = (str || "").trim().replace(",", ".");
        const n = Number(t);
        return Number.isFinite(n) ? n : NaN;
    }

    function _pickBestChannelIndex(labels, preferred) {
        if (!labels.length) return 0;

        const pref = preferred && preferred.length ? preferred : [
            "Fpz-Cz", "FpzCz",
            "Cz", "C3", "C4", "Pz", "Fz",
            "EEG", "eeg"
        ];

        const norm = (x) => (x || "").replace(/\s+/g, "").toLowerCase();

        let best = 0;
        let bestScore = -1;

        for (let i = 0; i < labels.length; i++) {
            const lab = labels[i] || "";
            const nlab = norm(lab);

            let score = 0;
            for (let k = 0; k < pref.length; k++) {
                const np = norm(pref[k]);
                if (np && nlab.includes(np)) score = Math.max(score, 100 - k);
            }
            if (nlab.includes("eeg")) score += 10;

            if (score > bestScore) {
                bestScore = score;
                best = i;
            }
        }
        return best;
    }

    function _mean(arr) {
        let s = 0;
        for (let i = 0; i < arr.length; i++) s += arr[i];
        return arr.length ? s / arr.length : 0;
    }

    function _maxAbs(arr) {
        let m = 0;
        for (let i = 0; i < arr.length; i++) {
            const a = Math.abs(arr[i]);
            if (a > m) m = a;
        }
        return m;
    }

    // Simple linear resample (good enough for in-browser). MNE uses filtering, so it won't match exactly sample-for-sample.
    function _resampleLinear(values, fromRate, toRate) {
        if (!values.length) return [];
        if (Math.abs(fromRate - toRate) < 1e-9) return values.slice();

        const durationSec = (values.length - 1) / fromRate;
        const outLen = Math.max(1, Math.floor(durationSec * toRate) + 1);

        const out = new Array(outLen);
        for (let i = 0; i < outLen; i++) {
            const t = i / toRate;
            const x = t * fromRate;
            const x0 = Math.floor(x);
            const x1 = Math.min(values.length - 1, x0 + 1);
            const frac = x - x0;

            const v0 = values[x0];
            const v1 = values[x1];
            out[i] = v0 + (v1 - v0) * frac;
        }
        return out;
    }

    function _parseEdfClockToSec(clockStr) {
        // EDF start time usually looks like "hh.mm.ss"
        const parts = (clockStr || "").trim().split(/[^0-9]+/).filter(Boolean);
        const h = parseInt(parts[0] || "0", 10);
        const m = parseInt(parts[1] || "0", 10);
        const s = parseInt(parts[2] || "0", 10);
        return (h * 3600) + (m * 60) + s;
    }

    function parseEdfToJson(arrayBuffer, options = {}) {
        const view = new DataView(arrayBuffer);

        const startDateStr = _edfField(view, 168, 8); // "dd.mm.yy" 
        const startTimeStr = _edfField(view, 176, 8); // "hh.mm.ss"
        const startTimeSec = _parseEdfClockToSec(startTimeStr);

        const TARGET_RATE = 50;
        const DEFAULT_CHANNEL = 14;

        const targetRate = (typeof options.targetRate === "number") ? options.targetRate : TARGET_RATE;
        const channelIndex = (typeof options.channelIndex === "number") ? options.channelIndex : DEFAULT_CHANNEL;

        const headerBytes = parseInt(_edfField(view, 184, 8), 10);
        const nRecordsRaw = _edfField(view, 236, 8);
        let nRecords = parseInt(nRecordsRaw, 10);
        const recordDuration = _edfNum(_edfField(view, 244, 8)) || 1;
        const ns = parseInt(_edfField(view, 252, 4), 10);

        if (!Number.isFinite(headerBytes) || headerBytes < 256) {
            throw new Error("EDF parse error: bad headerBytes");
        }
        if (!Number.isFinite(ns) || ns <= 0) {
            throw new Error("EDF parse error: bad number of signals");
        }

        // per-signal headers start at byte 256
        let off = 256;

        const labels = [];
        for (let i = 0; i < ns; i++) labels.push(_edfField(view, off + i * 16, 16));
        off += ns * 16;

        off += ns * 80;

        const physicalDimensions = [];
        for (let i = 0; i < ns; i++) physicalDimensions.push(_edfField(view, off + i * 8, 8));
        off += ns * 8;

        const physMin = [];
        for (let i = 0; i < ns; i++) physMin.push(_edfNum(_edfField(view, off + i * 8, 8)));
        off += ns * 8;

        const physMax = [];
        for (let i = 0; i < ns; i++) physMax.push(_edfNum(_edfField(view, off + i * 8, 8)));
        off += ns * 8;

        const digMin = [];
        for (let i = 0; i < ns; i++) digMin.push(_edfNum(_edfField(view, off + i * 8, 8)));
        off += ns * 8;

        const digMax = [];
        for (let i = 0; i < ns; i++) digMax.push(_edfNum(_edfField(view, off + i * 8, 8)));
        off += ns * 8;

        // Skip: prefiltering (80)
        off += ns * 80;

        const samplesPerRecord = [];
        for (let i = 0; i < ns; i++) samplesPerRecord.push(parseInt(_edfField(view, off + i * 8, 8), 10));
        off += ns * 8;

        // Skip: reserved (32)
        off += ns * 32;

        const bytesPerRecord = samplesPerRecord.reduce((sum, n) => sum + (n * 2), 0);
        if (!Number.isFinite(bytesPerRecord) || bytesPerRecord <= 0) {
            throw new Error("EDF parse error: bad bytesPerRecord");
        }

        const channelRecordByteOffsets = new Array(ns);
        let recordByteCursor = 0;
        for (let i = 0; i < ns; i++) {
            channelRecordByteOffsets[i] = recordByteCursor;
            recordByteCursor += samplesPerRecord[i] * 2;
        }

        // Infer record count if unknown/invalid
        if (!Number.isFinite(nRecords) || nRecords <= 0) {
            const possible = Math.floor((arrayBuffer.byteLength - headerBytes) / bytesPerRecord);
            nRecords = Math.max(0, possible);
        }

        // Choose channel
        let ch = 0;
        if (typeof options.channelIndex === "number" && options.channelIndex >= 0 && options.channelIndex < ns) {
            ch = options.channelIndex;
        } else {
            ch = _pickBestChannelIndex(labels, options.preferredLabels);
        }

        const spr = samplesPerRecord[ch];
        if (!Number.isFinite(spr) || spr <= 0) throw new Error("EDF parse error: bad samples/record for chosen channel");

        const sampleRate = spr / recordDuration;

        const pmn = physMin[ch], pmx = physMax[ch];
        const dmn = digMin[ch], dmx = digMax[ch];
        if (![pmn, pmx, dmn, dmx].every(Number.isFinite) || dmx === dmn) {
            throw new Error("EDF parse error: bad scaling fields");
        }
        const scale = (pmx - pmn) / (dmx - dmn);

        const values = [];
        let ptr = headerBytes;

        // Data records: for each record, signals are stored sequentially, each as int16 samples
        for (let r = 0; r < nRecords; r++) {
            for (let s = 0; s < ns; s++) {
                const nSamp = samplesPerRecord[s];
                for (let j = 0; j < nSamp; j++) {
                    if (ptr + 2 > arrayBuffer.byteLength) break;

                    const dig = view.getInt16(ptr, true);
                    ptr += 2;

                    if (s === ch) {
                        const phys = pmn + (dig - dmn) * scale;
                        values.push(phys);
                    }
                }
            }
        }

        if (!values.length) throw new Error("EDF parse error: produced empty values array");

        // Resample to targetRate (Python: raw.copy().resample(TARGET_RATE))
        const physicalValues = _resampleLinear(values, sampleRate, targetRate);
        const values_rs = physicalValues.slice();

        // Keep a normalized copy for gameplay, but preserve the physical-unit signal for readout.
        let mu = _mean(values_rs);
        for (let i = 0; i < values_rs.length; i++) values_rs[i] -= mu;

        const maxAbs = _maxAbs(values_rs);
        if (maxAbs > 0) {
            for (let i = 0; i < values_rs.length; i++) values_rs[i] /= maxAbs;
        }

        return {
            sampleRate: targetRate,  
            values: values_rs,         
            visualValues: values_rs.slice(),
            physicalValues,
            channelLabel: labels[ch] || "",
            channelIndex: ch,
            channelLabels: labels,
            amplitudeMean: mu,
            amplitudePeak: maxAbs,
            amplitudeUnit: physicalDimensions[ch] || "",
            probeMeta: {
                headerBytes,
                bytesPerRecord,
                numRecords: nRecords,
                channelIndex: ch,
                channelRecordByteOffset: channelRecordByteOffsets[ch],
                channelSamplesPerRecord: spr,
                originalSampleRate: sampleRate,
                originalSampleCount: values.length,
                digitalMin: dmn,
                scale,
                physicalMin: pmn,
                amplitudeUnit: physicalDimensions[ch] || "",
            },
            numSignals: ns,
            startTimeSec,
            startTimeStr,
            startDateStr
        };

    }

    window.parseEdfToJson = parseEdfToJson;
})();
