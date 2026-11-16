import { useEffect, useRef, useState } from "react";
import * as ex from "excalibur";
import { ld30ImageAssets, ld30LevelMapAssets, validateLd30Assets } from "./assets";
import {
    TILE_END,
    TILE_HOLE,
    TILE_SIZE,
    TILE_START,
    TILE_WALL,
    auditLevel,
    decodeLevelFromImageData,
} from "./levelData";
import "./Ld30Game.css";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CANVAS_BG = new ex.Color(82, 62, 41);

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
        image.src = src;
    });

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

const renderLevelBoard = async (engine: ex.Engine, levelIndex: number) => {
    const sourceUrl = ld30LevelMapAssets[levelIndex];
    const source = new ex.ImageSource(sourceUrl);
    await source.load();

    const image = await loadImageElement(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const level = decodeLevelFromImageData(imageData);
    const audit = auditLevel(level);
    console.info(`LD30 level ${levelIndex + 1} audit`, audit);

    const tilesSource = new ex.ImageSource(ld30ImageAssets.tiles);
    await tilesSource.load();
    const tileSprites = getTileSprites(tilesSource);

    const tileMap = new ex.TileMap({
        columns: level.width,
        rows: level.height,
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
    });

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
            cell.isSolid = tileType === TILE_WALL;
        }
    }

    const holeSource = new ex.ImageSource(ld30ImageAssets.holeMask);
    await holeSource.load();
    const holeGraphic = ex.Sprite.from(holeSource, {
        destSize: { width: TILE_SIZE, height: TILE_SIZE },
    });

    const marbleSource = new ex.ImageSource(ld30ImageAssets.marble);
    await marbleSource.load();
    const marbleGraphic = ex.Sprite.from(marbleSource, {
        destSize: { width: TILE_SIZE * 0.8, height: TILE_SIZE * 0.8 },
    });

    for (const start of level.starts) {
        const marble = new ex.Actor({
            x: start.x * TILE_SIZE + TILE_SIZE / 2,
            y: start.y * TILE_SIZE + TILE_SIZE / 2,
            width: TILE_SIZE * 0.8,
            height: TILE_SIZE * 0.8,
        });
        marble.graphics.use(marbleGraphic.clone());
        engine.add(marble);
    }

    for (const target of level.targets) {
        const targetActor = new ex.Actor({
            x: target.x * TILE_SIZE + TILE_SIZE / 2,
            y: target.y * TILE_SIZE + TILE_SIZE / 2,
            width: TILE_SIZE,
            height: TILE_SIZE,
        });
        targetActor.graphics.use(tileSprites[TILE_END].clone());
        engine.add(targetActor);
    }

    for (const hole of level.holes) {
        const holeActor = new ex.Actor({
            x: hole.x * TILE_SIZE + TILE_SIZE / 2,
            y: hole.y * TILE_SIZE + TILE_SIZE / 2,
            width: TILE_SIZE,
            height: TILE_SIZE,
        });
        holeActor.graphics.use(holeGraphic.clone());
        engine.add(holeActor);
    }

    engine.add(tileMap);
    return tileMap;
};

export function Ld30Game() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading",
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const engineRef = useRef<ex.Engine | null>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }

        let cancelled = false;

        const bootstrapEngine = async () => {
            try {
                validateLd30Assets();

                const canvas = document.createElement("canvas");
                canvas.width = CANVAS_WIDTH;
                canvas.height = CANVAS_HEIGHT;
                canvas.classList.add("ld30-canvas");
                canvas.setAttribute("aria-label", "Marble Run game canvas");

                host.replaceChildren(canvas);

                const engine = new ex.Engine({
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    antialiasing: false,
                    backgroundColor: CANVAS_BG,
                    canvasElement: canvas,
                    suppressPlayButton: true,
                });

                engineRef.current = engine;
                await renderLevelBoard(engine, 0);
                engine.start();

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
            className="ld30-game"
            tabIndex={0}
            aria-label="Marble Run game stage"
        >
            <div ref={hostRef} className="ld30-canvas-shell" />
            <div className="ld30-stage-status" aria-live="polite">
                {status === "loading" && "Loading Marble Run…"}
                {status === "ready" && "Keyboard required • Arrows / WASD"}
                {status === "error" &&
                    (errorMessage ?? "Asset loading failed. Refresh to retry.")}
            </div>
        </div>
    );
}
