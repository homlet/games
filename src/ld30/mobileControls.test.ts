import assert from "node:assert/strict";
import test from "node:test";

import {
    ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
    GAME_UNITS_PER_METER,
    getAccelerationDirectionInput,
    smoothSensorAcceleration,
} from "./mobileControls.ts";

test("device acceleration maps x and y gravity to continuous game acceleration", () => {
    assert.deepEqual(getAccelerationDirectionInput(-0.2, 0.2), {
        up: false,
        down: false,
        left: false,
        right: false,
        accelerationX: -0.2 * GAME_UNITS_PER_METER,
        accelerationY: -0.2 * GAME_UNITS_PER_METER,
    });
    assert.deepEqual(getAccelerationDirectionInput(0.2, -0.2), {
        up: false,
        down: false,
        left: false,
        right: false,
        accelerationX: 0.2 * GAME_UNITS_PER_METER,
        accelerationY: 0.2 * GAME_UNITS_PER_METER,
    });
});

test("device acceleration ignores small and invalid readings", () => {
    assert.deepEqual(
        getAccelerationDirectionInput(
            ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
            Number.NaN,
        ),
        {
            up: false,
            down: false,
            left: false,
            right: false,
            accelerationX: 0,
            accelerationY: 0,
        },
    );
    assert.deepEqual(getAccelerationDirectionInput(null, null), {
        up: false,
        down: false,
        left: false,
        right: false,
        accelerationX: 0,
        accelerationY: 0,
    });
});

test("device acceleration is measured relative to the neutral holding position", () => {
    assert.deepEqual(getAccelerationDirectionInput(7, 11, 10, 8), {
        up: false,
        down: false,
        left: false,
        right: false,
        accelerationX: -3 * GAME_UNITS_PER_METER,
        accelerationY: -3 * GAME_UNITS_PER_METER,
    });
});

test("device acceleration dead zone only filters small sensor noise", () => {
    const belowNoiseThreshold =
        ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED / 2;
    assert.equal(
        getAccelerationDirectionInput(belowNoiseThreshold, -belowNoiseThreshold)
            .accelerationX,
        0,
    );
    assert.equal(
        getAccelerationDirectionInput(0.2, 0).accelerationX,
        0.2 * GAME_UNITS_PER_METER,
    );
});

test("live tuning changes dead zone and acceleration gain", () => {
    const tunedInput = getAccelerationDirectionInput(0.5, -0.4, 0, 0, 0.2, 50);

    assert.equal(tunedInput.accelerationX, 25);
    assert.equal(tunedInput.accelerationY, 20);
});

test("sensor smoothing blends the current reading with the prior reading", () => {
    assert.deepEqual(
        smoothSensorAcceleration({ x: 0, y: 0 }, { x: 10, y: -4 }, 0.5),
        { x: 5, y: -2 },
    );
    assert.deepEqual(smoothSensorAcceleration(null, { x: 10, y: -4 }, 0.9), {
        x: 10,
        y: -4,
    });
});
