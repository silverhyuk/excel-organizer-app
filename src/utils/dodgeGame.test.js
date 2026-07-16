import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  createObstacle,
  getSpawnInterval,
  hasCollision,
  movePlayer
} from './dodgeGame.js';

test('moves the player with normalized diagonal speed and keeps it in bounds', () => {
  const moved = movePlayer({ x: 100, y: 100, size: 58 }, { right: true, down: true }, 1);
  assert.ok(moved.x > 330 && moved.x < 334);
  assert.ok(moved.y > 330 && moved.y < 334);

  const clamped = movePlayer({ x: 0, y: 0, size: 58 }, { left: true, up: true }, 1);
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
  assert.ok(moved.x <= GAME_WIDTH - moved.size);
  assert.ok(moved.y <= GAME_HEIGHT - moved.size);
});

test('detects obstacle collisions with a forgiving player hitbox', () => {
  const player = { x: 100, y: 100, size: 58 };
  assert.equal(hasCollision(player, { x: 120, y: 120, size: 30 }), true);
  assert.equal(hasCollision(player, { x: 150, y: 150, size: 20 }), false);
});

test('increases difficulty without dropping below the minimum spawn interval', () => {
  assert.equal(getSpawnInterval(0), 820);
  assert.ok(getSpawnInterval(15000) < getSpawnInterval(5000));
  assert.equal(getSpawnInterval(120000), 270);
});

test('creates obstacles inside the playfield with increasing speed', () => {
  const values = [0.5, 0.25, 0.75, 0.4, 0.6, 0.2, 0.9, 0.1];
  let index = 0;
  const random = () => values[index++ % values.length];
  const early = createObstacle(0, random);
  const late = createObstacle(30000, random);

  assert.ok(early.x >= 0 && early.x + early.size <= GAME_WIDTH);
  assert.equal(early.y, -early.size);
  assert.ok(late.speed > early.speed);
});
