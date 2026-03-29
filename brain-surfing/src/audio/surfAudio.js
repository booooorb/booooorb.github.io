(function (global) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const assetConfig = global.BrainSurfingConfig?.assets?.audio || {};

    function loadBuffer(audioCtx, url) {
        return fetch(url)
            .then((res) => res.arrayBuffer())
            .then((data) => audioCtx.decodeAudioData(data));
    }

    const SurfAudio = {
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
        lastAmp: null,
        ready: false,

        windBuffer: null,
        windSource: null,
        windGain: null,
        loadingWind: false,

        flipBuffer: null,
        loadingFlip: false,

        crashBuffer: null,
        loadingCrash: false,

        sfxGain: null,

        init() {
            if (this.ready || !AC) return;

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
            this.sfxGain = ctx.createGain();

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
            this.sfxGain.gain.value = 0.06;

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
            this.sfxGain.connect(this.masterGain);

            this.loadWind(assetConfig.windGlide);
            this.loadFlip(assetConfig.flip);
            this.loadCrash(assetConfig.crash);

            this.osc.start();
            this.subOsc.start();
            this.overtoneOsc.start();
            this.wobbleOsc.start();
            this.ready = true;
        },

        smooth01(value) {
            const clamped = Math.max(0, Math.min(1, value));
            return clamped * clamped * (3 - 2 * clamped);
        },

        deepToneProfile(amp01, signedChange01 = 0) {
            const clamped = Math.max(0, Math.min(1, Number.isFinite(amp01) ? amp01 : 0));
            const ampMotion = this.smooth01(clamped);
            const signed = Math.max(-1, Math.min(1, Number.isFinite(signedChange01) ? signedChange01 : 0));
            const highPush = this.smooth01(Math.max(0, signed));
            const lowPush = this.smooth01(Math.max(0, -signed));
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
                .then((buf) => {
                    this.windBuffer = buf;
                    this.loadingWind = false;
                    this.startWindIfNeeded();
                })
                .catch((err) => {
                    console.warn("Failed to load wind sample:", err);
                    this.loadingWind = false;
                });
        },

        loadFlip(url) {
            if (!this.audioCtx || this.loadingFlip || this.flipBuffer || !url) return;
            this.loadingFlip = true;

            loadBuffer(this.audioCtx, url)
                .then((buf) => {
                    this.flipBuffer = buf;
                    this.loadingFlip = false;
                })
                .catch((err) => {
                    console.warn("Failed to load flip SFX:", err);
                    this.loadingFlip = false;
                });
        },

        loadCrash(url) {
            if (!this.audioCtx || this.loadingCrash || this.crashBuffer || !url) return;
            this.loadingCrash = true;

            loadBuffer(this.audioCtx, url)
                .then((buf) => {
                    this.crashBuffer = buf;
                    this.loadingCrash = false;
                })
                .catch((err) => {
                    console.warn("Failed to load crash SFX:", err);
                    this.loadingCrash = false;
                });
        },

        playFlip() {
            if (!this.audioCtx || !this.flipBuffer || !this.sfxGain) return;

            const src = this.audioCtx.createBufferSource();
            src.buffer = this.flipBuffer;
            src.connect(this.sfxGain);
            src.start(0);
        },

        playCrash() {
            if (!this.audioCtx || !this.crashBuffer || !this.sfxGain) return;

            const src = this.audioCtx.createBufferSource();
            src.buffer = this.crashBuffer;
            src.connect(this.sfxGain);
            src.start(0);
        },

        startWindIfNeeded() {
            if (!this.audioCtx || !this.windBuffer || this.windSource) return;

            const src = this.audioCtx.createBufferSource();
            src.buffer = this.windBuffer;
            src.loop = true;
            src.connect(this.windGain);
            src.start(0);
            this.windSource = src;
        },

        ensure() {
            if (!AC) return;

            if (!this.ready) {
                this.init();
            } else if (this.audioCtx.state === "suspended") {
                this.audioCtx.resume();
            }
        },

        update(onGround, amp01, currentTrick) {
            if (!this.ready || !this.audioCtx || !this.osc || !this.gain || !this.subOsc || !this.subGain) return;

            const t = this.audioCtx.currentTime;
            const clampedAmp = Math.max(0, Math.min(1, Number.isFinite(amp01) ? amp01 : 0));
            const previousAmp = Number.isFinite(this.lastAmp) ? this.lastAmp : clampedAmp;
            const signedChange = Math.max(-1, Math.min(1, (clampedAmp - previousAmp) * 260));
            this.lastAmp = clampedAmp;

            if (onGround) {
                const profile = this.deepToneProfile(clampedAmp, signedChange);

                this.osc.frequency.setTargetAtTime(profile.fundamental, t, 0.08);
                this.subOsc.frequency.setTargetAtTime(profile.subFundamental, t, 0.1);
                this.overtoneOsc.frequency.setTargetAtTime(profile.overtone, t, 0.08);
                this.toneFilter.frequency.setTargetAtTime(profile.filter, t, 0.06);
                this.toneFilter.Q.setTargetAtTime(profile.resonance, t, 0.08);
                this.gain.gain.setTargetAtTime(profile.toneLevel, t, 0.08);
                this.subGain.gain.setTargetAtTime(profile.subLevel, t, 0.1);
                this.overtoneGain.gain.setTargetAtTime(profile.overtoneLevel, t, 0.08);
                this.wobbleGain.gain.setTargetAtTime(profile.wobbleDepth, t, 0.08);
                this.wobbleOsc.frequency.setTargetAtTime(profile.wobbleRate, t, 0.08);
            } else {
                this.gain.gain.setTargetAtTime(0, t, 0.07);
                this.subGain.gain.setTargetAtTime(0, t, 0.08);
                this.overtoneGain.gain.setTargetAtTime(0, t, 0.06);
                this.wobbleGain.gain.setTargetAtTime(0.25, t, 0.08);
            }

            if (this.windBuffer && !this.windSource) {
                this.startWindIfNeeded();
            }

            if (this.windGain) {
                const target = currentTrick === "glide" ? 0.16 : 0;
                this.windGain.gain.setTargetAtTime(target, t, 0.08);
            }
        },

        pause() {
            if (!this.ready || !this.audioCtx) return;

            const t = this.audioCtx.currentTime;
            if (this.gain) {
                this.gain.gain.setTargetAtTime(0, t, 0.04);
            }

            if (this.subGain) {
                this.subGain.gain.setTargetAtTime(0, t, 0.05);
            }

            if (this.overtoneGain) {
                this.overtoneGain.gain.setTargetAtTime(0, t, 0.04);
            }

            if (this.windGain) {
                this.windGain.gain.setTargetAtTime(0, t, 0.04);
            }
        },
    };

    global.SurfAudio = SurfAudio;
})(window);
