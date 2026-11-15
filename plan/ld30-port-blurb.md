# LD30 Port Plan

## Goal

Port the ActionScript 3 / Flashpunk game to run natively in the browser, prioritizing visual and behavioral faithfulness over performance.

## Findings and approach

- The game is *Marble Run*. The [main class](../archive/ld30/src/uk/co/homletmoo/ld30/Main.as) sets an 800×600 display and a 60 fps engine rate.
- The archive contains the ActionScript sources, nine level maps, image assets, and MP3 audio. The project file ([Connected.as3proj](../archive/ld30/Connected.as3proj)) references Flashpunk at a machine-local `C:\FlashPunk\1.7.2` path and specifies 30 fps, which conflicts with the main class.
- There is no SWF or bundled Flashpunk source in the checked-out game tree. Plan on a source-based implementation rather than depending on a Flash emulator. If the original SWF is later recovered, use it as a visual and behavioral comparison target.
- Implement the runtime in Canvas and use React only to mount and integrate it into the site's separate LD30 page. This allows close control over pixel rendering, timing, input, and collision behavior.

## Porting sequence

1. **Inventory assets and behavior.** Preserve and load the original images, nine 20×15 level PNGs, and sounds. Use [Images.as](../archive/ld30/src/uk/co/homletmoo/ld30/assets/Images.as), [Sounds.as](../archive/ld30/src/uk/co/homletmoo/ld30/assets/Sounds.as), and [LevelWorld.as](../archive/ld30/src/uk/co/homletmoo/ld30/world/LevelWorld.as) as the asset and map references.
2. **Recreate the rendering.** Render at the original 800×600 composition, corresponding to 20×15 tiles at 40 pixels per tile. Disable image smoothing when scaling pixel art. Rebuild the title/end screens, tilemap, marble and target sprites, particles, fades, scrolling backdrop, timer text, and board-tilt effect.
3. **Implement game states.** Reproduce the splash/menu sequence, level progression, and ending screen described in [SplashWorld.as](../archive/ld30/src/uk/co/homletmoo/ld30/world/SplashWorld.as), [MenuWorld.as](../archive/ld30/src/uk/co/homletmoo/ld30/world/MenuWorld.as), [LevelWorld.as](../archive/ld30/src/uk/co/homletmoo/ld30/world/LevelWorld.as), and [EndWorld.as](../archive/ld30/src/uk/co/homletmoo/ld30/world/EndWorld.as).
4. **Port controls and physics.** Support arrow keys and WASD as defined in [Controls.as](../archive/ld30/src/uk/co/homletmoo/ld30/Controls.as). Reproduce the marble acceleration, friction, restitution, axis-separated movement, wall and marble collisions, hole masks and resets, target activation, and cumulative time from [Marble.as](../archive/ld30/src/uk/co/homletmoo/ld30/entity/Marble.as), [Hole.as](../archive/ld30/src/uk/co/homletmoo/ld30/entity/Hole.as), and [Target.as](../archive/ld30/src/uk/co/homletmoo/ld30/entity/Target.as).
5. **Port audio.** Reuse the supplied MP3 files. Recreate the rolling loop and speed-dependent volume, collision and hole sound selection, panning, and bell sounds. Begin audio after user interaction to comply with browser autoplay restrictions.
6. **Integrate and tune.** Mount the Canvas runtime on the LD30 game page, keep its aspect ratio responsive, and capture a gameplay screenshot for the site's landing card.

## Behavior details to preserve

- Menu: any released key begins the game; gameplay uses arrows or WASD.
- Levels: load all nine maps, map their pixel colors to wall, ground, start, target, or hole, and advance when all targets are lit.
- Marble motion: preserve the constants and update order in `Marble.as`, including low-speed collision stopping and higher-speed bounce.
- Holes: falling into a hole resets all marbles to their start positions.
- Completion: retain cumulative elapsed time and the score/par/record display; after the ending delay, any released key restarts.
- Timing: use delta-time updates, but resolve the 60 fps `Main.as` versus 30 fps project-file discrepancy against the original runtime if possible. Verify animation rates and frame-sensitive behavior during comparison.

## Verification

- Check every level's tile interpretation and start/target/hole placement against its source PNG.
- Test keyboard movement, friction, wall and marble collisions, hole resets, target activation, level transitions, timer continuity, and restart behavior.
- Compare screenshots and motion against the original SWF if available; otherwise compare against the ActionScript logic and original assets.
- Check pixel sharpness, transitions, sound selection/volume/panning, and responsiveness in current desktop browsers.
