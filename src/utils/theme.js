export const THEME_STORAGE_KEY = 'excel_organizer_theme';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

export function resolveTheme(storedTheme, prefersDark = false) {
  if (storedTheme === THEMES.LIGHT || storedTheme === THEMES.DARK) return storedTheme;
  return prefersDark ? THEMES.DARK : THEMES.LIGHT;
}

export function getNextTheme(theme) {
  return theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
}
