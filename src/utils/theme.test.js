import test from 'node:test';
import assert from 'node:assert/strict';

import { getNextTheme, resolveTheme, THEMES } from './theme.js';

test('resolveTheme keeps a saved user preference', () => {
  assert.equal(resolveTheme(THEMES.LIGHT, true), THEMES.LIGHT);
  assert.equal(resolveTheme(THEMES.DARK, false), THEMES.DARK);
});

test('resolveTheme falls back to the system preference', () => {
  assert.equal(resolveTheme(null, true), THEMES.DARK);
  assert.equal(resolveTheme('unknown', false), THEMES.LIGHT);
});

test('getNextTheme toggles between light and dark', () => {
  assert.equal(getNextTheme(THEMES.LIGHT), THEMES.DARK);
  assert.equal(getNextTheme(THEMES.DARK), THEMES.LIGHT);
});
