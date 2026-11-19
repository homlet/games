export interface Ld30SoundMap {
    bell: string;
    roll: string;
    hit: readonly [string, string, string, string, string, string, string, string];
    hole: readonly [string, string, string];
}

export function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

export function sineEaseIn(value: number): number {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return 1 - Math.cos((value * Math.PI) / 2);
}

export function rollingVolumeFromAverageSpeed(averageSpeed: number): number {
    return clamp(sineEaseIn(averageSpeed / 200), 0, 1);
}

export function panForPosition(x: number, width: number): number {
    return clamp((3 * x) / width - 1.5, -1, 1);
}

export class Ld30AudioManager {
    private readonly sounds: Ld30SoundMap;
    private context: AudioContext | null = null;
    private buffers = new Map<string, AudioBuffer>();
    private rollSource: AudioBufferSourceNode | null = null;
    private rollGain: GainNode | null = null;
    private rollPan: StereoPannerNode | null = null;
    private rollVolume = 0;
    private hitIndex = 0;
    private holeIndex = 0;
    private gestureInstalled = false;
    private disposed = false;
    private cleanupGesture: (() => void) | null = null;

    constructor(sounds: Ld30SoundMap) {
        this.sounds = sounds;
    }

    async preload(): Promise<string[]> {
        if (this.disposed) return [];

        const entries = [
            ["bell", this.sounds.bell],
            ["roll", this.sounds.roll],
            ...this.sounds.hit.map((src, index) => [`hit${index + 1}`, src]),
            ...this.sounds.hole.map((src, index) => [`hole${index + 1}`, src]),
        ] as const;
        const failures: string[] = [];

        await Promise.all(
            entries.map(async ([name, src]) => {
                try {
                    const response = await fetch(src);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const bytes = await response.arrayBuffer();
                    const context = this.getContext();
                    const buffer = await context.decodeAudioData(bytes.slice(0));
                    this.buffers.set(name, buffer);
                } catch (error) {
                    failures.push(name);
                    console.warn(`LD30 audio failed to load: ${name}`, error);
                }
            }),
        );

        return failures;
    }

    installGestureUnlock(): () => void {
        if (this.gestureInstalled) {
            return this.cleanupGesture ?? (() => undefined);
        }
        this.gestureInstalled = true;

        const unlock = () => {
            void this.unlock();
        };
        window.addEventListener("keydown", unlock, { passive: true });
        window.addEventListener("pointerdown", unlock, { passive: true });
        window.addEventListener("touchstart", unlock, { passive: true });

        this.cleanupGesture = () => {
            window.removeEventListener("keydown", unlock);
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("touchstart", unlock);
            this.gestureInstalled = false;
        };
        return this.cleanupGesture;
    }

    async unlock(): Promise<void> {
        if (this.disposed) return;
        const context = this.getContext();
        if (context.state !== "running") {
            await context.resume();
        }
    }

    private getContext(): AudioContext {
        if (this.context) return this.context;
        const audioWindow = window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
        };
        const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error("Web Audio is unavailable.");
        }
        this.context = new AudioContextClass();
        return this.context;
    }

    private playBuffer(
        name: string,
        volume = 1,
        pan = 0,
    ): boolean {
        if (this.disposed) return false;
        const context = this.context;
        const buffer = this.buffers.get(name);
        if (!context || context.state !== "running" || !buffer) return false;

        const source = context.createBufferSource();
        source.buffer = buffer;

        const gain = context.createGain();
        gain.gain.value = clamp(volume, 0, 2);

        const panner = context.createStereoPanner();
        panner.pan.value = clamp(pan, -1, 1);

        source.connect(gain);
        gain.connect(panner);
        panner.connect(context.destination);
        source.onended = () => {
            source.disconnect();
            gain.disconnect();
            panner.disconnect();
        };
        source.start();
        return true;
    }

    playBell(): boolean {
        return this.playBuffer("bell", 2, 0);
    }

    playNextHit(speed: number, x: number, width: number): boolean {
        const name = `hit${this.hitIndex + 1}`;
        this.hitIndex = (this.hitIndex + 1) % this.sounds.hit.length;
        return this.playBuffer(name, clamp(speed / 130, 0, 1), panForPosition(x, width));
    }

    playNextHole(x: number, width: number): boolean {
        const name = `hole${this.holeIndex + 1}`;
        this.holeIndex = (this.holeIndex + 1) % this.sounds.hole.length;
        return this.playBuffer(name, 1, panForPosition(x, width));
    }

    startRollingLoop(): void {
        if (this.disposed || this.rollSource) return;
        const context = this.context;
        const buffer = this.buffers.get("roll");
        if (!context || context.state !== "running" || !buffer) return;

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = context.createGain();
        gain.gain.value = this.rollVolume;
        const panner = context.createStereoPanner();
        panner.pan.value = 0;
        source.connect(gain);
        gain.connect(panner);
        panner.connect(context.destination);
        source.start();

        this.rollSource = source;
        this.rollGain = gain;
        this.rollPan = panner;
    }

    updateRollingVolume(averageSpeed: number): void {
        const target = rollingVolumeFromAverageSpeed(averageSpeed);
        this.rollVolume += (target - this.rollVolume) / 5;
        this.rollVolume = clamp(this.rollVolume, 0, 1);

        if (this.rollGain && this.context) {
            this.rollGain.gain.setTargetAtTime(
                this.rollVolume,
                this.context.currentTime,
                0.02,
            );
        }
    }

    stopRollingLoop(): void {
        if (!this.rollSource) return;
        this.rollSource.stop();
        this.rollSource.disconnect();
        this.rollGain?.disconnect();
        this.rollPan?.disconnect();
        this.rollSource = null;
        this.rollGain = null;
        this.rollPan = null;
        this.rollVolume = 0;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stopRollingLoop();
        this.cleanupGesture?.();
        this.cleanupGesture = null;
        this.buffers.clear();
        if (this.context) {
            void this.context.close();
            this.context = null;
        }
    }
}
