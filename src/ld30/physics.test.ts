import assert from "node:assert/strict";
import test from "node:test";

import {
    COLLISION_SOUND_THRESHOLD,
    FIXED_STEP_SECONDS,
    MARBLE_COLLIDER_SIZE,
    MARBLE_G,
    MARBLE_MU,
    MARBLE_RESTITUTION,
    MARBLE_SLOPE,
    MARBLE_STOP_SPEED,
    advanceFixedStepAccumulator,
    areAllTargetsActivated,
    isMarbleOverlappingHoleMask,
    isTargetActivated,
    resetMarblesToStarts,
    resolveAxisCollision,
    smoothTilt,
    stepMarble,
    updateMarbleMotion,
} from "./physics.ts";
import { TILE_GROUND, TILE_WALL } from "./levelData.ts";

const noInput = { up: false, down: false, left: false, right: false };

function openGrid(width = 5, height = 5) {
    return {
        cells: Array.from({ length: height }, () =>
            Array<number>(width).fill(TILE_GROUND),
        ),
        tileSize: 40,
    };
}

test("the original marble constants are preserved", () => {
    assert.equal(MARBLE_G, 980);
    assert.equal(MARBLE_MU, 0.08);
    assert.equal(MARBLE_RESTITUTION, 0.4);
    assert.equal(MARBLE_SLOPE, (1 - MARBLE_MU * Math.sqrt(3)) / 2);
});

test("directional acceleration and friction follow the source update order", () => {
    const diagonal = updateMarbleMotion(
        { x: 0, y: 0, vx: 0, vy: 0 },
        { up: true, down: false, left: false, right: true },
        FIXED_STEP_SECONDS,
    );
    assert.ok(diagonal.vx > 0);
    assert.ok(diagonal.vy < 0);
    assert.equal(diagonal.tiltAmount, 3);

    const activeAxisDoesNotReceiveFriction = updateMarbleMotion(
        { x: 0, y: 0, vx: 100, vy: 100 },
        { ...noInput, right: true },
        FIXED_STEP_SECONDS,
    );
    assert.ok(activeAxisDoesNotReceiveFriction.vx > 100);
    assert.ok(activeAxisDoesNotReceiveFriction.vy < 100);

    const opposingDirectionsCancelBeforeFriction = updateMarbleMotion(
        { x: 0, y: 0, vx: 100, vy: 0 },
        { up: false, down: false, left: true, right: true },
        FIXED_STEP_SECONDS,
    );
    assert.ok(opposingDirectionsCancelBeforeFriction.vx < 100);
    assert.equal(opposingDirectionsCancelBeforeFriction.tiltAmount, 0);

    const noInputMotion = updateMarbleMotion(
        { x: 0, y: 0, vx: 1, vy: -1 },
        noInput,
        FIXED_STEP_SECONDS,
    );
    assert.equal(noInputMotion.vx, 0);
    assert.equal(noInputMotion.vy, 0);
});

test("sensor acceleration changes marble velocity proportionally", () => {
    const motion = updateMarbleMotion(
        { x: 0, y: 0, vx: 0, vy: 0 },
        { ...noInput, accelerationX: 20 },
        0.1,
    );

    assert.equal(motion.vx, 2);
});

test("axis-separated wall collision prevents tunneling and applies restitution", () => {
    const grid = openGrid();
    grid.cells[1]![2] = TILE_WALL;
    const horizontal = stepMarble(
        { x: 50, y: 60, vx: 1200, vy: 0 },
        noInput,
        0.1,
        grid,
        [],
    );
    assert.ok(horizontal.state.x <= 68 && horizontal.state.x > 67);
    const horizontalBounceSpeed =
        (1200 - MARBLE_G * MARBLE_MU * 0.1) * MARBLE_RESTITUTION;
    assert.ok(Math.abs(horizontal.state.vx + horizontalBounceSpeed) < 1e-9);
    assert.ok(
        Math.abs(horizontal.collisionSoundSpeeds[0]! - horizontalBounceSpeed) <
            1e-9,
    );

    const verticalGrid = openGrid();
    verticalGrid.cells[2]![1] = TILE_WALL;
    const vertical = stepMarble(
        { x: 60, y: 50, vx: 0, vy: 1200 },
        noInput,
        0.1,
        verticalGrid,
        [],
    );
    assert.ok(vertical.state.y <= 68 && vertical.state.y > 67);
    assert.ok(Math.abs(vertical.state.vy + horizontalBounceSpeed) < 1e-9);
});

