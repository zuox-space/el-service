/**
 * Темизация.
 *
 * Тема задаётся атрибутом data-theme на <html>; значения токенов подставляются
 * в CSS (см. app/globals.css). Так переключение не требует перерисовки классов
 * и работает до гидрации — без «вспышки» тёмной темы на светлой.
 */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'el-theme';

/** Тёмная — по умолчанию: интерфейс исторически тёмный и таким привычен школе. */
export const DEFAULT_THEME: Theme = 'dark';

/** Цвет адресной строки в standalone-режиме (значения совпадают с --color-bg). */
export const THEME_BAR_COLORS: Record<Theme, string> = {
    dark: '#0e1014',
    light: '#f5f6f8',
};

export function isTheme(value: unknown): value is Theme {
    return value === 'dark' || value === 'light';
}

/**
 * Скрипт для <head>: выставляет тему до первой отрисовки, чтобы не было вспышки.
 * Инлайновый, потому что внешний загрузится позже, чем отрисуется страница.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
  var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
  var theme = (stored === 'light' || stored === 'dark')
    ? stored
    : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) { meta.setAttribute('content', theme === 'light' ? '${THEME_BAR_COLORS.light}' : '${THEME_BAR_COLORS.dark}'); }
}catch(e){}})();`;
