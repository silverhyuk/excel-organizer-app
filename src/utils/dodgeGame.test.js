import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HEART_SCORE,
  calculateScore,
  createBomb,
  createHeart,
  getHeartSpawnInterval,
  getSpawnInterval,
  hasCollision,
  isGameToggleShortcut,
  movePlayer,
  resolveFallingItemCollisions
} from './dodgeGame.js';

test('recognizes the game shortcut on macOS and Windows without key-repeat toggles', () => {
  assert.equal(isGameToggleShortcut({ code: 'KeyG', metaKey: true }), true);
  assert.equal(isGameToggleShortcut({ code: 'KeyG', ctrlKey: true }), true);
  assert.equal(isGameToggleShortcut({ code: 'KeyG', ctrlKey: true, repeat: true }), false);
  assert.equal(isGameToggleShortcut({ code: 'KeyG', ctrlKey: true, shiftKey: true }), false);
  assert.equal(isGameToggleShortcut({ code: 'Escape' }), false);
});

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

  assert.equal(getHeartSpawnInterval(0), 3200);
  assert.ok(getHeartSpawnInterval(30000) < getHeartSpawnInterval(5000));
  assert.equal(getHeartSpawnInterval(180000), 1800);
});

test('creates bombs and hearts inside the playfield', () => {
  const values = [0.5, 0.25, 0.75, 0.4, 0.6, 0.2, 0.9, 0.1];
  let index = 0;
  const random = () => values[index++ % values.length];
  const earlyBomb = createBomb(0, random);
  const lateBomb = createBomb(30000, random);
  const heart = createHeart(0, random);

  assert.equal(earlyBomb.type, 'bomb');
  assert.ok(earlyBomb.x >= 0 && earlyBomb.x + earlyBomb.size <= GAME_WIDTH);
  assert.equal(earlyBomb.y, -earlyBomb.size);
  assert.ok(lateBomb.speed > earlyBomb.speed);

  assert.equal(heart.type, 'heart');
  assert.ok(heart.x >= 0 && heart.x + heart.size <= GAME_WIDTH);
  assert.equal(heart.y, -heart.size);
});

test('bombs end the game while collected hearts are removed and counted', () => {
  const player = { x: 100, y: 100, size: 58 };
  const safeBomb = { id: 'safe', type: 'bomb', x: 300, y: 100, size: 30 };
  const bomb = { id: 'bomb', type: 'bomb', x: 110, y: 110, size: 30 };
  const heart = { id: 'heart', type: 'heart', x: 120, y: 120, size: 28 };
  const result = resolveFallingItemCollisions(player, [safeBomb, bomb, heart]);

  assert.equal(result.bombHit, true);
  assert.equal(result.heartsCollected, 1);
  assert.deepEqual(result.remainingItems, [safeBomb]);
});

test('adds a fixed bonus for every collected heart', () => {
  assert.equal(calculateScore(1250, 2, 0), 62);
  assert.equal(calculateScore(1250, 2, 2), 62 + HEART_SCORE * 2);
});
