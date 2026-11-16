import assert from "node:assert/strict";
import test from "node:test";

import {
    LEVEL_HEIGHT,
    LEVEL_WIDTH,
    TILE_END,
    TILE_GROUND,
    TILE_HOLE,
    TILE_START,
    TILE_WALL,
    auditLevel,
    decodeLevelPixels,
} from "./levelData";

function makeSingleMapPixels(): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(LEVEL_WIDTH * LEVEL_HEIGHT * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 255;
    }

    const startIndex = (0 * LEVEL_WIDTH + 1) * 4;
    pixels[startIndex] = 255;
    pixels[startIndex + 1] = 0;
    pixels[startIndex + 2] = 0;

    const targetIndex = (1 * LEVEL_WIDTH + 3) * 4;
    pixels[targetIndex] = 0;
    pixels[targetIndex + 1] = 255;
    pixels[targetIndex + 2] = 0;

    const holeIndex = (2 * LEVEL_WIDTH + 5) * 4;
    pixels[holeIndex] = 0;
    pixels[holeIndex + 1] = 0;
    pixels[holeIndex + 2] = 255;

    const groundIndex = (3 * LEVEL_WIDTH + 4) * 4;
    pixels[groundIndex] = 255;
    pixels[groundIndex + 1] = 255;
    pixels[groundIndex + 2] = 255;

    return pixels;
}

test("decodeLevelPixels maps source colors to original LD30 tile types", () => {
    const pixels = makeSingleMapPixels();
    const level = decodeLevelPixels(pixels, LEVEL_WIDTH, LEVEL_HEIGHT);

    assert.equal(level.cells[0][0], TILE_WALL);
    assert.equal(level.cells[0][1], TILE_START);
    assert.equal(level.cells[1][3], TILE_END);
    assert.equal(level.cells[2][5], TILE_HOLE);
    assert.equal(level.cells[3][4], TILE_GROUND);
    assert.deepEqual(level.starts, [{ x: 1, y: 0 }]);
    assert.deepEqual(level.targets, [{ x: 3, y: 1 }]);
    assert.deepEqual(level.holes, [{ x: 5, y: 2 }]);
});

test("decodeLevelPixels rejects invalid dimensions and unknown colors fall back to walls", () => {
    const invalidPixels = new Uint8ClampedArray((LEVEL_WIDTH * LEVEL_HEIGHT) * 4);
    assert.throws(
        () => decodeLevelPixels(invalidPixels, LEVEL_WIDTH, LEVEL_HEIGHT - 1),
        /20×15/,
    );

    const unknownPixels = new Uint8ClampedArray((LEVEL_WIDTH * LEVEL_HEIGHT) * 4);
    const idx = (0 * LEVEL_WIDTH + 0) * 4;
    unknownPixels[idx] = 12;
    unknownPixels[idx + 1] = 35;
    unknownPixels[idx + 2] = 99;
    assert.throws(
        () => decodeLevelPixels(unknownPixels, LEVEL_WIDTH, LEVEL_HEIGHT),
        /expected at least one start, target, and hole/i,
    );

    const knownFallback = new Uint8ClampedArray((LEVEL_WIDTH * LEVEL_HEIGHT) * 4);
    const startIndex = (0 * LEVEL_WIDTH + 1) * 4;
    knownFallback[startIndex] = 255;
    knownFallback[startIndex + 1] = 0;
    knownFallback[startIndex + 2] = 0;
    const targetIndex = (0 * LEVEL_WIDTH + 2) * 4;
    knownFallback[targetIndex] = 0;
    knownFallback[targetIndex + 1] = 255;
    knownFallback[targetIndex + 2] = 0;
    const holeIndex = (0 * LEVEL_WIDTH + 3) * 4;
    knownFallback[holeIndex] = 0;
    knownFallback[holeIndex + 1] = 0;
    knownFallback[holeIndex + 2] = 255;
    const wallIndex = (0 * LEVEL_WIDTH + 0) * 4;
    knownFallback[wallIndex] = 12;
    knownFallback[wallIndex + 1] = 35;
    knownFallback[wallIndex + 2] = 99;
    const castLevel = decodeLevelPixels(knownFallback, LEVEL_WIDTH, LEVEL_HEIGHT);
    assert.equal(castLevel.cells[0][0], TILE_WALL);
});

test("auditLevel exposes the counts needed for a level review", () => {
    const pixels = makeSingleMapPixels();
    const level = decodeLevelPixels(pixels, LEVEL_WIDTH, LEVEL_HEIGHT);
    const audit = auditLevel(level);

    assert.equal(audit.width, LEVEL_WIDTH);
    assert.equal(audit.height, LEVEL_HEIGHT);
    assert.equal(audit.startCount, 1);
    assert.equal(audit.targetCount, 1);
    assert.equal(audit.holeCount, 1);
    assert.ok(audit.wallCount > 0);
    assert.ok(audit.groundCount > 0);
});
