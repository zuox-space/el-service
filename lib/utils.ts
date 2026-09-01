/**
 * Безопасное форматирование ФИО
 * @param fullName - полное имя (может быть null/undefined)
 * @returns отформатированное имя или "Пользователь"
 */
export function safeFormatShortName(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== 'string') {
    return 'Пользователь';
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) return 'Пользователь';
  if (parts.length === 1) return parts[0];

  const lastName = parts[0];
  const firstName = parts[1];
  const middleName = parts[2];

  let result = lastName;

  if (firstName) {
    result += ` ${firstName.charAt(0).toUpperCase()}.`;
  }

  if (middleName) {
    result += `${middleName.charAt(0).toUpperCase()}.`;
  }

  return result;
}

// Исходная функция с явной типизацией
export function formatShortName(fullName: string): string {
  if (!fullName) return '';

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const lastName = parts[0];
  const firstName = parts[1];
  const middleName = parts[2];

  let result = lastName;

  if (firstName) {
    result += ` ${firstName.charAt(0).toUpperCase()}.`;
  }

  if (middleName) {
    result += `${middleName.charAt(0).toUpperCase()}.`;
  }

  return result;
}
export const formatDateLocal = (date: Date | string): string => {
  const d = new Date(date);
  // Фиксируем дату без учёта часового пояса
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};