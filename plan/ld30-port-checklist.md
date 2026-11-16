# LD30 Browser Port Checklist

## Phase 1 — Establish the game host and asset pipeline

- [x] Add Excalibur as a runtime dependency and create a typed registry for all original image, level, and sound assets.
  - Reference the archive assets directly instead of copying them into the app bundle.
  - Include all nine level PNGs and the original MP3s in the asset list.
- [x] Add the React `Ld30Game` host component and replace the placeholder stage on the LD30 page with a real canvas host.
  - Include a loading state while assets are being initialized.
  - Include an actionable error state when startup or asset loading fails.
- [x] Configure the stage to a 800×600 logical viewport with a 4:3 layout.
  - Keep the canvas crisp at scaled sizes with nearest-neighbor rendering.
  - Use the original game background color `#523e29`.
- [x] Ensure engine lifecycle is safe across repeated React mount/unmount cycles.
  - Stop and dispose the Excalibur engine on unmount.
  - Avoid leaving a stale canvas or duplicated listeners behind.
- [x] Add on-page instructions that keyboard input is required.
  - Make the stage keyboard-focusable.
  - Provide a visible focus treatment for accessibility and usability.

## Phase 2 — Decode and render the original levels

- [x] Load each original level PNG and decode its pixel colors into the game’s tile logic.
  - Map black pixels to wall tiles.
  - Map white pixels to ground tiles.
  - Map red pixels to start positions.
  - Map green pixels to targets.
  - Map blue pixels to holes.
  - Treat unknown colors as walls to match the original map logic.
- [x] Validate each map before use.
  - Check that every map matches the expected 20×15 grid.
  - Reject invalid dimensions before gameplay starts.
  - Ensure map decoding is based on source pixels rather than hardcoded level data.
- [x] Build the level representation from the decoded map data.
  - Derive the grid from the original source PNGs.
  - Build the level’s wall/collision geometry from the same decoded tiles used for rendering.
- [x] Instantiate the level entities from map cells.
  - Place start marbles from red cells.
  - Place targets from green cells.
  - Place holes using the original hole mask rather than treating each 40×40 cell as a hazard.
- [x] Render the 20×15 board using the original tile sheet at 40 pixels per tile.
  - Preserve the original visual layout and tile alignment.
  - Keep collision data and rendering tied to the same source geometry.
- [x] Add a development-level audit for decoded maps.
  - Confirm that all maps decode completely without missing or malformed entities.
  - Expose start, target, and hole counts for review.

## Phase 3 — Implement original movement and collision behavior

- [ ] Port the original Marble constants into the gameplay logic.
  - Gravity/acceleration: `G = 980`
  - Friction coefficient: `MU = 0.08`
  - Restitution: `0.4`
  - Slope factor: `(1 - MU * sqrt(3)) / 2`
- [ ] Recreate input-driven acceleration and friction behavior.
  - Apply directional acceleration using the original controls.
  - Apply per-axis friction only when that axis has no active directional input.
  - Preserve the original low-speed stop-versus-bounce threshold of 30 px/s.
- [ ] Implement axis-separated movement against walls and other marbles.
  - Separate movement on X and Y axes.
  - Resolve wall collisions with the original restitution and stop thresholds.
  - Preserve the original collision sound gating above 35.
- [ ] Determine and implement the safe fixed-timestep strategy.
  - Prefer a fixed 60 Hz simulation with an accumulator if needed.
  - Prevent tunneling through walls during slower frames.
  - Keep simulation deterministic and explicit rather than relying on engine physics defaults.
- [ ] Recreate target activation.
  - Each target is lit when a marble overlaps it.
  - Advance to the next level only when all targets are activated.
- [ ] Recreate hole reset behavior.
  - On marble entry into a hole, reset all marbles to their start positions.
  - Zero all marble velocities on reset.
  - Emit the original death/spawn particle effect and play the next hole sound.
- [ ] Recreate board tilt and smoothing behavior.
  - Drive tilt from current input direction.
  - Smooth toward the requested tilt amount.
  - Keep tilt as presentation-only so it does not alter collision geometry.

## Phase 4 — Implement scenes, timing, and transitions

- [ ] Recreate the splash scene.
  - Flashpunk and HM logos
  - frame animation
  - alpha fades
  - timing and placement matching the source presentation
- [ ] Recreate the menu scene.
  - Scrolling background
  - title fade
  - start behavior: any released key starts level 1
- [ ] Implement the level scene.
  - Render board, marbles, targets, particles, and timer
  - Carry cumulative elapsed time across levels
  - Format elapsed time as whole seconds in `m:ss`
- [ ] Implement the end scene.
  - Show foreground and scrolling background
  - Display final time, par (`160` seconds), and Homletmoo record (`123` seconds)
  - Play the bell
  - Wait at least three seconds before accepting a released key
  - Restart at level 1 with a fresh timer
- [ ] Make scene changes safe and idempotent.
  - Prevent duplicate transitions if the target is completed in the same update cycle.
  - Avoid triggering multiple scene changes from a single event.
- [ ] Handle tab-away and pause behavior without physics jumps.
  - Prevent excessive catch-up movement when the page regains focus.
  - Preserve elapsed play time while avoiding large movement jumps on resume.

## Phase 5 — Restore sound and effects

- [ ] Load the original audio assets through the browser audio pipeline.
  - Bell
  - rolling loop
  - eight hit sounds
  - three hole sounds
- [ ] Unlock audio only after a user gesture.
  - Comply with browser autoplay restrictions.
  - Ensure the initial interaction reliably unlocks audio for future playback.
- [ ] Implement the rolling audio loop.
  - Start and stop it as needed during level play.
  - Adjust volume according to the original average-marble-speed target.
  - Cap volume at 1.
- [ ] Implement hit and hole sound selection.
  - Cycle through the original sound variations in the correct order.
  - Preserve speed-based hit volume behavior.
  - Preserve horizontal pan mapping.
- [ ] Recreate the bell and particle effects.
  - Play the bell on level entry and on completion.
  - Recreate spawn/death particles and their original timing/easing.
- [ ] Avoid duplicate audio loops and orphaned audio objects.
  - Prevent multiple rolling loops from accumulating across scene changes.
  - Ensure cleanup on level transitions and React unmount.

## Phase 6 — Integrate and polish the site page

- [ ] Replace the placeholder “coming soon” game-stage state with the actual `Ld30Game` host.
  - Preserve the page’s back link, title, description, and overall structure.
- [ ] Keep the 4:3 presentation responsive and centered.
  - Scale without stretching on narrow viewports.
  - Keep the keyboard-only design clear in the page copy.
- [ ] Ensure keyboard controls work correctly after focus enters the game area.
  - Prevent accidental page scrolling while playing.
  - Preserve normal site navigation outside the game.
- [ ] Refresh the landing card artwork if a better in-game screenshot is produced.
  - Use an in-game representative image for the card.
  - Keep the original title artwork in the game itself.
- [ ] Confirm production route behavior and page integration.
  - Check nested route behavior for `/games/ld30/`
  - Validate the canvas, loading/error states, and browser console behavior in the deployed setup.
