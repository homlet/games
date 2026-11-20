import type { DirectionInput } from "./physics.ts";

export const ORIENTATION_DEAD_ZONE_DEGREES = 12;

export function getOrientationDirectionInput(
    beta: number | null,
    gamma: number | null,
): DirectionInput {
    const tiltBeta = beta ?? 0;
    const tiltGamma = gamma ?? 0;

    return {
        up:
            Number.isFinite(tiltBeta) &&
            tiltBeta < -ORIENTATION_DEAD_ZONE_DEGREES,
        down:
            Number.isFinite(tiltBeta) &&
            tiltBeta > ORIENTATION_DEAD_ZONE_DEGREES,
        left:
            Number.isFinite(tiltGamma) &&
            tiltGamma < -ORIENTATION_DEAD_ZONE_DEGREES,
        right:
            Number.isFinite(tiltGamma) &&
            tiltGamma > ORIENTATION_DEAD_ZONE_DEGREES,
    };
}
