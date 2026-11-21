import { TILE_WALL } from "./levelData.ts";

export const MARBLE_G = 980;
export const MARBLE_MU = 0.08;
export const MARBLE_RESTITUTION = 0.4;
export const MARBLE_SLOPE = (1 - MARBLE_MU * Math.sqrt(3)) / 2;
export const MARBLE_STOP_SPEED = 30;
export const COLLISION_SOUND_THRESHOLD = 35;
export const MARBLE_COLLIDER_SIZE = 24;
export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 0.1;
export const MAX_CATCH_UP_STEPS = 5;

const COLLISION_EPSILON = 1e-7;

export interface DirectionInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    accelerationX?: number;
    accelerationY?: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface MarbleState extends Point {
    vx: number;
    vy: number;
}

export interface TargetState extends Point {
    width: number;
    height: number;
}

export interface CollisionGrid {
    cells: readonly (readonly number[])[];
    tileSize: number;
}

export interface MarbleStepResult {
    state: MarbleState;
    tiltAmount: number;
    tiltDirection: number;
    collisionSoundSpeeds: number[];
}

export function xor(a: boolean, b: boolean): boolean {
    return a !== b;
}

export function applyVelocityFriction(value: number, friction: number): number {
    if (Math.abs(value) > friction && friction > 0) {
        return value - friction * Math.sign(value);
    }
    return 0;
}

export function updateMarbleMotion(
    state: MarbleState,
    input: DirectionInput,
    dt: number,
): {
    vx: number;
    vy: number;
    tiltDirection: number;
    tiltAmount: number;
} {
    let vx = state.vx;
    let vy = state.vy;

    const horizontalAcceleration =
        (Number(input.right) - Number(input.left)) * MARBLE_G * MARBLE_SLOPE +
        (input.accelerationX ?? 0);
    const verticalAcceleration =
        (Number(input.down) - Number(input.up)) * MARBLE_G * MARBLE_SLOPE +
        (input.accelerationY ?? 0);
    vx += horizontalAcceleration * dt;
    vy += verticalAcceleration * dt;

    const friction = MARBLE_G * MARBLE_MU * dt;
    if (verticalAcceleration === 0) {
        vy = applyVelocityFriction(vy, friction);
    }
    if (horizontalAcceleration === 0) {
        vx = applyVelocityFriction(vx, friction);
    }

    const tiltAmount =
        horizontalAcceleration !== 0 || verticalAcceleration !== 0 ? 3 : 0;

    return {
        vx,
        vy,
        tiltDirection:
            tiltAmount > 0
                ? (Math.atan2(horizontalAcceleration, verticalAcceleration) *
                      180) /
                  Math.PI
                : 0,
        tiltAmount,
    };
}

export function resolveAxisCollision(velocity: number): {
    velocity: number;
    shouldPlaySound: boolean;
} {
    if (Math.abs(velocity) > MARBLE_STOP_SPEED) {
        const bounced = -velocity * MARBLE_RESTITUTION;
        return {
            velocity: bounced,
            shouldPlaySound: Math.abs(bounced) > COLLISION_SOUND_THRESHOLD,
        };
    }

    return { velocity: 0, shouldPlaySound: false };
}

export function overlapsWall(
    x: number,
    y: number,
    grid: CollisionGrid,
    halfSize = MARBLE_COLLIDER_SIZE / 2,
): boolean {
    const minColumn = Math.floor(
        (x - halfSize + COLLISION_EPSILON) / grid.tileSize,
    );
    const maxColumn = Math.floor(
        (x + halfSize - COLLISION_EPSILON) / grid.tileSize,
    );
    const minRow = Math.floor(
        (y - halfSize + COLLISION_EPSILON) / grid.tileSize,
    );
    const maxRow = Math.floor(
        (y + halfSize - COLLISION_EPSILON) / grid.tileSize,
    );

    for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
            if (
                row < 0 ||
                column < 0 ||
                row >= grid.cells.length ||
                column >= (grid.cells[row]?.length ?? 0) ||
                grid.cells[row]?.[column] === TILE_WALL
            ) {
                return true;
            }
        }
    }

    return false;
}

export function overlapsAnotherMarble(
    x: number,
    y: number,
    others: readonly MarbleState[],
): boolean {
    const minimumDistance = MARBLE_COLLIDER_SIZE - COLLISION_EPSILON;
    return others.some(
        (other) =>
            Math.abs(x - other.x) < minimumDistance &&
            Math.abs(y - other.y) < minimumDistance,
    );
}

