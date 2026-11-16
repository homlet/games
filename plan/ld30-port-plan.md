# LD30 (Marble Run) Browser Port — Implementation Plan

## Objective

Port the original ActionScript 3 / Flashpunk *Marble Run* game to the existing React/Vite site as a browser-playable game. Preserve the original artwork, level layouts, controls, presentation, and gameplay behavior as closely as practical. Implement gameplay in TypeScript with Excalibur for the browser game lifecycle, scenes, rendering, and input; implement marble motion and collision rules explicitly rather than substituting engine physics.

## Decisions and scope

- **Runtime:** Excalibur hosted by the existing React game page. Excalibur is not currently a project dependency, so add and pin it as a runtime dependency during implementation.
- **Display:** 800×600 logical pixels (4:3), with a responsive, aspect-ratio-preserving canvas. Keep pixel art crisp when scaled.
- **Controls:** Keyboard only for the first release. Support arrows and WASD, as the original does. On small screens, fit the canvas and show the keyboard requirement; do not add touch controls in this port.
- **Simulation rate:** Use 60 Hz as the initial target because `Main.as` constructs the Flashpunk engine at 60 fps. Ignore that `Connected.as3proj` separately specifies 30 fps. Keep simulation time-step handling explicit and test under variable browser refresh/performance.
- **Original-runtime comparison:** No SWF or Flashpunk source is in the repository. Treat ActionScript and embedded source assets as the behavioral reference; do not block implementation on recovering a SWF. If one becomes available, use it for visual and timing comparisons.
- **Out of scope:** Recreating Flashpunk as a general-purpose engine, changing level or scoring design, adding mobile controls, or redesigning the site's visual language.

## Repository findings

- The game page is `games/ld30/index.html`; it currently renders a “coming soon” state through `src/main.tsx`.
- `src/catalog.ts` already registers LD30 and imports the title image from the archive for the landing card.
- `package.json` has React and Vite but no game engine or test runner. `vite.config.ts` already builds both the home page and LD30 page.
- Original source is under `archive/ld30/src/uk/co/homletmoo/ld30/`. Assets are embedded by the source and can remain canonical there rather than being duplicated. 
- All nine level PNGs are 20×15 pixels. `LevelWorld` scales each map cell to 40×40 pixels, yielding the 800×600 game surface. Source images include a 50×10 tile strip, 8×8 marble, 40×40 hole mask, 72×8 particle strip, 200×150 backgrounds/title/foreground, logos, and 13 MP3 files.
- The project descriptor points to a machine-local Flashpunk installation and specifies 30 fps. There is no checked-in SWF or Flashpunk library.

## Proposed implementation structure

Keep the game isolated from the general site UI while using the existing LD30 route:

- `src/ld30/Ld30Game.tsx` — React host component; create the Excalibur engine after mount, start it after assets are ready, and stop/dispose it on unmount.
- `src/ld30/assets.ts` — typed registry for original image, map, and audio asset URLs imported from `archive/ld30/...`; centralize load errors and asset names.
- `src/ld30/levelData.ts` — level ordering, PNG-to-cell decoding, tile/color mapping, and validation of map dimensions and required entities.
- `src/ld30/physics.ts` — deterministic, engine-independent movement and collision helpers with the original constants and update order.
- `src/ld30/scenes/` — splash, menu, level, and end scenes, with scene transitions and shared presentation/audio services as appropriate.
- `src/ld30/` game-specific styles — canvas sizing, focus/help text, and game-stage states without changing unrelated site styling.
- `src/ld30/*.test.ts` — focused tests for map decoding, time formatting, movement/collision boundaries, and level completion. Add a lightweight test runner only if needed; the project currently has no test script.

Names may be adjusted to match the Excalibur version's APIs and existing conventions, but keep the asset/data, mechanics, presentation, and React lifecycle responsibilities separated.

## Implementation phases

### 1. Establish the game host and asset pipeline