test("marble collisions are axis separated and respect stop and sound thresholds", () => {
    const grid = openGrid();
    const other = { x: 60, y: 60, vx: 0, vy: 0 };
    const marbleCollision = stepMarble(
        { x: 30, y: 60, vx: 600, vy: 0 },
        noInput,
        0.05,
        grid,
        [other],
    );

    assert.ok(marbleCollision.state.x <= 36 && marbleCollision.state.x > 35);
    const marbleBounceSpeed =
        (600 - MARBLE_G * MARBLE_MU * 0.05) * MARBLE_RESTITUTION;
    assert.ok(Math.abs(marbleCollision.state.vx + marbleBounceSpeed) < 1e-9);
    assert.ok(
        Math.abs(marbleCollision.collisionSoundSpeeds[0]! - marbleBounceSpeed) <
            1e-9,
    );

    const exactStopThreshold = stepMarble(
        { x: 50, y: 60, vx: MARBLE_STOP_SPEED, vy: 0 },
        noInput,
        0.1,
        grid,
        [{ x: 70, y: 60, vx: 0, vy: 0 }],
    );
    assert.equal(exactStopThreshold.state.vx, 0);

    assert.equal(
        resolveAxisCollision(COLLISION_SOUND_THRESHOLD / MARBLE_RESTITUTION)
            .shouldPlaySound,
        false,
    );
    assert.equal(resolveAxisCollision(90).shouldPlaySound, true);
});

test("hole overlap uses opaque mask pixels and resets every marble", () => {
    const width = 40;
    const height = 40;
    const alpha = new Uint8ClampedArray(width * height * 4);
    alpha[(20 * width + 20) * 4 + 3] = 255;

    assert.equal(
        isMarbleOverlappingHoleMask(
            { x: 30, y: 20 },
            { x: 0, y: 0 },
            alpha,
            width,
            height,
            40,
        ),
        true,
    );
    assert.equal(
        isMarbleOverlappingHoleMask(
            { x: 5, y: 20 },
            { x: 0, y: 0 },
            alpha,
            width,
            height,
            40,
        ),
        false,
    );

    const reset = resetMarblesToStarts(
        [
            { x: 100, y: 100, vx: 20, vy: 30 },
            { x: 200, y: 200, vx: -40, vy: -50 },
        ],
        [
            { x: 20, y: 20 },
            { x: 60, y: 20 },
        ],
    );
    assert.deepEqual(reset, [
        { x: 20, y: 20, vx: 0, vy: 0 },
        { x: 60, y: 20, vx: 0, vy: 0 },
    ]);
});

test("targets activate on marble overlap and completion requires every target", () => {
    const targets = [
        { x: 20, y: 20, width: 4, height: 4 },
        { x: 100, y: 100, width: 4, height: 4 },
    ];
    assert.equal(isTargetActivated({ x: 33, y: 20 }, targets[0]!), true);
    assert.equal(isTargetActivated({ x: 34, y: 20 }, targets[0]!), false);
    assert.equal(
        areAllTargetsActivated(
            [
                { x: 20, y: 20 },
                { x: 100, y: 100 },
            ],
            targets,
        ),
        true,
    );
    assert.equal(areAllTargetsActivated([{ x: 20, y: 20 }], targets), false);
});

test("fixed timestep is 60 Hz with bounded frame catch-up", () => {
    const normal = advanceFixedStepAccumulator(
        FIXED_STEP_SECONDS / 2,
        FIXED_STEP_SECONDS,
    );
    assert.equal(normal.steps, 1);
    assert.ok(normal.accumulator >= 0);
    assert.ok(normal.accumulator < FIXED_STEP_SECONDS);

    const stalled = advanceFixedStepAccumulator(0, 0.25);
    assert.equal(stalled.frameDelta, 0.1);
    assert.equal(stalled.steps, 5);
    assert.equal(stalled.droppedSteps, 1);
    assert.equal(stalled.accumulator, 0);
    assert.equal(MARBLE_COLLIDER_SIZE, 24);
});

test("board tilt smoothly approaches the input request", () => {
    assert.ok(Math.abs(smoothTilt(0, 3) - 0.15) < 1e-9);
    assert.ok(Math.abs(smoothTilt(3, 0) - 2.85) < 1e-9);
});
