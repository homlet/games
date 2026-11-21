import type { DirectionInput } from "./physics.ts";

export const ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED = 0.1;
export const GAME_UNITS_PER_METER = 100;

export function getAccelerationDirectionInput(
    accelerationX: number | null,
    accelerationY: number | null,
    neutralX = 0,
    neutralY = 0,
): DirectionInput {
    const x = accelerationX === null ? Number.NaN : accelerationX - neutralX;
    const y = accelerationY === null ? Number.NaN : accelerationY - neutralY;
    const deadZone = ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED;

    return {
        up: false,
        down: false,
        left: false,
        right: false,
        accelerationX:
            Number.isFinite(x) && Math.abs(x) > deadZone
                ? x * GAME_UNITS_PER_METER
                : 0,
        accelerationY:
            Number.isFinite(y) && Math.abs(y) > deadZone
                ? -y * GAME_UNITS_PER_METER
                : 0,
    };
}
