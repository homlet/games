import type { DirectionInput } from "./physics.ts";

export const ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED = 2;

export function getAccelerationDirectionInput(
    accelerationX: number | null,
    accelerationY: number | null,
    neutralX = 0,
    neutralY = 0,
): DirectionInput {
    const x = accelerationX === null ? Number.NaN : accelerationX - neutralX;
    const y = accelerationY === null ? Number.NaN : accelerationY - neutralY;

    return {
        up:
            Number.isFinite(y) &&
            y > ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
        down:
            Number.isFinite(y) &&
            y < -ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
        left:
            Number.isFinite(x) &&
            x > ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
        right:
            Number.isFinite(x) &&
            x < -ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
    };
}