1. Add Excalibur and create the typed asset registry for all original images, nine maps, and MP3s. Keep assets in the archive and reference them rather than copying them.
2. Add the React `Ld30Game` host and replace the placeholder stage on the LD30 page with the game canvas and a loading/error state.
3. Configure an 800×600 logical viewport, responsive 4:3 scaling, nearest-neighbor image rendering, and the original background color (`#523e29`).
4. Ensure engine creation and teardown are safe if React mounts/unmounts the page more than once. Surface asset-load and startup errors instead of leaving a blank canvas.
5. Add game-specific instructions that keyboard input is required; make the stage keyboard-focusable and provide a visible focus treatment.

**Exit check:** Both existing Vite inputs build; the LD30 page shows a correctly sized, sharp canvas; asset failures are visible and actionable.

### 2. Decode and render the original levels

1. Load each original map PNG and decode its exact pixel colors into the existing tile types:
   - black `0x000000` → wall
   - white `0xffffff` → ground
   - red `0xff0000` → start
   - green `0x00ff00` → target
   - blue `0x0000ff` → hole
   - unknown colors → wall, matching `LevelWorld.map_pixel`
2. Check map dimensions against the expected 20×15 grid before use. Derive cells from source pixels; do not hardcode nine maps in TypeScript.
3. Render the 20×15 grid from the source tile sheet at 40 pixels per tile, and build wall collision data from the same decoded cells so visuals and collision cannot drift.
4. Instantiate start marbles, targets, and holes from map cells. Use the original hole mask for hole collision rather than treating every part of a 40×40 cell as hazardous.
5. Add a level audit in tests or a small development diagnostic: each map should decode completely and expose its start/target/hole counts for review.

**Exit check:** All nine maps render at 800×600, retain correct tile artwork and entity placement, and wall/hole tests use the same source geometry as rendering.

### 3. Implement original movement and collision behavior

1. Port the constants from `Marble.as`: gravity/acceleration `G = 980`, friction coefficient `MU = 0.08`, restitution `0.4`, and slope factor `(1 - MU * sqrt(3)) / 2`.
2. Process input as in the original update: apply directional acceleration, apply per-axis friction only when that axis has no net direction, then move and resolve collisions. Preserve the 30 px/s low-speed stop versus bounce threshold.
3. Implement axis-separated movement against wall cells and other marbles. On collision, reverse the affected velocity component with restitution when its magnitude is above 30; otherwise stop that component. Preserve collision sound gating above 35.
4. Determine and test a safe time-step strategy. Prefer fixed 60 Hz simulation with an accumulator (and a bounded catch-up policy) so a slow frame does not tunnel through walls; compare results to the original delta-time behavior and document any necessary deviation.
5. Implement target activation from marble overlap. A level advances only once all targets are lit.
6. Implement hole-mask overlap. On any marble falling into a hole, reset every marble to its corresponding start position and zero its velocity; emit the original death/spawn particles and play the next hole sound.
7. Reproduce the board tilt driven by the current input direction and the smoothing toward the requested amount; isolate it as presentation so it cannot change collision geometry.

**Exit check:** Deterministic tests cover acceleration, no-input friction, opposite-direction cancellation, both collision thresholds, marble-to-marble response, hole reset of all marbles, and target activation/completion.

### 4. Implement scenes, timing, and transitions

1. **Splash:** Recreate the Flashpunk and HM logo sequence, frame animation, alpha fades, timing, and placement.
2. **Menu:** Recreate the scrolling background and fading title. Any released key starts level 1.
3. **Level:** Render the board, marbles, targets, particles, and timer. Carry cumulative elapsed seconds across levels; format as whole seconds in `m:ss`.
4. **End:** Show the foreground and scrolling background, final time, par (`160` seconds), and Homletmoo record (`123` seconds). Play the bell, wait at least three seconds before accepting a released key, then restart at level 1 with a fresh timer.
5. Make scene changes idempotent when the last target is lit, avoiding multiple transitions during a single update.
6. Ensure pause/tab-away behavior does not create a large catch-up movement on return. Confirm whether the timer should continue while the page is backgrounded; initially favor preventing physics jumps while preserving elapsed play time, then compare with original behavior where possible.

**Exit check:** Automated or manual checks verify the complete splash → menu → nine levels → end → restart flow, timer continuity, minimum end-screen delay, and fresh timer on restart.

