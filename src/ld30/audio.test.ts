import assert from "node:assert/strict";
import test from "node:test";

import {
    panForPosition,
    rollingVolumeFromAverageSpeed,
    sineEaseIn,
} from "./audio.ts";

test("rolling volume uses sine easing and is capped", () => {
    assert.equal(sineEaseIn(0), 0);
    assert.equal(sineEaseIn(1), 1);
    assert.equal(rollingVolumeFromAverageSpeed(0), 0);
    assert.equal(rollingVolumeFromAverageSpeed(400), 1);
    assert.ok(rollingVolumeFromAverageSpeed(100) > 0);
    assert.ok(rollingVolumeFromAverageSpeed(100) < 1);
});

test("horizontal pan maps across the original 800px width", () => {
    assert.equal(panForPosition(0, 800), -1);
    assert.equal(panForPosition(400, 800), 0);
    assert.equal(panForPosition(800, 800), 1);
});
