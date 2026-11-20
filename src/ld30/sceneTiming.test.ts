import assert from "node:assert/strict";
import test from "node:test";

import {
    HOMLETMOO_RECORD_SECONDS,
    MIN_END_DELAY_MS,
    PAR_SECONDS,
    SPLASH_DURATION_MS,
    formatElapsedTime,
    getFlashpunkFrame,
    shouldRestartAfterEndDelay,
    shouldStartLevelFromReleasedKey,
} from "./sceneTiming.ts";

test("FlashPunk splash animation loops through its four 8 fps frames", () => {
    assert.deepEqual(
        [0, 125, 375, 500, 875].map(getFlashpunkFrame),
        [0, 1, 3, 0, 3],
    );
});

test("elapsed time uses whole seconds and m:ss formatting", () => {
    assert.equal(formatElapsedTime(0), "0:00");
    assert.equal(formatElapsedTime(59000), "0:59");
    assert.equal(formatElapsedTime(60000), "1:00");
    assert.equal(formatElapsedTime(125999), "2:05");
});

test("menu and end waits use released-key guards", () => {
    assert.equal(shouldStartLevelFromReleasedKey(false), true);
    assert.equal(shouldStartLevelFromReleasedKey(true), false);
    assert.equal(
        shouldRestartAfterEndDelay(MIN_END_DELAY_MS - 1, false),
        false,
    );
    assert.equal(shouldRestartAfterEndDelay(MIN_END_DELAY_MS, false), true);
    assert.equal(shouldRestartAfterEndDelay(MIN_END_DELAY_MS, true), false);
});

test("source timing constants are preserved", () => {
    assert.equal(SPLASH_DURATION_MS, 4200);
    assert.equal(PAR_SECONDS, 160);
    assert.equal(HOMLETMOO_RECORD_SECONDS, 123);
});
