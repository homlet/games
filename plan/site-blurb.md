# Static Games Site Plan

## Goal

Showcase the games on a statically served site with a screenshot grid on the landing page and a dedicated, linkable page for each game.

## Architecture

- Use React with Vite for shared UI and build tooling.
- Build a static multi-page site, not a client-routed SPA: provide `index.html` for `/` and a separate HTML entry for each game, such as `games/ld30/index.html`.
- Have each entry mount shared React components. Use ordinary anchor links so game URLs work when opened directly or refreshed, without requiring a server-side route fallback.
- Keep each game's title, date, blurb, screenshot, and page path in a shared catalog so the landing grid and game pages use the same metadata.
- Place game runtime assets and code with their corresponding game page; keep common site components and styles shared.

## Pages

### Landing page

- Show a responsive grid of game cards.
- Use a representative screenshot for each card and link the whole card to that game's page.
- Provide useful image alternative text and visible focus states for keyboard navigation.

### Game page

- Embed the playable game.
- Show its title, date, and short blurb beneath the game.
- Provide a back arrow linking to `/`, with an accessible label.
- Keep the game area responsive while preserving its intended aspect ratio.

## Implementation sequence

1. Establish the Vite project structure, shared React entry components, and static multi-page build configuration.
2. Add the game catalog and landing page.
3. Add a reusable game-page layout and the LD30 entry, then connect it to the Canvas port in the [LD30 port plan](./ld30-port-plan.md).
4. Add screenshots and verified metadata for each game as it is cataloged.
5. Add future game pages as separate static HTML entries that reuse the shared layout.

## Verification

- Build the site and serve the generated files using a static file server.
- Open `/` and each game URL directly; verify refresh and normal back-link navigation.
- Confirm each page is a separate document and does not rely on SPA fallback behavior.
- Check layout at narrow and wide viewport sizes, keyboard navigation, image alternatives, and the game area's aspect ratio.

## LD30 content notes

- The title artwork identifies the game as *Marble Run* ([title.png](../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/title.png)).
- August 2014 is a candidate display date; confirm the exact submission date before publishing.
- The checked-in assets do not include a gameplay screenshot. Capture one from the browser port for the landing-page card.
