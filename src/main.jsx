import { createRoot } from 'react-dom/client';
import { getGame, games } from './catalog.js';
import './site.css';

function GameCard({ game }) {
  return (
    <a className="game-card" href={game.path}>
      <div className="game-card__art">
        <img src={game.cover} alt={game.coverAlt} />
        <span className="game-card__badge">In development</span>
      </div>
      <div className="game-card__details">
        <div>
          <h2>{game.title}</h2>
          <p>{game.blurb}</p>
        </div>
        <span className="game-card__date">{game.date}</span>
      </div>
    </a>
  );
}

function HomePage() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Homlet Games home">
          homlet<span>.</span>
        </a>
        <span className="header-note">A collection of games</span>
      </header>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Small worlds, made to play</p>
        <h1 id="page-title">Games &amp; experiments</h1>
        <p className="intro__copy">
          A growing collection of games and interactive projects.
        </p>
      </section>
      <section className="game-grid" aria-label="Games">
        {games.map((game) => <GameCard key={game.slug} game={game} />)}
      </section>
      <footer className="site-footer">
        <span>Made for the joy of making.</span>
        <span>Homlet Games</span>
      </footer>
    </main>
  );
}

function GamePage({ game }) {
  if (!game) {
    return (
      <main className="site-shell game-page">
        <a className="back-link" href="/">← <span>All games</span></a>
        <h1>Game not found</h1>
        <p>This game is not in the collection.</p>
      </main>
    );
  }

  return (
    <main className="site-shell game-page">
      <a className="back-link" href="/">← <span>All games</span></a>
      <section className="game-page__content" aria-labelledby="game-title">
        <div className="game-stage">
          <img src={game.cover} alt={game.coverAlt} />
          <p className="game-stage__status">Playable version coming soon</p>
        </div>
        <div className="game-description">
          <p className="eyebrow">{game.date}</p>
          <h1 id="game-title">{game.title}</h1>
          <p>{game.blurb}</p>
        </div>
      </section>
      <footer className="site-footer">
        <span>Homlet Games</span>
      </footer>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('The application root element is missing.');
}

const page = rootElement.dataset.page;
const app = page === 'game'
  ? <GamePage game={getGame(rootElement.dataset.game)} />
  : <HomePage />;

createRoot(rootElement).render(app);
