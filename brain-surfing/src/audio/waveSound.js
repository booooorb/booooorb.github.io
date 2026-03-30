(function (global) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const assetConfig = global.BrainSurfingConfig?.assets?.audio || {};

    function loadBuffer(audioCtx, url) {
        return fetch(url)
            .then((res) => res.arrayBuffer())
            .then((data) => audioCtx.decodeAudioData(data));
    }

    const BrainSurfingWaveSound = {
        audioCtx: null,
        osc: null,
        subOsc: null,
        overtoneOsc: null,
        wobbleOsc: null,
        toneFilter: null,
        toneHighpass: null,
        toneComp: null,
        gain: null,
        subGain: null,
        overtoneGain: null,
        wobbleGain: null,
        bedGain: null,
        masterGain: null,
        windGain: null,
        windBuffer: null,
        windSource: null,
        loadingWind: false,
        lastAmp: null,
        ready: false,

        init() {
            if (this.ready || !AC) return this.audioCtx;

            const ctx = new AC();
            this.audioCtx = ctx;

            this.osc = ctx.createOscillator();
            this.subOsc = ctx.createOscillator();
            this.overtoneOsc = ctx.createOscillator();
            this.wobbleOsc = ctx.createOscillator();
            this.toneFilter = ctx.createBiquadFilter();
            this.toneHighpass = ctx.createBiquadFilter();
            this.toneComp = ctx.createDynamicsCompressor();
            this.gain = ctx.createGain();
            this.subGain = ctx.createGain();
            this.overtoneGain = ctx.createGain();
            this.wobbleGain = ctx.createGain();
            this.bedGain = ctx.createGain();
            this.masterGain = ctx.createGain();
            this.windGain = ctx.createGain();

            this.osc.type = "sine";
            this.subOsc.type = "sine";
            this.overtoneOsc.type = "sine";
            this.wobbleOsc.type = "sine";
            this.osc.frequency.value = 55;
            this.subOsc.frequency.value = 27.5;
            this.overtoneOsc.frequency.value = 165;
            this.wobbleOsc.frequency.value = 0.16;
            this.toneFilter.type = "lowpass";
            this.toneFilter.frequency.value = 640;
            this.toneFilter.Q.value = 0.22;
            this.toneHighpass.type = "highpass";
            this.toneHighpass.frequency.value = 110;
            this.toneHighpass.Q.value = 0.2;
            this.toneComp.threshold.value = -22;
            this.toneComp.knee.value = 18;
            this.toneComp.ratio.value = 2.5;
            this.toneComp.attack.value = 0.02;
            this.toneComp.release.value = 0.1;
            this.gain.gain.value = 0;
            this.subGain.gain.value = 0;
            this.overtoneGain.gain.value = 0;
            this.wobbleGain.gain.value = 0.7;
            this.bedGain.gain.value = 2.35;
            this.masterGain.gain.value = 0.76;
            this.windGain.gain.value = 0;

            this.osc.connect(this.toneFilter);
            this.subOsc.connect(this.subGain);
            this.subGain.connect(this.toneFilter);
            this.overtoneOsc.connect(this.overtoneGain);
            this.overtoneGain.connect(this.toneFilter);
            this.toneFilter.connect(this.toneHighpass);
            this.toneHighpass.connect(this.gain);
            this.gain.connect(this.toneComp);
            this.toneComp.connect(this.bedGain);
            this.bedGain.connect(this.masterGain);
            this.masterGain.connect(ctx.destination);
            this.wobbleOsc.connect(this.wobbleGain);
            this.wobbleGain.connect(this.toneFilter.frequency);
            this.windGain.connect(this.bedGain);

            this.loadWind(assetConfig.windGlide);

            this.osc.start();
            this.subOsc.start();
            this.overtoneOsc.start();
            this.wobbleOsc.start();
            this.ready = true;

            return ctx;
        },

        ensure() {
            if (!AC) return null;
            const ctx = this.ready ? this.audioCtx : this.init();
            if (ctx && ctx.state === "suspended") {
                ctx.resume();
            }
            return ctx;
        },

        getAudioContext() {
            return this.audioCtx;
        },

        smooth01(value) {
            const clamped = Math.max(0, Math.min(1, value));
            return clamped * clamped * (3 - 2 * clamped);
        },

        deepToneProfile(amp01, signedChange01) {
            const clampedAmp = Math.max(0, Math.min(1, Number.isFinite(amp01) ? amp01 : 0));
            const ampMotion = this.smooth01(clampedAmp);
            const signedChange = Math.max(-1, Math.min(1, Number.isFinite(signedChange01) ? signedChange01 : 0));
            const highPush = this.smooth01(Math.max(0, signedChange));
            const lowPush = this.smooth01(Math.max(0, -signedChange));
            const emphasis = Math.min(1, ampMotion * 0.22 + highPush * 0.9 + lowPush * 0.9);
            const fundamental = 34 + ampMotion * 36 + highPush * 1180 - lowPush * 14;

            return {
                fundamental,
                subFundamental: Math.max(24, fundamental * (0.34 + lowPush * 0.16)),
                overtone: fundamental * (1.18 + ampMotion * 0.2 + highPush * 1.7),
                filter: 420 + ampMotion * 700 + highPush * 6200 - lowPush * 120,
                resonance: 0.08 + ampMotion * 0.12 + highPush * 0.78,
                toneLevel: 0.058 + ampMotion * 0.02 + highPush * 0.05,
                subLevel: 0.042 + lowPush * 0.028 + (1 - emphasis) * 0.02,
                overtoneLevel: 0.006 + ampMotion * 0.01 + highPush * 0.11,
                wobbleDepth: 0.08 + ampMotion * 0.12 + highPush * 0.35 + lowPush * 0.08,
                wobbleRate: 0.01 + ampMotion * 0.02 + highPush * 0.07,
            };
        },

        loadWind(url) {
            if (!this.audioCtx || this.loadingWind || this.windBuffer || !url) return;
            this.loadingWind = true;

            loadBuffer(this.audioCtx, url)
                .then((buffer) => {
                    this.windBuffer = buffer;
                    this.loadingWind = false;
                    this.startWindIfNeeded();
                })
                .catch((err) => {
                    console.warn("Failed to load wind sample:", err);
                    this.loadingWind = false;
                });
        },

        startWindIfNeeded() {
            if (!this.audioCtx || !this.windBuffer || this.windSource) return;

            const source = this.audioCtx.createBufferSource();
            source.buffer = this.windBuffer;
            source.loop = true;
            source.connect(this.windGain);
            source.start(0);
            this.windSource = source;
        },

        update(onGround, amp01, currentTrick) {
            if (!this.ready || !this.audioCtx || !this.osc || !this.gain || !this.subOsc || !this.subGain) return;

            const now = this.audioCtx.currentTime;
            const clampedAmp = Math.max(0, Math.min(1, Number.isFinite(amp01) ? amp01 : 0));
            const previousAmp = Number.isFinite(this.lastAmp) ? this.lastAmp : clampedAmp;
            const signedChange = Math.max(-1, Math.min(1, (clampedAmp - previousAmp) * 260));
            this.lastAmp = clampedAmp;

            if (onGround) {
                const profile = this.deepToneProfile(clampedAmp, signedChange);
                this.osc.frequency.setTargetAtTime(profile.fundamental, now, 0.08);
                this.subOsc.frequency.setTargetAtTime(profile.subFundamental, now, 0.1);
                this.overtoneOsc.frequency.setTargetAtTime(profile.overtone, now, 0.08);
                this.toneFilter.frequency.setTargetAtTime(profile.filter, now, 0.06);
                this.toneFilter.Q.setTargetAtTime(profile.resonance, now, 0.08);
                this.gain.gain.setTargetAtTime(profile.toneLevel, now, 0.08);
                this.subGain.gain.setTargetAtTime(profile.subLevel, now, 0.1);
                this.overtoneGain.gain.setTargetAtTime(profile.overtoneLevel, now, 0.08);
                this.wobbleGain.gain.setTargetAtTime(profile.wobbleDepth, now, 0.08);
                this.wobbleOsc.frequency.setTargetAtTime(profile.wobbleRate, now, 0.08);
            } else {
                this.gain.gain.setTargetAtTime(0, now, 0.07);
                this.subGain.gain.setTargetAtTime(0, now, 0.08);
                this.overtoneGain.gain.setTargetAtTime(0, now, 0.06);
                this.wobbleGain.gain.setTargetAtTime(0.25, now, 0.08);
            }

            if (this.windBuffer && !this.windSource) {
                this.startWindIfNeeded();
            }

            if (this.windGain) {
                const target = currentTrick === "glide" ? 0.16 : 0;
                this.windGain.gain.setTargetAtTime(target, now, 0.08);
            }
        },

        pause() {
            if (!this.ready || !this.audioCtx) return;

            const now = this.audioCtx.currentTime;
            if (this.gain) this.gain.gain.setTargetAtTime(0, now, 0.04);
            if (this.subGain) this.subGain.gain.setTargetAtTime(0, now, 0.05);
            if (this.overtoneGain) this.overtoneGain.gain.setTargetAtTime(0, now, 0.04);
            if (this.windGain) this.windGain.gain.setTargetAtTime(0, now, 0.04);
        },
    };

    global.BrainSurfingWaveSound = BrainSurfingWaveSound;
})(window);
