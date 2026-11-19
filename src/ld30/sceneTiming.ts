export const SPLASH_TIMELINE_MS = [
    800,
    800,
    500,
    800,
    800,
    500,
] as const;

export const SPLASH_DURATION_MS = SPLASH_TIMELINE_MS.reduce(
    (total, duration) => total + duration,
    0,
);

export const MIN_END_DELAY_MS = 3000;
export const PAR_SECONDS = 160;
export const HOMLETMOO_RECORD_SECONDS = 123;

export function formatElapsedTime(totalMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function shouldStartLevelFromReleasedKey(
    repeat: boolean,
): boolean {
    return !repeat;
}

export function shouldRestartAfterEndDelay(
    elapsedSinceEndMs: number,
    repeat: boolean,
): boolean {
    return !repeat && elapsedSinceEndMs >= MIN_END_DELAY_MS;
}

export function canCompleteLevel(transitionLocked: boolean, completed: boolean): boolean {
    return completed && !transitionLocked;
}
