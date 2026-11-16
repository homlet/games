export const MARBLE_G = 980;
export const MARBLE_MU = 0.08;
export const MARBLE_RESTITUTION = 0.4;
export const MARBLE_SLOPE = (1 - MARBLE_MU * Math.sqrt(3)) / 2;
export const MARBLE_STOP_SPEED = 30;
export const COLLISION_SOUND_THRESHOLD = 35;
export const FIXED_STEP_SECONDS = 1 / 60;

export interface DirectionInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
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
    radius: number;
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

export function applyDirectionalAcceleration(
    input: DirectionInput,
    dt: number,
): { vx: number; vy: number } {
    let vx = 0;
    let vy = 0;

    if (input.up) {
        vy -= MARBLE_G * MARBLE_SLOPE * dt;
    }
    if (input.down) {
        vy += MARBLE_G * MARBLE_SLOPE * dt;
    }
    if (input.left) {
        vx -= MARBLE_G * MARBLE_SLOPE * dt;
    }
    if (input.right) {
        vx += MARBLE_G * MARBLE_SLOPE * dt;
    }

    return { vx, vy };
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
    const acceleration = applyDirectionalAcceleration(input, dt);
    let vx = state.vx + acceleration.vx;
    let vy = state.vy + acceleration.vy;

    const friction = MARBLE_G * MARBLE_MU * dt;
    if (!xor(input.up, input.down)) {
        vy = applyVelocityFriction(vy, friction);
    }
    if (!xor(input.left, input.right)) {
        vx = applyVelocityFriction(vx, friction);
    }

    const dx = Number(input.right) - Number(input.left);
    const dy = Number(input.down) - Number(input.up);
    const tiltDirection = dx !== 0 || dy !== 0 ? (Math.atan2(dx, dy) * 180) / Math.PI : 0;
    const tiltAmount = xor(input.left, input.right) || xor(input.up, input.down) ? 3 : 0;

    return { vx, vy, tiltDirection, tiltAmount };
}

export function advanceMarblePosition(
    state: MarbleState,
    input: DirectionInput,
    dt: number,
): MarbleState {
    const nextMotion = updateMarbleMotion(state, input, dt);
    return {
        ...state,
        x: state.x + nextMotion.vx * dt,
        y: state.y + nextMotion.vy * dt,
        vx: nextMotion.vx,
        vy: nextMotion.vy,
    };
}

export function resolveAxisCollision(velocity: number): {
    velocity: number;
    shouldPlaySound: boolean;
} {
    const magnitude = Math.abs(velocity);
    if (magnitude > MARBLE_STOP_SPEED) {
        const bounced = -velocity * MARBLE_RESTITUTION;
        return {
            velocity: bounced,
            shouldPlaySound: Math.abs(bounced) > COLLISION_SOUND_THRESHOLD,
        };
    }

    return {
        velocity: 0,
        shouldPlaySound: false,
    };
}

export function isTargetActivated(
    marble: Point,
    target: TargetState,
): boolean {
    return Math.hypot(marble.x - target.x, marble.y - target.y) <= target.radius;
}

export function areAllTargetsActivated(
    marbles: Point[],
    targets: TargetState[],
): boolean {
    return targets.every((target) =>
        marbles.some((marble) => isTargetActivated(marble, target)),
    );
}

export function resetMarblesToStarts(
    marbles: MarbleState[],
    starts: readonly Point[],
): MarbleState[] {
    return marbles.map((marble, index) => {
        const start = starts[index] ?? { x: marble.x, y: marble.y };
        return {
            ...marble,
            x: start.x,
            y: start.y,
            vx: 0,
            vy: 0,
        };
    });
}

export function smoothTilt(
    currentAmount: number,
    requestedAmount: number,
    response: number = 1 / 20,
): number {
    return currentAmount + (requestedAmount - currentAmount) * response;
}

export function advanceFixedStepAccumulator(
    accumulator: number,
    frameDelta: number,
    limitFrameDelta: number = 0.25,
): {
    accumulator: number;
    steps: number;
    frameDelta: number;
} {
    const boundedFrameDelta = Math.min(frameDelta, limitFrameDelta);
    const nextAccumulator = accumulator + boundedFrameDelta;
    const steps = Math.floor(nextAccumulator / FIXED_STEP_SECONDS);

    return {
        accumulator: nextAccumulator - steps * FIXED_STEP_SECONDS,
        steps,
        frameDelta: boundedFrameDelta,
    };
}
