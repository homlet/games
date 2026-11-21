import type { DirectionInput, Point } from "./physics.ts";

export const ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED = 0.1;
export const GAME_UNITS_PER_METER = 100;

export function getAccelerationDirectionInput(
    accelerationX: number | null,
    accelerationY: number | null,
    neutralX = 0,
    neutralY = 0,
    deadZone = ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
    gameUnitsPerMeter = GAME_UNITS_PER_METER,
): DirectionInput {
    const x = accelerationX === null ? Number.NaN : accelerationX - neutralX;
    const y = accelerationY === null ? Number.NaN : accelerationY - neutralY;

    return {
        up: false,
        down: false,
        left: false,
        right: false,
        accelerationX:
            Number.isFinite(x) && Math.abs(x) > deadZone
                ? x * gameUnitsPerMeter
                : 0,
        accelerationY:
            Number.isFinite(y) && Math.abs(y) > deadZone
                ? -y * gameUnitsPerMeter
                : 0,
    };
}

export function smoothSensorAcceleration(
    previous: Point | null,
    next: Point,
    smoothing: number,
): Point {
    if (!previous) {
        return next;
    }

    const retained = Math.max(0, Math.min(smoothing, 1));
    const response = 1 - retained;
    return {
        x: previous.x + (next.x - previous.x) * response,
        y: previous.y + (next.y - previous.y) * response,
    };
}
