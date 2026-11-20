import assert from "node:assert/strict";
import test from "node:test";

import {
    getOrientationDirectionInput,
    ORIENTATION_DEAD_ZONE_DEGREES,
} from "./mobileControls.ts";

test("device orientation maps beta and gamma to directional input", () => {
    assert.deepEqual(getOrientationDirectionInput(-20, 20), {
        up: true,
        down: false,
        left: false,
        right: true,
    });
    assert.deepEqual(getOrientationDirectionInput(20, -20), {
        up: false,
        down: true,
        left: true,
        right: false,
    });
});

test("device orientation ignores small and invalid readings", () => {
    assert.deepEqual(
        getOrientationDirectionInput(ORIENTATION_DEAD_ZONE_DEGREES, Number.NaN),
        { up: false, down: false, left: false, right: false },
    );
    assert.deepEqual(getOrientationDirectionInput(null, null), {
        up: false,
        down: false,
        left: false,
        right: false,
    });
});
