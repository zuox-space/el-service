import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // В проекте много легаси-эффектов, которые загружают данные при
      // монтировании. Правила React Compiler из eslint-config-next 16
      // считают это ошибкой, хотя для текущей архитектуры это ожидаемо.
      // Постепенно убираем их, начиная с новых компонентов.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      // any встречается в границах API и старых DTO; не блокируем деплой,
      // но фиксируем как технический долг.
      "@typescript-eslint/no-explicit-any": "warn",
      // Скрипты обслуживания исторически на CommonJS.
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
