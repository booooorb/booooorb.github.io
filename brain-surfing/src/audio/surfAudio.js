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
        gain: null,
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
            this.gain = ctx.createGain();
            this.windGain = ctx.createGain();
            this.sfxGain = ctx.createGain();

            this.osc.type = "sine";
            this.osc.frequency.value = 240;
            this.gain.gain.value = 0;
            this.windGain.gain.value = 0;
            this.sfxGain.gain.value = 0.1;

            this.osc.connect(this.gain);
            this.gain.connect(ctx.destination);
            this.windGain.connect(ctx.destination);
            this.sfxGain.connect(ctx.destination);

            this.loadWind(assetConfig.windGlide);
            this.loadFlip(assetConfig.flip);
            this.loadCrash(assetConfig.crash);

            this.osc.start();
            this.ready = true;
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
            if (!this.ready || !this.audioCtx || !this.osc || !this.gain) return;

            const t = this.audioCtx.currentTime;

            if (onGround) {
                const minFreq = 1;
                const maxFreq = 180;
                const freq = minFreq + (maxFreq - minFreq) * amp01;
                this.osc.frequency.setTargetAtTime(freq, t, 0.1);
                this.gain.gain.setTargetAtTime(0.15, t, 0.4);
            } else {
                this.gain.gain.setTargetAtTime(0, t, 0.05);
            }

            if (this.windBuffer && !this.windSource) {
                this.startWindIfNeeded();
            }

            if (this.windGain) {
                const target = currentTrick === "glide" ? 1.5 : 0;
                this.windGain.gain.setTargetAtTime(target, t, 0.1);
            }
        },

        pause() {
            if (!this.ready || !this.audioCtx) return;

            const t = this.audioCtx.currentTime;
            if (this.gain) {
                this.gain.gain.setTargetAtTime(0, t, 0.05);
            }

            if (this.windGain) {
                this.windGain.gain.setTargetAtTime(0, t, 0.05);
            }
        },
    };

    global.SurfAudio = SurfAudio;
})(window);
