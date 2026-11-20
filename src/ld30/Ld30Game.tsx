import { useEffect, useRef, useState } from "react";
import * as ex from "excalibur";
import {
    ld30ImageAssets,
    ld30LevelMapAssets,
    ld30FontFamily,
    ld30SoundAssets,
    loadLd30Font,
    validateLd30Assets,
} from "./assets";
import { Ld30AudioManager } from "./audio";
import {
    TILE_SIZE,
    auditLevel,
    decodeLevelFromImageData,
    type DecodedLevel,
} from "./levelData";
import {
    FIXED_STEP_SECONDS,
    MARBLE_COLLIDER_SIZE,
    advanceFixedStepAccumulator,
    isMarbleOverlappingHoleMask,
    isTargetActivated,
    resetMarblesToStarts,
    smoothTilt,
    stepMarble,
    type DirectionInput,
    type MarbleState,
    type Point,
    type TargetState,
} from "./physics";
import { getOrientationDirectionInput } from "./mobileControls";
import {
    HOMLETMOO_RECORD_SECONDS,
    MIN_END_DELAY_MS,
    PAR_SECONDS,
    SPLASH_DURATION_MS,
    formatElapsedTime,
    getFlashpunkFrame,
    shouldRestartAfterEndDelay,
    shouldStartLevelFromReleasedKey,
} from "./sceneTiming";
import "./Ld30Game.css";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CANVAS_BG = new ex.Color(82, 62, 41);
const MAX_FRAME_DELTA_MS = 40;
const MARBLE_DRAW_SIZE = 32;

type SceneName = "splash" | "menu" | "level" | "end";

interface MarbleRuntime {
    actor: ex.Actor;
    state: MarbleState;
    start: Point;
}

interface EffectParticle {
    actor: ex.Actor;
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    duration: number;
    frameStart: number;
    frameCount: number;
    frameIndex: number;
    animated: boolean;
}

interface LevelRuntime {
    cells: DecodedLevel["cells"];
    marbles: MarbleRuntime[];
    targets: TargetState[];
    litTargets: boolean[];
    holes: Point[];
    holeAlpha: Uint8ClampedArray;
    holeMaskWidth: number;
    holeMaskHeight: number;
    accumulator: number;
    tiltAmount: number;
    tiltDirection: number;
    effects: EffectParticle[];
}

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
        image.src = src;
    });

const readImageData = async (src: string): Promise<ImageData> => {
    const image = await loadImageElement(src);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
};

const emitEffect = (
    scene: ex.Scene,
    sprites: readonly ex.Sprite[],
    effects: EffectParticle[],
    position: Point,
    kind: "death" | "spawn",
): void => {
    const count = kind === "death" ? 1 : 8;
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        const speed = kind === "spawn" ? 20 + ((index * 7) % 31) : 0;
        const actor = new ex.Actor({
            x: position.x,
            y: position.y,
            width: MARBLE_DRAW_SIZE,
            height: MARBLE_DRAW_SIZE,
            collisionType: ex.CollisionType.PreventCollision,
            z: 3,
        });
        const frameStart = kind === "death" ? 0 : 5;
        const frameCount = kind === "death" ? 5 : 4;
        const animated = kind === "death";
        const frameIndex = animated
            ? 0
            : Math.floor(Math.random() * frameCount);
        const frame = frameStart + frameIndex;
        actor.graphics.use(sprites[frame]!.clone());
        scene.add(actor);
        effects.push({
            actor,
            x: position.x,
            y: position.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            duration: kind === "death" ? 450 : 500,
            frameStart,
            frameCount,
            frameIndex,
            animated,
        });
    }
};

