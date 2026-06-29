const K = 32;

function expected(a, b) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

// Returns [newWinnerElo, newLoserElo]
export function updateElo(winnerElo, loserElo) {
  const ew = expected(winnerElo, loserElo);
  const el = expected(loserElo, winnerElo);
  return [
    Math.round(winnerElo + K * (1 - ew)),
    Math.round(loserElo + K * (0 - el)),
  ];
}
