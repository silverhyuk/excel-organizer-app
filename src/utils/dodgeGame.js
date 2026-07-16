export const GAME_WIDTH = 760;
export const GAME_HEIGHT = 430;
export const PLAYER_SIZE = 58;
export const PLAYER_SPEED = 330;

export function movePlayer(player, directions, deltaSeconds) {
  let horizontal = Number(Boolean(directions.right)) - Number(Boolean(directions.left));
  let vertical = Number(Boolean(directions.down)) - Number(Boolean(directions.up));
  if (horizontal !== 0 && vertical !== 0) {
    horizontal /= Math.sqrt(2);
    vertical /= Math.sqrt(2);
  }
  return {
    ...player,
    x: Math.max(0, Math.min(GAME_WIDTH - player.size, player.x + horizontal * PLAYER_SPEED * deltaSeconds)),
    y: Math.max(0, Math.min(GAME_HEIGHT - player.size, player.y + vertical * PLAYER_SPEED * deltaSeconds))
  };
}

export function hasCollision(player, obstacle) {
  const padding = 9;
  return (
    player.x + padding < obstacle.x + obstacle.size
    && player.x + player.size - padding > obstacle.x
    && player.y + padding < obstacle.y + obstacle.size
    && player.y + player.size - padding > obstacle.y
  );
}

export function getSpawnInterval(elapsedMs) {
  return Math.max(270, 820 - elapsedMs / 38);
}

export function createObstacle(elapsedMs, random = Math.random) {
  const size = 26 + Math.floor(random() * 20);
  return {
    id: `${elapsedMs}-${random()}`,
    x: Math.floor(random() * (GAME_WIDTH - size)),
    y: -size,
    size,
    speed: Math.min(440, 155 + elapsedMs / 115 + random() * 85),
    angle: random() * Math.PI,
    spin: (random() - 0.5) * 4,
    hue: 185 + Math.floor(random() * 150),
    kind: Math.floor(random() * 3)
  };
}
