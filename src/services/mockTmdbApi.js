// Offline fallback. Poster URLs hit the public TMDB image CDN (no API key needed).
const IMG = 'https://image.tmdb.org/t/p/w500';

const GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

const RAW = [
  ['27205', 'Inception', 'movie', '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', [28, 878, 12], 2010, 8.4, 'A thief who steals corporate secrets through dream-sharing tech is given a chance to erase his past.'],
  ['157336', 'Interstellar', 'movie', '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', [12, 18, 878], 2014, 8.4, 'A team travels through a wormhole in space to ensure humanity survival.'],
  ['155', 'The Dark Knight', 'movie', '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', [18, 28, 80, 53], 2008, 8.5, 'Batman faces the Joker, a criminal mastermind who wants to plunge Gotham into anarchy.'],
  ['680', 'Pulp Fiction', 'movie', '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', [53, 80], 1994, 8.5, 'The lives of two mob hitmen, a boxer and others intertwine in four tales of violence.'],
  ['13', 'Forrest Gump', 'movie', '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', [35, 18, 10749], 1994, 8.5, 'The presidencies of Kennedy and Johnson through the eyes of an Alabama man.'],
  ['550', 'Fight Club', 'movie', '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', [18], 1999, 8.4, 'An insomniac office worker and a soap maker form an underground fight club.'],
  ['278', 'The Shawshank Redemption', 'movie', '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', [18, 80], 1994, 8.7, 'Two imprisoned men bond over years, finding solace and redemption.'],
  ['238', 'The Godfather', 'movie', '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', [18, 80], 1972, 8.7, 'The aging patriarch of a crime dynasty transfers control to his son.'],
  ['603', 'The Matrix', 'movie', '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', [28, 878], 1999, 8.2, 'A hacker learns the true nature of his reality and his role in the war against its controllers.'],
  ['807', 'Se7en', 'movie', '/6yoghtyTpznpBik8EngEmJskVUO.jpg', [80, 9648, 53], 1995, 8.4, 'Two detectives hunt a serial killer who uses the seven deadly sins as motives.'],
  ['475557', 'Joker', 'movie', '/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', [80, 53, 18], 2019, 8.1, 'A mentally troubled comedian embarks on a downward spiral into crime and chaos.'],
  ['496243', 'Parasite', 'movie', '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', [35, 53, 18], 2019, 8.5, 'Greed and class discrimination threaten a symbiotic relationship between two families.'],
  ['19404', 'Dilwale Dulhania Le Jayenge', 'movie', '/2CAL2433ZeIihfX1Hb2139CX0pW.jpg', [35, 18, 10749], 1995, 8.5, 'A young couple falls in love on a trip across Europe.'],
  ['372058', 'Your Name.', 'movie', '/q719jXXEzOoYaps6babgKnONONX.jpg', [10749, 16, 18], 2016, 8.5, 'Two teenagers share a profound, magical connection upon discovering they swap bodies.'],
  ['129', 'Spirited Away', 'movie', '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', [16, 10751, 14], 2001, 8.5, 'A girl wanders into a world ruled by gods and witches where humans become beasts.'],
  ['389', '12 Angry Men', 'movie', '/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg', [18], 1957, 8.5, 'A jury holdout attempts to prevent a miscarriage of justice.'],
  ['122', 'The Lord of the Rings: The Return of the King', 'movie', '/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg', [12, 14, 28], 2003, 8.5, 'Gandalf and Aragorn lead the World of Men against Sauron army.'],
  ['1396', 'Breaking Bad', 'tv', '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', [18, 80], 2008, 8.9, 'A chemistry teacher turns to manufacturing meth to secure his family future.'],
  ['1399', 'Game of Thrones', 'tv', '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg', [18, 10765, 10759], 2011, 8.4, 'Noble families vie for control of the Iron Throne.'],
  ['66732', 'Stranger Things', 'tv', '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', [18, 14, 9648], 2016, 8.6, 'Strange forces and secret experiments terrorize a small town.'],
  ['94605', 'Arcane', 'tv', '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', [16, 28, 18], 2021, 8.7, 'Tensions between two cities boil over as sisters fight on opposing sides.'],
  ['82856', 'The Mandalorian', 'tv', '/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg', [10765, 10759, 18], 2019, 8.5, 'A lone bounty hunter protects a mysterious child across the galaxy.'],
  ['60059', 'Better Call Saul', 'tv', '/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg', [18, 80], 2015, 8.5, 'The trials of lawyer Jimmy McGill in the years before Breaking Bad.'],
  ['1668', 'Friends', 'tv', '/f496cm9enuEsZkSPzCwnTESEK5s.jpg', [35], 1994, 8.5, 'Six friends navigate life and love in New York City.'],
  ['456', 'The Simpsons', 'tv', '/qcr9bBY6MVeLzriKCmJOv1562uP.jpg', [16, 35, 10751], 1989, 8.0, 'The satiric adventures of a working-class family in Springfield.'],
  ['615656', 'Meg 2: The Trench', 'movie', '/4m1Au3YkjqsxF8iwQy0fPYSxE0h.jpg', [28, 878, 27], 2023, 6.7, 'A research team encounters multiple deadly threats in the deep ocean.'],
  ['76600', 'Avatar: The Way of Water', 'movie', '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', [12, 878, 28], 2022, 7.6, 'Jake Sully and his family fight to stay safe on Pandora.'],
];

function build(r) {
  const [id, title, type, p, genreIds, year, rating, overview] = r;
  return {
    id, title, type,
    poster: IMG + p,
    genreIds,
    genres: genreIds.map((g) => GENRES[g]).filter(Boolean),
    year, rating, overview,
    eloScore: 1000,
    watched: false,
    wins: 0,
    losses: 0,
    skippedFromButton: 0,
  };
}

const ALL = RAW.map(build);

export async function loadGenres() {
  return GENRES;
}

export async function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL.filter((t) => t.title.toLowerCase().includes(q)).map((t) => ({ ...t }));
}

export async function trending() {
  return ALL.map((t) => ({ ...t }));
}

export async function popular(type = 'movie') {
  return ALL.filter((t) => t.type === type).map((t) => ({ ...t }));
}

export async function buildPool(size = 50) {
  return ALL.slice(0, size).map((t) => ({ ...t }));
}

export async function feedPage(page = 1, mode = 'both') {
  if (page > 1) return []; // demo dataset is finite
  return ALL.filter((t) => mode === 'both' || t.type === mode).map((t) => ({ ...t }));
}

export async function watchProviders() {
  const sample = ['Netflix', 'Max', 'Prime Video', 'Disney+', 'Hulu'];
  return sample.slice(0, 2 + Math.floor(Math.random() * 2));
}
