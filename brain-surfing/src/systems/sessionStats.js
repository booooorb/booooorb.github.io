(function (global) {
    class SessionHighScore {
        constructor(storageKey = "brain-surfing:session-high-score") {
            this.storageKey = storageKey;
            this.memoryValue = 0;
            this.storage = this.getStorage();
            this.memoryValue = this.readStoredValue();
        }

        getStorage() {
            try {
                return global.sessionStorage || null;
            } catch (_err) {
                return null;
            }
        }

        readStoredValue() {
            if (!this.storage) return this.memoryValue;

            const raw = this.storage.getItem(this.storageKey);
            const parsed = Number.parseInt(raw || "0", 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        }

        get() {
            return this.readStoredValue();
        }

        update(score) {
            const nextValue = Math.max(this.get(), Math.floor(score));
            this.memoryValue = nextValue;

            if (this.storage) {
                this.storage.setItem(this.storageKey, String(nextValue));
            }

            return nextValue;
        }
    }

    global.SessionHighScore = SessionHighScore;
})(window);