const updateEffects = (
    effects: EffectParticle[],
    sprites: readonly ex.Sprite[],
    elapsedMs: number,
): void => {
    for (let index = effects.length - 1; index >= 0; index -= 1) {
        const effect = effects[index]!;
        effect.age += elapsedMs;
        const progress = Math.min(effect.age / effect.duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;
        if (effect.animated) {
            const frameIndex = Math.min(
                Math.floor(progress * effect.frameCount),
                effect.frameCount - 1,
            );
            if (frameIndex !== effect.frameIndex) {
                effect.frameIndex = frameIndex;
                effect.actor.graphics.use(
                    sprites[effect.frameStart + frameIndex]!.clone(),
                );
            }
        }
        effect.actor.pos.setTo(
            effect.x + effect.vx * (effect.duration / 1000) * easedProgress,
            effect.y + effect.vy * (effect.duration / 1000) * easedProgress,
        );

        if (progress === 1) {
            effect.actor.kill();
            effects.splice(index, 1);
        }
    }
};

const getTileSprites = (tileSheet: ex.ImageSource) => {
    return Array.from({ length: 5 }, (_, index) =>
        ex.Sprite.from(tileSheet, {
            sourceView: {
                x: index * 10,
                y: 0,
                width: 10,
                height: 10,
            },
            destSize: {
                width: TILE_SIZE,
                height: TILE_SIZE,
            },
        }),
    );
};

const renderLevelBoard = async (
    scene: ex.Scene,
    levelIndex: number,
): Promise<LevelRuntime> => {
    const sourceUrl = ld30LevelMapAssets[levelIndex];
    const source = new ex.ImageSource(sourceUrl);
    await source.load();

    const imageData = await readImageData(sourceUrl);
    const level = decodeLevelFromImageData(imageData);
    const audit = auditLevel(level);
    console.info(
        `LD30 level ${levelIndex + 1} audit: ${audit.startCount} start(s), ${audit.targetCount} target(s), ${audit.holeCount} hole(s)`,
        { starts: level.starts, targets: level.targets },
    );

    const tilesSource = new ex.ImageSource(ld30ImageAssets.tiles);
    await tilesSource.load();
    const tileSprites = getTileSprites(tilesSource);

    const tileMap = new ex.TileMap({
        columns: level.width,
        rows: level.height,
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
    });
    tileMap.z = 0;

    for (let y = 0; y < level.height; y += 1) {
        for (let x = 0; x < level.width; x += 1) {
            const cell = tileMap.getTile(x, y);
            if (!cell) {
                continue;
            }

            const tileType = level.cells[y][x];
            const tileGraphic = tileSprites[tileType];
            if (tileGraphic) {
                cell.addGraphic(tileGraphic);
            }
        }
    }

    const holeSource = new ex.ImageSource(ld30ImageAssets.holeMask);
    await holeSource.load();
    const holeGraphic = ex.Sprite.from(holeSource, {
        destSize: { width: TILE_SIZE, height: TILE_SIZE },
    });
    const holeImageData = await readImageData(ld30ImageAssets.holeMask);

    const marbleSource = new ex.ImageSource(ld30ImageAssets.marble);
    await marbleSource.load();
    const marbleGraphic = ex.Sprite.from(marbleSource, {
        destSize: { width: MARBLE_DRAW_SIZE, height: MARBLE_DRAW_SIZE },
    });

    const marbles: MarbleRuntime[] = [];
    for (const start of level.starts) {
        const startPosition = {
            x: start.x * TILE_SIZE + TILE_SIZE / 2,
            y: start.y * TILE_SIZE + TILE_SIZE / 2,
        };
        const marble = new ex.Actor({
            x: startPosition.x,
            y: startPosition.y,
            width: MARBLE_DRAW_SIZE,
            height: MARBLE_DRAW_SIZE,
            collisionType: ex.CollisionType.PreventCollision,
            z: 2,
        });
        marble.graphics.use(marbleGraphic.clone());
        scene.add(marble);
        marbles.push({
            actor: marble,
            start: startPosition,
            state: { ...startPosition, vx: 0, vy: 0 },
        });
    }

    const targets = level.targets.map((target) => ({
        x: target.x * TILE_SIZE + TILE_SIZE / 2,
        y: target.y * TILE_SIZE + TILE_SIZE / 2,
        width: 4,
        height: 4,
    }));

    for (const hole of level.holes) {
        const holeActor = new ex.Actor({
            x: hole.x * TILE_SIZE + TILE_SIZE / 2,
            y: hole.y * TILE_SIZE + TILE_SIZE / 2,
            width: TILE_SIZE,
            height: TILE_SIZE,
            collisionType: ex.CollisionType.PreventCollision,
            z: 1,
        });
        holeActor.graphics.use(holeGraphic.clone());
        scene.add(holeActor);
    }

    scene.add(tileMap);
    return {
        cells: level.cells,
        marbles,
        targets,
        litTargets: targets.map(() => false),
        holes: level.holes,
        holeAlpha: new Uint8ClampedArray(holeImageData.data),
        holeMaskWidth: holeImageData.width,
        holeMaskHeight: holeImageData.height,
        accumulator: 0,
        tiltAmount: 0,
        tiltDirection: 0,
        effects: [],
    };
};

export function Ld30Game() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading",
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [controlHint, setControlHint] = useState(
        "Touch to advance • Tilt to steer • Arrows / WASD",
    );
    const engineRef = useRef<ex.Engine | null>(null);
    const audioRef = useRef<Ld30AudioManager | null>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }

        let cancelled = false;

        const bootstrapEngine = async () => {
            try {
                validateLd30Assets();
                await loadLd30Font();

                const canvas = document.createElement("canvas");
                canvas.width = CANVAS_WIDTH;
                canvas.height = CANVAS_HEIGHT;
                canvas.classList.add("ld30-canvas");
                canvas.setAttribute("aria-label", "Marble Run game canvas");
                canvas.setAttribute("tabindex", "0");
                host.replaceChildren(canvas);
                let motionPermissionRequested = false;
                const requestMotionPermission = async () => {
                    if (motionPermissionRequested) {
                        return;
                    }
                    motionPermissionRequested = true;

                    if (!("DeviceOrientationEvent" in window)) {
                        if (!cancelled) {
                            setControlHint(
                                "Tilt unavailable • Touch to advance • Arrows / WASD",
                            );
                        }
                        return;
                    }

                    const orientationEvent =
                        window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
                            requestPermission?: () => Promise<PermissionState>;
                        };
                    try {
                        if (
                            typeof orientationEvent.requestPermission ===
                            "function"
                        ) {
                            const permission =
                                await orientationEvent.requestPermission();
                            if (permission !== "granted") {
                                if (!cancelled) {
                                    setControlHint(
                                        "Motion access denied • Touch to advance • Arrows / WASD",
                                    );
                                }
                                return;
                            }
                        }
                        if (!cancelled) {
                            setControlHint(
                                "Touch to advance • Tilt enabled • Arrows / WASD",
                            );
                        }
                    } catch (error) {
                        console.warn(
                            "LD30 motion permission could not be requested.",
                            error,
                        );
                        if (!cancelled) {
                            setControlHint(
                                "Motion unavailable • Touch to advance • Arrows / WASD",
                            );
                        }
                    }
                };

                const engine = new ex.Engine({
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    antialiasing: false,
                    backgroundColor: CANVAS_BG,
                    canvasElement: canvas,
                    suppressPlayButton: true,
                });

                const backgroundSource = new ex.ImageSource(
                    ld30ImageAssets.background,
                );
                const titleSource = new ex.ImageSource(ld30ImageAssets.title);
                const hmSource = new ex.ImageSource(ld30ImageAssets.hmLogo);
                const flashpunkSource = new ex.ImageSource(
                    ld30ImageAssets.flashpunkLogo,
                );
                const foregroundSource = new ex.ImageSource(
                    ld30ImageAssets.foreground,
                );
                const particleSource = new ex.ImageSource(
                    ld30ImageAssets.marbleParts,
                );

                await Promise.all([
                    backgroundSource.load(),
                    titleSource.load(),
                    hmSource.load(),
                    flashpunkSource.load(),
                    foregroundSource.load(),
                    particleSource.load(),
                ]);

                const backgroundSprite = ex.Sprite.from(backgroundSource, {
                    destSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                });
                const titleSprite = ex.Sprite.from(titleSource, {
                    destSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                });
                const hmSprite = ex.Sprite.from(hmSource, {
                    destSize: { width: 240, height: 240 },
                });
                const flashpunkSprite = ex.Sprite.from(flashpunkSource, {
                    sourceView: { x: 0, y: 0, width: 100, height: 100 },
                    destSize: { width: 400, height: 400 },
                });
                const foregroundSprite = ex.Sprite.from(foregroundSource, {
                    destSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                });
                const particleSprites = Array.from({ length: 9 }, (_, index) =>
                    ex.Sprite.from(particleSource, {
                        sourceView: {
                            x: index * 8,
                            y: 0,
                            width: 8,
                            height: 8,
                        },
                        destSize: {
                            width: MARBLE_DRAW_SIZE,
                            height: MARBLE_DRAW_SIZE,
                        },
                    }),
                );
                const hitSounds = [
                    ld30SoundAssets.hit1,
                    ld30SoundAssets.hit2,
                    ld30SoundAssets.hit3,
                    ld30SoundAssets.hit4,
                    ld30SoundAssets.hit5,
                    ld30SoundAssets.hit6,
                    ld30SoundAssets.hit7,
                    ld30SoundAssets.hit8,
                ] as const;
                const holeSounds = [
                    ld30SoundAssets.hole1,
                    ld30SoundAssets.hole2,
                    ld30SoundAssets.hole3,
                ] as const;
                const audioManager = new Ld30AudioManager({
                    bell: ld30SoundAssets.bell,
                    roll: ld30SoundAssets.roll,
                    hit: hitSounds,
                    hole: holeSounds,
                });
                audioRef.current = audioManager;
                audioManager.installGestureUnlock();
                void audioManager.preload().then((failures) => {
                    if (failures.length > 0) {
                        console.warn(
                            `LD30 loaded with ${failures.length} unavailable audio asset(s).`,
                            failures,
                        );
                    }
                });
                let activeLevelRuntime: LevelRuntime | null = null;
                const heldKeys = new Set<string>();
                const movementKeys = new Set([
                    "arrowup",
                    "arrowdown",
                    "arrowleft",
                    "arrowright",
                    "w",
                    "a",
                    "s",
                    "d",
                ]);
                let orientationInput: DirectionInput = {
                    up: false,
                    down: false,
                    left: false,
                    right: false,
                };
                const handleGameplayKeyDown = (event: KeyboardEvent) => {
                    const key = event.key.toLowerCase();
                    if (
                        movementKeys.has(key) &&
                        rootRef.current?.contains(document.activeElement)
                    ) {
                        event.preventDefault();
                        heldKeys.add(key);
                    }
                };
                const handleGameplayKeyUp = (event: KeyboardEvent) => {
                    heldKeys.delete(event.key.toLowerCase());
                };
                const clearInputs = () => {
                    heldKeys.clear();
                    orientationInput = {
                        up: false,
                        down: false,
                        left: false,
                        right: false,
                    };
                };
                const getDirectionInput = (): DirectionInput => ({
                    up:
                        heldKeys.has("arrowup") ||
                        heldKeys.has("w") ||
                        orientationInput.up,
                    down:
                        heldKeys.has("arrowdown") ||
                        heldKeys.has("s") ||
                        orientationInput.down,
                    left:
                        heldKeys.has("arrowleft") ||
                        heldKeys.has("a") ||
                        orientationInput.left,
                    right:
                        heldKeys.has("arrowright") ||
                        heldKeys.has("d") ||
                        orientationInput.right,
                });
                const handleDeviceOrientation = (
                    event: DeviceOrientationEvent,
                ) => {
                    orientationInput = getOrientationDirectionInput(
                        event.beta,
                        event.gamma,
                    );
                };
                const requestMotionPermissionFromTouch = () => {
                    void requestMotionPermission();
                };
                const gameClock = {
                    sceneName: "splash" as SceneName,
                    levelIndex: 0,
                    totalElapsedMs: 0,
                    levelElapsedMs: 0,
                    endStartedAt: 0,
                    transitionLocked: false,
                };

                const transitionToScene = async (
                    nextScene: SceneName,
                    nextLevelIndex = 0,
                ) => {
                    if (gameClock.transitionLocked) {
                        return;
                    }

                    gameClock.transitionLocked = true;
                    if (nextScene !== "level") {
                        audioManager.stopRollingLoop();
                    }
                    gameClock.sceneName = nextScene;
                    gameClock.levelIndex = nextLevelIndex;

                    if (nextScene === "menu") {
                        gameClock.totalElapsedMs = 0;
                        gameClock.levelElapsedMs = 0;
                    }

                    if (nextScene === "level") {
                        gameClock.levelElapsedMs = 0;
                        if (nextLevelIndex === 0) {
                            gameClock.totalElapsedMs = 0;
                        }
                    }

                    if (nextScene === "end") {
                        gameClock.endStartedAt = Date.now();
                    }

                    await engine.goToScene(nextScene);
                    gameClock.transitionLocked = false;
                };

                const splashScene = new ex.Scene();
                const splashHmActor = new ex.Actor({
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    width: 240,
                    height: 240,
                    z: 2,
                });
                splashHmActor.graphics.use(hmSprite.clone());
                splashHmActor.graphics.opacity = 0;

                const splashFlashpunkActor = new ex.Actor({
                    x: 200,
                    y: 400,
                    width: 400,
                    height: 400,
                    z: 1,
                });
                splashFlashpunkActor.graphics.use(flashpunkSprite.clone());
                splashFlashpunkActor.graphics.opacity = 0;
                splashScene.add(splashHmActor);
                splashScene.add(splashFlashpunkActor);

                splashScene.onPreUpdate = (_, elapsed) => {
                    gameClock.totalElapsedMs += Math.min(
                        elapsed,
                        MAX_FRAME_DELTA_MS,
                    );
                    const progress = Math.min(
                        gameClock.totalElapsedMs / SPLASH_DURATION_MS,
                        1,
                    );
                    const elapsedMs = Math.min(
                        gameClock.totalElapsedMs,
                        SPLASH_DURATION_MS,
                    );
                    const flashFrame = getFlashpunkFrame(elapsedMs);
                    splashFlashpunkActor.graphics.use(
                        ex.Sprite.from(flashpunkSource, {
                            sourceView: {
                                x: flashFrame * 100,
                                y: 0,
                                width: 100,
                                height: 100,
                            },
                            destSize: { width: 400, height: 400 },
                        }),
                    );

                    let fpAlpha = 0;
                    let hmAlpha = 0;
                    if (elapsedMs < 800) {
                        const t = elapsedMs / 800;
                        fpAlpha = 1 - (1 - t) ** 2;
                    } else if (elapsedMs < 1600) {
                        fpAlpha = 1;
                    } else if (elapsedMs < 2100) {
                        fpAlpha = 1 - (elapsedMs - 1600) / 500;
                    } else if (elapsedMs < 2900) {
                        const t = (elapsedMs - 2100) / 800;
                        hmAlpha = 1 - (1 - t) ** 2;
                    } else if (elapsedMs < 3700) {
                        hmAlpha = 1;
                    } else {
                        hmAlpha = 1 - (elapsedMs - 3700) / 500;
                    }
                    splashFlashpunkActor.graphics.opacity = fpAlpha;
                    splashHmActor.graphics.opacity = hmAlpha;

                    if (gameClock.totalElapsedMs >= SPLASH_DURATION_MS) {
                        void transitionToScene("menu");
                    }
                };

                const menuScene = new ex.Scene();
                let menuScrollOffset = 0;
                const menuBackgroundA = new ex.Actor({
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                });
                menuBackgroundA.graphics.use(backgroundSprite.clone());
                menuScene.add(menuBackgroundA);

                const menuBackgroundB = new ex.Actor({
                    x: CANVAS_WIDTH / 2 + CANVAS_WIDTH,
                    y: CANVAS_HEIGHT / 2,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                });
                menuBackgroundB.graphics.use(backgroundSprite.clone());
                menuScene.add(menuBackgroundB);

                const titleActor = new ex.Actor({
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                });
                titleActor.graphics.use(titleSprite.clone());
                titleActor.graphics.opacity = 0;
                menuScene.add(titleActor);

                menuScene.onPreUpdate = (_, elapsed) => {
                    const safeDelta = Math.min(elapsed, MAX_FRAME_DELTA_MS);
                    gameClock.levelElapsedMs += safeDelta;
                    const fadeProgress = Math.min(
                        gameClock.levelElapsedMs / 1200,
                        1,
                    );
                    titleActor.graphics.opacity = fadeProgress;
                    menuScrollOffset =
                        (menuScrollOffset - (safeDelta / 1000) * 50) %
                        CANVAS_WIDTH;
                    menuBackgroundA.pos.x =
                        CANVAS_WIDTH / 2 + menuScrollOffset;
                    menuBackgroundB.pos.x =
                        CANVAS_WIDTH / 2 +
                        CANVAS_WIDTH +
                        menuScrollOffset;
                };

                menuScene.onActivate = () => {
                    titleActor.graphics.opacity = 0;
                    gameClock.levelElapsedMs = 0;
                    menuScrollOffset = 0;
                    const handleStart = (event: KeyboardEvent) => {
                        if (!rootRef.current?.contains(document.activeElement)) {
                            return;
                        }
                        if (!shouldStartLevelFromReleasedKey(event.repeat)) {
                            return;
                        }
                        event.preventDefault();
                        void transitionToScene("level", 0);
                    };
                    const handleStartFromTouch = (event: TouchEvent) => {
                        event.preventDefault();
                        requestMotionPermissionFromTouch();
                        void transitionToScene("level", 0);
                    };
                    window.addEventListener("keyup", handleStart, {
                        passive: false,
                    });
                    canvas.addEventListener(
                        "touchstart",
                        handleStartFromTouch,
                        { passive: false },
                    );
                    menuScene.onDeactivate = () => {
                        window.removeEventListener("keyup", handleStart);
                        canvas.removeEventListener(
                            "touchstart",
                            handleStartFromTouch,
                        );
                    };
                };

                const levelScene = new ex.Scene();
                const timerLabel = new ex.Label({
                    text: "0:00",
                    x: 16,
                    y: 16,
                    color: ex.Color.fromHex("#EDCF9B"),
                    font: new ex.Font({
                        size: 32,
                        family: ld30FontFamily,
                        textAlign: ex.TextAlign.Left,
                        baseAlign: ex.BaseAlign.Top,
                    }),
                });
                timerLabel.opacity = 1;
                timerLabel.z = 20;
                levelScene.add(timerLabel);

                const renderLevelForScene = async (): Promise<LevelRuntime> => {
                    activeLevelRuntime = null;
                    for (const actor of [...levelScene.actors]) {
                        actor.kill();
                    }

                    levelScene.add(timerLabel);
                    const runtime = await renderLevelBoard(
                        levelScene,
                        gameClock.levelIndex,
                    );
                    const finalText = formatElapsedTime(
                        gameClock.totalElapsedMs,
                    );
                    timerLabel.text = finalText;
                    return runtime;
                };

                const handleVisibilityChange = () => {
                        clearInputs();
                        if (activeLevelRuntime) {
                            activeLevelRuntime.accumulator = 0;
                        }
                };
                levelScene.onActivate = () => {
                    gameClock.levelElapsedMs = 0;
                    clearInputs();
                    void audioManager.unlock().then(() => {
                        audioManager.startRollingLoop();
                        audioManager.playBell();
                    });
                    window.addEventListener("keydown", handleGameplayKeyDown, {
                        passive: false,
                    });
                    window.addEventListener("keyup", handleGameplayKeyUp);
                    window.addEventListener("blur", clearInputs);
                    window.addEventListener(
                        "deviceorientation",
                        handleDeviceOrientation,
                    );
                    canvas.addEventListener(
                        "touchstart",
                        requestMotionPermissionFromTouch,
                        { passive: true },
                    );
                    document.addEventListener(
                        "visibilitychange",
                        handleVisibilityChange,
                    );
                    void renderLevelForScene()
                        .then((runtime) => {
                            if (cancelled || gameClock.sceneName !== "level") {
                                return;
                            }
                            activeLevelRuntime = runtime;
                            for (const marble of runtime.marbles) {
                                emitEffect(
                                    levelScene,
                                    particleSprites,
                                    runtime.effects,
                                    marble.start,
                                    "spawn",
                                );
                            }
                        })
                        .catch((error: unknown) => {
                            if (cancelled) {
                                return;
                            }
                            const message =
                                error instanceof Error
                                    ? error.message
                                    : "LD30 level failed to load.";
                            console.error("LD30 level failed to load.", error);
                            setStatus("error");
                            setErrorMessage(message);
                        });
                    levelScene.onDeactivate = () => {
                        activeLevelRuntime = null;
                        clearInputs();
                        audioManager.stopRollingLoop();
                        window.removeEventListener(
                            "keydown",
                            handleGameplayKeyDown,
                        );
                        window.removeEventListener(
                            "keyup",
                            handleGameplayKeyUp,
                        );
                        window.removeEventListener("blur", clearInputs);
                        window.removeEventListener(
                            "deviceorientation",
                            handleDeviceOrientation,
                        );
                        canvas.removeEventListener(
                            "touchstart",
                            requestMotionPermissionFromTouch,
                        );
                        document.removeEventListener(
                            "visibilitychange",
                            handleVisibilityChange,
                        );
                        canvas.style.transform = "";
                        canvas.style.transformOrigin = "";
                    };
                };

                levelScene.onPreUpdate = (_, elapsed) => {
                    if (document.hidden || gameClock.transitionLocked) {
                        return;
                    }
                    const safeDelta = Math.min(elapsed, MAX_FRAME_DELTA_MS);
                    gameClock.levelElapsedMs += safeDelta;
                    gameClock.totalElapsedMs += safeDelta;
                    timerLabel.text = formatElapsedTime(
                        gameClock.totalElapsedMs,
                    );

                    const runtime = activeLevelRuntime;
                    if (!runtime) {
                        return;
                    }

                    const fixedStep = advanceFixedStepAccumulator(
                        runtime.accumulator,
                        safeDelta / 1000,
                    );
                    runtime.accumulator = fixedStep.accumulator;
                    const collisionGrid = {
                        cells: runtime.cells,
                        tileSize: TILE_SIZE,
                    };
                    let completed = false;

                    for (let step = 0; step < fixedStep.steps; step += 1) {
                        const input = getDirectionInput();
                        let requestedTiltAmount = 0;
                        for (
                            let marbleIndex = 0;
                            marbleIndex < runtime.marbles.length;
                            marbleIndex += 1
                        ) {
                            const marble = runtime.marbles[marbleIndex]!;
                            const otherMarbles = runtime.marbles
                                .filter((_, index) => index !== marbleIndex)
                                .map((other) => other.state);
                            const result = stepMarble(
                                marble.state,
                                input,
                                FIXED_STEP_SECONDS,
                                collisionGrid,
                                otherMarbles,
                            );
                            marble.state = result.state;
                            marble.actor.pos.setTo(
                                result.state.x,
                                result.state.y,
                            );
                            for (const speed of result.collisionSoundSpeeds) {
                                audioManager.playNextHit(
                                    speed,
                                    result.state.x,
                                    CANVAS_WIDTH,
                                );
                            }
                            if (result.tiltAmount > 0) {
                                runtime.tiltDirection = result.tiltDirection;
                                requestedTiltAmount = result.tiltAmount;
                            }
                        }

                        runtime.tiltAmount = smoothTilt(
                            runtime.tiltAmount,
                            requestedTiltAmount,
                        );
                        updateEffects(
                            runtime.effects,
                            particleSprites,
                            FIXED_STEP_SECONDS * 1000,
                        );

                        const fallenHole = runtime.marbles.flatMap((marble) =>
                            runtime.holes
                                .filter((hole) =>
                                    isMarbleOverlappingHoleMask(
                                        marble.state,
                                        hole,
                                        runtime.holeAlpha,
                                        runtime.holeMaskWidth,
                                        runtime.holeMaskHeight,
                                        TILE_SIZE,
                                    ),
                                )
                                .map((hole) => ({ marble, hole })),
                        )[0];
                        if (fallenHole) {
                            const resetStates = resetMarblesToStarts(
                                runtime.marbles.map((marble) => marble.state),
                                runtime.marbles.map((marble) => marble.start),
                            );
                            const holePosition = {
                                x:
                                    fallenHole.hole.x * TILE_SIZE +
                                    TILE_SIZE / 2,
                                y:
                                    fallenHole.hole.y * TILE_SIZE +
                                    TILE_SIZE / 2,
                            };
                            runtime.marbles.forEach((marble, index) => {
                                emitEffect(
                                    levelScene,
                                    particleSprites,
                                    runtime.effects,
                                    holePosition,
                                    "death",
                                );
                                marble.state = resetStates[index]!;
                                marble.actor.pos.setTo(
                                    marble.start.x,
                                    marble.start.y,
                                );
                                emitEffect(
                                    levelScene,
                                    particleSprites,
                                    runtime.effects,
                                    marble.start,
                                    "spawn",
                                );
                            });
                            audioManager.playNextHole(
                                holePosition.x,
                                CANVAS_WIDTH,
                            );
                        }

                        runtime.litTargets = runtime.targets.map((target) =>
                            runtime.marbles.some((marble) =>
                                isTargetActivated(marble.state, target),
                            ),
                        );
                        if (runtime.litTargets.every(Boolean)) {
                            completed = true;
                            break;
                        }
                    }

                    if (runtime.marbles.length > 0) {
                        const averageSpeed =
                            runtime.marbles.reduce(
                                (sum, marble) =>
                                    sum +
                                    Math.hypot(
                                        marble.state.vx,
                                        marble.state.vy,
                                    ),
                                0,
                            ) / runtime.marbles.length;
                        audioManager.updateRollingVolume(averageSpeed);
                    }

                    if (runtime.tiltAmount > 0 || runtime.tiltDirection !== 0) {
                        const direction =
                            (runtime.tiltDirection * Math.PI) / 180;
                        const axisX = Math.cos(direction);
                        const axisY = -Math.sin(direction);
                        canvas.style.transformOrigin = `${((1 - axisY) / 2) * 100}% ${((axisX + 1) / 2) * 100}%`;
                        canvas.style.transform = `perspective(1200px) rotate3d(${axisX}, ${axisY}, 0, ${runtime.tiltAmount}deg)`;
                    }

                    if (completed) {
                        audioManager.playBell();
                        const nextLevel = gameClock.levelIndex + 1;
                        void transitionToScene(
                            nextLevel < ld30LevelMapAssets.length
                                ? "level"
                                : "end",
                            nextLevel,
                        );
                    }
                };

                const endScene = new ex.Scene();
                let endScrollOffset = 0;
                const endBackgroundA = new ex.Actor({
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                });
                endBackgroundA.graphics.use(backgroundSprite.clone());
                endScene.add(endBackgroundA);

                const endBackgroundB = new ex.Actor({
                    x: CANVAS_WIDTH / 2 + CANVAS_WIDTH,
                    y: CANVAS_HEIGHT / 2,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                });
                endBackgroundB.graphics.use(backgroundSprite.clone());
                endScene.add(endBackgroundB);

                const endTimeLabel = new ex.Label({
                    text: "Your score: 0:00",
                    x: CANVAS_WIDTH / 2,
                    y: 210,
                    color: ex.Color.fromHex("#040200"),
                    font: new ex.Font({
                        size: 64,
                        family: ld30FontFamily,
                        textAlign: ex.TextAlign.Center,
                        baseAlign: ex.BaseAlign.Top,
                    }),
                    z: 2,
                });
                endScene.add(endTimeLabel);

                const parLabel = new ex.Label({
                    text: `Par: ${formatElapsedTime(PAR_SECONDS * 1000)}`,
                    x: CANVAS_WIDTH / 2,
                    y: 290,
                    color: ex.Color.fromHex("#271603"),
                    font: new ex.Font({
                        size: 64,
                        family: ld30FontFamily,
                        textAlign: ex.TextAlign.Center,
                        baseAlign: ex.BaseAlign.Top,
                    }),
                    z: 2,
                });
                endScene.add(parLabel);

                const recordLabel = new ex.Label({
                    text: `Homletmoo: ${formatElapsedTime(HOMLETMOO_RECORD_SECONDS * 1000)}`,
                    x: CANVAS_WIDTH / 2,
                    y: 370,
                    color: ex.Color.fromHex("#271603"),
                    font: new ex.Font({
                        size: 64,
                        family: ld30FontFamily,
                        textAlign: ex.TextAlign.Center,
                        baseAlign: ex.BaseAlign.Top,
                    }),
                    z: 2,
                });
                endScene.add(recordLabel);

                const endForeground = new ex.Actor({
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    z: 1,
                });
                endForeground.graphics.use(foregroundSprite.clone());
                endScene.add(endForeground);

                endScene.onActivate = () => {
                    const finalTime = formatElapsedTime(
                        gameClock.totalElapsedMs,
                    );
                    void audioManager.unlock().then(() => {
                        audioManager.playBell();
                    });
                    endTimeLabel.text = `Your score: ${finalTime}`;
                    parLabel.text = `Par: ${formatElapsedTime(PAR_SECONDS * 1000)}`;
                    recordLabel.text = `Homletmoo: ${formatElapsedTime(HOMLETMOO_RECORD_SECONDS * 1000)}`;
                    gameClock.endStartedAt = Date.now();
                    endScrollOffset = 0;
                    const handleRestart = (event: KeyboardEvent) => {
                        if (!rootRef.current?.contains(document.activeElement)) {
                            return;
                        }
                        const elapsedSinceEnd =
                            Date.now() - gameClock.endStartedAt;
                        if (!shouldRestartAfterEndDelay(elapsedSinceEnd, event.repeat)) {
                            return;
                        }
                        event.preventDefault();
                        void transitionToScene("level", 0);
                    };
                    const handleRestartFromTouch = (event: TouchEvent) => {
                        event.preventDefault();
                        requestMotionPermissionFromTouch();
                        const elapsedSinceEnd =
                            Date.now() - gameClock.endStartedAt;
                        if (
                            !shouldRestartAfterEndDelay(elapsedSinceEnd, false)
                        ) {
                            return;
                        }
                        void transitionToScene("level", 0);
                    };
                    window.addEventListener("keyup", handleRestart, {
                        passive: false,
                    });
                    canvas.addEventListener(
                        "touchstart",
                        handleRestartFromTouch,
                        { passive: false },
                    );
                    endScene.onDeactivate = () => {
                        window.removeEventListener("keyup", handleRestart);
                        canvas.removeEventListener(
                            "touchstart",
                            handleRestartFromTouch,
                        );
                    };
                };

                endScene.onPreUpdate = (_, elapsed) => {
                    const safeDelta = Math.min(elapsed, MAX_FRAME_DELTA_MS);
                    endScrollOffset =
                        (endScrollOffset - (safeDelta / 1000) * 50) %
                        CANVAS_WIDTH;
                    endBackgroundA.pos.x =
                        CANVAS_WIDTH / 2 + endScrollOffset;
                    endBackgroundB.pos.x =
                        CANVAS_WIDTH / 2 +
                        CANVAS_WIDTH +
                        endScrollOffset;
                };

                engine.addScene("splash", splashScene);
                engine.addScene("menu", menuScene);
                engine.addScene("level", levelScene);
                engine.addScene("end", endScene);

                engineRef.current = engine;
                engine.start();
                await engine.goToScene("splash");

                if (!cancelled) {
                    setStatus("ready");
                    setErrorMessage(null);
                }
            } catch (error) {
                if (!cancelled) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "LD30 assets failed to load.";
                    setStatus("error");
                    setErrorMessage(message);
                }
            }
        };

        void bootstrapEngine();

        return () => {
            cancelled = true;
            const audio = audioRef.current;
            if (audio) {
                audio.dispose();
                audioRef.current = null;
            }
            const engine = engineRef.current;
            if (engine) {
                engine.stop();
                engine.dispose();
                engineRef.current = null;
            }
            host.replaceChildren();
        };
    }, []);

    return (
        <div
            ref={rootRef}
            className="ld30-game"
            tabIndex={0}
            aria-label="Marble Run game stage"
            onKeyDown={(event) => {
                if (event.code === "Space") {
                    event.preventDefault();
                }
            }}
        >
            <div
                ref={hostRef}
                className="ld30-canvas-shell"
                onPointerDown={() => {
                    hostRef.current
                        ?.querySelector<HTMLCanvasElement>("canvas")
                        ?.focus();
                }}
            />
            <div className="ld30-stage-status" aria-live="polite">
                {status === "loading" && "Loading Marble Run…"}
                {status === "ready" && controlHint}
                {status === "error" &&
                    (errorMessage ?? "Asset loading failed. Refresh to retry.")}
            </div>
        </div>
    );
}
