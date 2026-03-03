import { system } from "@minecraft/server";

class CooldownClass {
    endTime = null;

    /**
     * Start cooldown
     * @param {number} duration - Duration in seconds
     */
    start(duration) {
        if (this.isActive()) return;
        
        this.endTime = Date.now() + duration * 1000;
        system.runTimeout(() => {
            this.endTime = null;
        }, duration * 20);
    }

    /**
     * Check if cooldown is active
     * @returns {boolean}
     */
    isActive() {
        return this.endTime !== null && this.endTime > Date.now();
    }

    /**
     * Get remaining cooldown time in seconds
     * @returns {number}
     */
    getCooldown() {
        if (!this.isActive()) return 0;
        
        const remainingTime = Math.max(0, this.endTime - Date.now());
        return Math.round(remainingTime / 1000);
    }
}

export { CooldownClass };
