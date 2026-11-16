import assert from "node:assert/strict";
import test from "node:test";

import {
    FIXED_STEP_SECONDS,
    MARBLE_G,
    MARBLE_MU,
    MARBLE_RESTITUTION,
    MARBLE_SLOPE,
    MARBLE_STOP_SPEED,
    advanceFixedStepAccumulator,
    advanceMarblePosition,
    applyDirectionalAcceleration,
    applyVelocityFriction,
    areAllTargetsActivated,
    resolveAxisCollision,
    resetMarblesToStarts,
    smoothTilt,
} from "./physics.ts";

test("the original marble constants are preserved", () => {
    assert.equal(MARBLE_G, 980);
    assert.equal(MARBLE_MU, 0.08);
    assert.equal(MARBLE_RESTITUTION, 0.4);
    assert.equal(MARBLE_SLOPE, (1 - MARBLE_MU * Math.sqrt(3)) / 2);
});

test("directional acceleration matches the original arcade update order", () => {
    const acceleration = applyDirectionalAcceleration(
        { up: true, down: false, left: false, right: true },
        1 / 60,
    );

    assert.ok(acceleration.vy < 0);
    assert.ok(acceleration.vx > 0);
    assert.ok(Math.abs(acceleration.vy) > 0);
    assert.ok(Math.abs(acceleration.vx) > 0);
});

test("friction stops velocities without reversing them", () => {
    assert.equal(applyVelocityFriction(100, 10), 90);
    assert.equal(applyVelocityFriction(-100, 10), -90);
    assert.equal(applyVelocityFriction(5, 10), 0);
    assert.equal(applyVelocityFriction(-5, 10), 0);
});

test("marble motion keeps the original low-speed and restitution thresholds", () => {
    const state = { x: 0, y: 0, vx: 0, vy: 0 };
    const next = advanceMarblePosition(
        state,
        { up: false, down: false, left: false, right: false },
        1 / 60,
    );

    assert.equal(next.vx, 0);
    assert.equal(next.vy, 0);

    const fastHit = resolveAxisCollision(100);
    assert.equal(fastHit.velocity, -40);
    assert.equal(fastHit.shouldPlaySound, true);

    const lightHit = resolveAxisCollision(25);
    assert.equal(lightHit.velocity, 0);
    assert.equal(lightHit.shouldPlaySound, false);

    assert.ok(MARBLE_STOP_SPEED === 30);
});

test("fixed-step accumulation prevents large catch-up jumps", () => {
    const result = advanceFixedStepAccumulator(
        FIXED_STEP_SECONDS * 1.5,
        FIXED_STEP_SECONDS * 0.75,
    );

    assert.equal(result.steps, 2);
    assert.ok(result.accumulator >= 0);
    assert.ok(result.accumulator < FIXED_STEP_SECONDS);
    assert.ok(result.frameDelta <= 0.25);
});

test("target activation and reset behaviour matches the level rules", () => {
    const marbles = [
        { x: 10, y: 10, vx: 0, vy: 0 },
        { x: 200, y: 200, vx: 0, vy: 0 },
    ];
    const targets = [{ x: 10, y: 10, radius: 20 }, { x: 300, y: 300, radius: 20 }];

    assert.equal(areAllTargetsActivated(marbles, targets), false);

    const reset = resetMarblesToStarts(marbles, [{ x: 12, y: 12 }, { x: 20, y: 20 }]);
    assert.deepEqual(reset[0], { x: 12, y: 12, vx: 0, vy: 0 });
    assert.deepEqual(reset[1], { x: 20, y: 20, vx: 0, vy: 0 });
});

test("tilt smoothing advances toward the requested amount", () => {
    assert.ok(Math.abs(smoothTilt(0, 3) - 0.15) < 1e-9);
    assert.ok(Math.abs(smoothTilt(3, 0) - 2.85) < 1e-9);
});
