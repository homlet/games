import backgroundImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/background.png";
import flashpunkLogo from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/flashpunk.png";
import foregroundImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/foreground.png";
import holeMaskImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/hole_mask.png";
import hmLogo from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/HM.png";
import marbleImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/marble.png";
import marblePartsImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/marble_parts.png";
import tilesImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/tiles.png";
import titleImage from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/title.png";
import flashpunkPixelFont from "./fonts/04B_03__.TTF?url";

import level01 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/01.png";
import level02 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/02.png";
import level03 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/03.png";
import level04 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/04.png";
import level05 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/05.png";
import level06 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/06.png";
import level07 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/07.png";
import level08 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/08.png";
import level09 from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/levels/09.png";

import bellSound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/bell.mp3";
import hit1Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit1.mp3";
import hit2Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit2.mp3";
import hit3Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit3.mp3";
import hit4Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit4.mp3";
import hit5Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit5.mp3";
import hit6Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit6.mp3";
import hit7Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit7.mp3";
import hit8Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hit8.mp3";
import hole1Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hole1.mp3";
import hole2Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hole2.mp3";
import hole3Sound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/hole3.mp3";
import rollSound from "../../archive/ld30/src/uk/co/homletmoo/ld30/assets/sounds/roll.mp3";

export const ld30ImageAssets = {
    hmLogo,
    flashpunkLogo,
    tiles: tilesImage,
    marble: marbleImage,
    holeMask: holeMaskImage,
    marbleParts: marblePartsImage,
    title: titleImage,
    background: backgroundImage,
    foreground: foregroundImage,
} as const;

export const ld30FontAssets = {
    flashpunkPixel: flashpunkPixelFont,
} as const;

export const ld30FontFamily = "LD30 FlashPunk";

let ld30FontLoadPromise: Promise<void> | null = null;

export function loadLd30Font(): Promise<void> {
    if (!ld30FontLoadPromise) {
        ld30FontLoadPromise = new FontFace(
            ld30FontFamily,
            `url("${ld30FontAssets.flashpunkPixel}")`,
        )
            .load()
            .then((fontFace) => {
                document.fonts.add(fontFace);
            })
            .catch((error: unknown) => {
                ld30FontLoadPromise = null;
                throw error;
            });
    }

    return ld30FontLoadPromise;
}

export const ld30LevelMapAssets = [
    level01,
    level02,
    level03,
    level04,
    level05,
    level06,
    level07,
    level08,
    level09,
] as const;

export const ld30SoundAssets = {
    bell: bellSound,
    hit1: hit1Sound,
    hit2: hit2Sound,
    hit3: hit3Sound,
    hit4: hit4Sound,
    hit5: hit5Sound,
    hit6: hit6Sound,
    hit7: hit7Sound,
    hit8: hit8Sound,
    hole1: hole1Sound,
    hole2: hole2Sound,
    hole3: hole3Sound,
    roll: rollSound,
} as const;

const ld30AssetEntries = [
    ["HM logo", ld30ImageAssets.hmLogo],
    ["Flashpunk logo", ld30ImageAssets.flashpunkLogo],
    ["tiles", ld30ImageAssets.tiles],
    ["marble", ld30ImageAssets.marble],
    ["hole mask", ld30ImageAssets.holeMask],
    ["marble particles", ld30ImageAssets.marbleParts],
    ["title", ld30ImageAssets.title],
    ["background", ld30ImageAssets.background],
    ["foreground", ld30ImageAssets.foreground],
    ["FlashPunk pixel font", ld30FontAssets.flashpunkPixel],
    ...ld30LevelMapAssets.map(
        (level, index) => [`level ${index + 1}`, level] as const,
    ),
    ["bell", ld30SoundAssets.bell],
    ["roll", ld30SoundAssets.roll],
    ["hole 1", ld30SoundAssets.hole1],
    ["hole 2", ld30SoundAssets.hole2],
    ["hole 3", ld30SoundAssets.hole3],
    ["hit 1", ld30SoundAssets.hit1],
    ["hit 2", ld30SoundAssets.hit2],
    ["hit 3", ld30SoundAssets.hit3],
    ["hit 4", ld30SoundAssets.hit4],
    ["hit 5", ld30SoundAssets.hit5],
    ["hit 6", ld30SoundAssets.hit6],
    ["hit 7", ld30SoundAssets.hit7],
    ["hit 8", ld30SoundAssets.hit8],
] as const;

export const ld30AssetNames = ld30AssetEntries.map(([name]) => name);

export function validateLd30Assets(): void {
    for (const [name, value] of ld30AssetEntries) {
        if (!value || value.length === 0) {
            throw new Error(`Missing LD30 asset: ${name}`);
        }
    }
}
