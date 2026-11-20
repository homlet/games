import marbleRunCover from "../archive/ld30/src/uk/co/homletmoo/ld30/assets/images/title.png";

export interface Game {
    slug: string;
    title: string;
    date: string;
    blurb: string;
    cover: string;
    coverAlt: string;
    path: string;
}

export const games: Game[] = [
    {
        slug: "ld30",
        title: "Marble Run",
        date: "August 2014",
        blurb: "Guide a marble through a series of hand-built courses.",
        cover: marbleRunCover,
        coverAlt: "Marble Run title artwork",
        path: "./ld30/",
    },
];

export const getGame = (slug: string | undefined): Game | undefined => {
    return games.find((game) => game.slug == slug);
};
