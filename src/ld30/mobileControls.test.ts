import assert from "node:assert/strict";
import test from "node:test";

import {
    ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
    getAccelerationDirectionInput,
} from "./mobileControls.ts";

test("device acceleration maps x and y gravity to directional input", () => {
    assert.deepEqual(getAccelerationDirectionInput(-3, 3), {
        up: true,
        down: false,
        left: true,
        right: false,
    });
    assert.deepEqual(getAccelerationDirectionInput(3, -3), {
        up: false,
        down: true,
        left: false,
        right: true,
    });
});

test("device acceleration ignores small and invalid readings", () => {
    assert.deepEqual(
        getAccelerationDirectionInput(
            ACCELERATION_DEAD_ZONE_METERS_PER_SECOND_SQUARED,
            Number.NaN,
        ),
        { up: false, down: false, left: false, right: false },
    );
    assert.deepEqual(getAccelerationDirectionInput(null, null), {
        up: false,
        down: false,
        left: false,
        right: false,
    });
});

test("device acceleration is measured relative to the neutral holding position", () => {
    assert.deepEqual(getAccelerationDirectionInput(7, 11, 10, 8), {
        up: true,
        down: false,
        left: true,
        right: false,
    });
});
