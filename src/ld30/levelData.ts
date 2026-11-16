export const LEVEL_WIDTH = 20;
export const LEVEL_HEIGHT = 15;
export const TILE_SIZE = 40;

export const TILE_WALL = 0;
export const TILE_GROUND = 1;
export const TILE_START = 2;
export const TILE_END = 3;
export const TILE_HOLE = 4;

export type TileType =
    | typeof TILE_WALL
    | typeof TILE_GROUND
    | typeof TILE_START
    | typeof TILE_END
    | typeof TILE_HOLE;

export type Point = { x: number; y: number };

export interface DecodedLevel {
    width: number;
    height: number;
    cells: TileType[][];
    starts: Point[];
    targets: Point[];
    holes: Point[];
}

export interface LevelAudit {
    width: number;
    height: number;
    wallCount: number;
    groundCount: number;
    startCount: number;
    targetCount: number;
    holeCount: number;
}

export const mapPixelColor = (r: number, g: number, b: number): TileType => {
    switch (true) {
        case r === 0 && g === 0 && b === 0:
            return TILE_WALL;
        case r === 255 && g === 255 && b === 255:
            return TILE_GROUND;
        case r === 255 && g === 0 && b === 0:
            return TILE_START;
        case r === 0 && g === 255 && b === 0:
            return TILE_END;
        case r === 0 && g === 0 && b === 255:
            return TILE_HOLE;
        default:
            return TILE_WALL;
    }
};

export function decodeLevelPixels(
    rgba: Uint8ClampedArray | ArrayLike<number>,
    width: number,
    height: number,
): DecodedLevel {
    if (width !== LEVEL_WIDTH || height !== LEVEL_HEIGHT) {
        throw new Error(
            `LD30 map dimensions must be ${LEVEL_WIDTH}×${LEVEL_HEIGHT}; got ${width}×${height}.`,
        );
    }

    const cells: TileType[][] = Array.from({ length: height }, () =>
        Array<TileType>(width),
    );
    const starts: Point[] = [];
    const targets: Point[] = [];
    const holes: Point[] = [];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            const r = rgba[offset] ?? 0;
            const g = rgba[offset + 1] ?? 0;
            const b = rgba[offset + 2] ?? 0;
            const tile = mapPixelColor(r, g, b);
            cells[y][x] = tile;

            switch (tile) {
                case TILE_START:
                    starts.push({ x, y });
                    break;
                case TILE_END:
                    targets.push({ x, y });
                    break;
                case TILE_HOLE:
                    holes.push({ x, y });
                    break;
                default:
                    break;
            }
        }
    }

    if (starts.length === 0 || targets.length === 0 || holes.length === 0) {
        throw new Error(
            `Invalid LD30 level: expected at least one start, target, and hole. Found ${starts.length} start(s), ${targets.length} target(s), ${holes.length} hole(s).`,
        );
    }

    return { width, height, cells, starts, targets, holes };
}

export function decodeLevelFromImageData(imageData: ImageData): DecodedLevel {
    return decodeLevelPixels(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

export function auditLevel(level: DecodedLevel): LevelAudit {
    let wallCount = 0;
    let groundCount = 0;
    let startCount = 0;
    let targetCount = 0;
    let holeCount = 0;

    for (const row of level.cells) {
        for (const cell of row) {
            switch (cell) {
                case TILE_WALL:
                    wallCount += 1;
                    break;
                case TILE_GROUND:
                    groundCount += 1;
                    break;
                case TILE_START:
                    startCount += 1;
                    break;
                case TILE_END:
                    targetCount += 1;
                    break;
                case TILE_HOLE:
                    holeCount += 1;
                    break;
                default:
                    break;
            }
        }
    }

    return {
        width: level.width,
        height: level.height,
        wallCount,
        groundCount,
        startCount,
        targetCount,
        holeCount,
    };
}