export function stepMarble(
    initialState: MarbleState,
    input: DirectionInput,
    dt: number,
    grid: CollisionGrid,
    otherMarbles: readonly MarbleState[],
): MarbleStepResult {
    const motion = updateMarbleMotion(initialState, input, dt);
    const state = { ...initialState, vx: motion.vx, vy: motion.vy };
    const collisionSoundSpeeds: number[] = [];

    for (const axis of ["x", "y"] as const) {
        const delta = state[axis === "x" ? "vx" : "vy"] * dt;
        const substeps = Math.max(1, Math.ceil(Math.abs(delta)));
        const step = delta / substeps;

        for (let index = 0; index < substeps; index += 1) {
            const nextX = state.x + (axis === "x" ? step : 0);
            const nextY = state.y + (axis === "y" ? step : 0);
            if (
                overlapsWall(nextX, nextY, grid) ||
                overlapsAnotherMarble(nextX, nextY, otherMarbles)
            ) {
                const velocityKey = axis === "x" ? "vx" : "vy";
                const collision = resolveAxisCollision(state[velocityKey]);
                state[velocityKey] = collision.velocity;
                if (collision.shouldPlaySound) {
                    collisionSoundSpeeds.push(Math.abs(collision.velocity));
                }
                break;
            }

            state.x = nextX;
            state.y = nextY;
        }
    }

    return {
        state,
        tiltAmount: motion.tiltAmount,
        tiltDirection: motion.tiltDirection,
        collisionSoundSpeeds,
    };
}

export function isTargetActivated(marble: Point, target: TargetState): boolean {
    const halfMarble = MARBLE_COLLIDER_SIZE / 2;
    return (
        Math.abs(marble.x - target.x) < halfMarble + target.width / 2 &&
        Math.abs(marble.y - target.y) < halfMarble + target.height / 2
    );
}

export function areAllTargetsActivated(
    marbles: readonly Point[],
    targets: readonly TargetState[],
): boolean {
    return targets.every((target) =>
        marbles.some((marble) => isTargetActivated(marble, target)),
    );
}

export function isMarbleOverlappingHoleMask(
    marble: Point,
    hole: Point,
    alpha: ArrayLike<number>,
    maskWidth: number,
    maskHeight: number,
    tileSize: number,
    halfSize = MARBLE_COLLIDER_SIZE / 2,
): boolean {
    const originX = hole.x * tileSize;
    const originY = hole.y * tileSize;
    const minX = Math.max(0, Math.floor(marble.x - halfSize - originX));
    const maxX = Math.min(
        maskWidth - 1,
        Math.ceil(marble.x + halfSize - originX) - 1,
    );
    const minY = Math.max(0, Math.floor(marble.y - halfSize - originY));
    const maxY = Math.min(
        maskHeight - 1,
        Math.ceil(marble.y + halfSize - originY) - 1,
    );

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const pixelCenterX = originX + x + 0.5;
            const pixelCenterY = originY + y + 0.5;
            const intersectsMarble =
                pixelCenterX >= marble.x - halfSize &&
                pixelCenterX < marble.x + halfSize &&
                pixelCenterY >= marble.y - halfSize &&
                pixelCenterY < marble.y + halfSize;
            if (
                intersectsMarble &&
                (alpha[(y * maskWidth + x) * 4 + 3] ?? 0) > 0
            ) {
                return true;
            }
        }
    }

    return false;
}

export function resetMarblesToStarts(
    marbles: readonly MarbleState[],
    starts: readonly Point[],
): MarbleState[] {
    return marbles.map((marble, index) => {
        const start = starts[index] ?? marble;
        return { x: start.x, y: start.y, vx: 0, vy: 0 };
    });
}

export function smoothTilt(
    currentAmount: number,
    requestedAmount: number,
    response = 1 / 20,
): number {
    return currentAmount + (requestedAmount - currentAmount) * response;
}

export function advanceFixedStepAccumulator(
    accumulator: number,
    frameDelta: number,
    maxFrameDelta = MAX_FRAME_DELTA_SECONDS,
    maxSteps = MAX_CATCH_UP_STEPS,
): {
    accumulator: number;
    steps: number;
    frameDelta: number;
    droppedSteps: number;
} {
    const boundedFrameDelta = Math.min(frameDelta, maxFrameDelta);
    const accumulated = accumulator + boundedFrameDelta;
    const availableSteps = Math.floor(accumulated / FIXED_STEP_SECONDS);
    const steps = Math.min(availableSteps, maxSteps);
    const remainder = accumulated - availableSteps * FIXED_STEP_SECONDS;

    return {
        accumulator:
            availableSteps > maxSteps
                ? remainder
                : accumulated - steps * FIXED_STEP_SECONDS,
        steps,
        frameDelta: boundedFrameDelta,
        droppedSteps: Math.max(0, availableSteps - steps),
    };
}