### 5. Restore sound and effects

1. Load the original bell, rolling loop, eight hit sounds, and three hole sounds through Excalibur's audio support or Web Audio where necessary.
2. Start or resume audio only after a user gesture to comply with browser autoplay restrictions; make the initial interaction reliably unlock audio.
3. Loop rolling audio during levels and adjust its volume toward the original sine-eased average-marble-speed target, capped at 1.
4. Cycle through hit and hole variations in the original order; preserve speed-based hit volume and horizontal pan mapping.
5. Play the bell on level entry and completion. Recreate spawn/death particle strips and their original timing/easing.
6. Avoid duplicate audio loops when switching levels or unmounting the React host.

**Exit check:** Test with sound enabled and disabled; verify unlock, loop lifecycle, event selection, relative volume/panning, and no accumulating loops after transitions.

### 6. Integrate and polish the site page

1. Replace the placeholder “coming soon” image/status in the game page with `Ld30Game`, while retaining the site's back link, title, description, and page structure.
2. Keep the 4:3 canvas responsive and centered; on narrow viewports scale it without stretching. The agreed first release remains keyboard-only, and page copy should disclose that limitation.
3. Verify keyboard input works after focusing the stage and does not accidentally scroll the page while playing. Preserve normal site navigation and focus behavior outside the game.
4. Capture an in-game screenshot for the landing card and update `src/catalog.ts` to use it instead of the title-only cover if the final image improves the card. Do not remove the original title artwork from the game.
5. Check browser console output, loading/error states, and deployed subpath behavior for `/games/ld30/`.

**Exit check:** Production build serves both routes correctly, the card has a representative image, and the playable page scales and remains operable in current desktop browsers.

## Verification plan

### Automated

- Run `npm run typecheck` and `npm run build`.
- Add focused tests for:
  - all nine map dimensions, color decoding, unknown-color fallback, and generated entity counts;
  - exact 60 Hz movement steps, friction reaching zero without reversing, and directional input edge cases;
  - axis-separated wall/marble collision and threshold behavior around 30 and 35 px/s;
  - hole-mask detection/reset and all-target completion;
  - time formatting at 0, 59, 60, and multi-minute values; timer carry-over and end-screen restart guard.
- Test repeated React mount/unmount and scene transitions for duplicate canvases, listeners, and audio.

### Manual gameplay and visual QA

- Play all nine maps with arrows and WASD; verify movement in each direction and diagonal input.
- Exercise walls, marble-to-marble collisions, hole resets, target overlap, progression, final score, delayed restart, and timer reset.
- Compare source-sized screenshots for each scene and representative levels against the original artwork and ActionScript logic. Compare to the original SWF only if recovered.
- Inspect pixel sharpness, tile alignment, logo/title fades, background scroll rate, tilt direction/amount, particle animation, and audio behavior.
- Check responsive 4:3 scaling and keyboard-only disclosure on desktop and narrow/mobile viewports; do not treat lack of touch controls as a release failure.

## Key risks and mitigations

- **No original SWF or Flashpunk library:** Exact runtime parity cannot be demonstrated from this checkout. Keep source logic and assets as the comparison baseline and record any inferred behavior.
- **Collision fidelity:** Engine collision defaults may differ from Flashpunk. Keep movement and resolution custom, share decoded map geometry, and test edges and thresholds explicitly.
- **Browser audio policy and panning differences:** Unlock on interaction and test supported desktop browsers; preserve core gameplay if a browser declines audio, while reporting actual load/play errors.
- **Build-time asset path/import behavior:** Archive assets are outside `src`; verify Vite can bundle them through explicit imports and that production URLs resolve from the nested game route.
- **Keyboard-only on phones/tablets:** This is the agreed initial scope. Clearly communicate the input requirement and consider touch controls only as a separate follow-up decision.

## Completion criteria

The port is complete when the LD30 route loads a playable 800×600-equivalent game with all nine source maps, faithfully implemented keyboard movement/collisions/hole resets/targets, original scene and scoring flow, usable audio after interaction, responsive crisp rendering, clean engine teardown, passing typecheck/build and focused tests, and an updated representative landing-card image.
