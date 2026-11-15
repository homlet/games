import marbleRunCover from '../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/title.png';

export const games = [
  {
    slug: 'ld30',
    title: 'Marble Run',
    date: 'August 2014',
    blurb: 'Guide a marble through a series of hand-built courses.',
    cover: marbleRunCover,
    coverAlt: 'Marble Run title artwork',
    path: '/games/ld30/',
  },
];

export function getGame(slug) {
  return games.find((game) => game.slug === slug);
}
