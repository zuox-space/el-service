# UI Kit

Единая дизайн-система административного приложения. Витрина — `/ui`.

## Правила

1. **Цвета, радиусы, тени, типографика — только из токенов** (`app/globals.css`).
   В новых экранах не должно быть `bg-[#1a2332]`, `bg-white/10`, `text-white`,
   градиентов и `backdrop-blur`.
2. **Один primary-экшен на экран.** Остальные — `secondary`, `ghost`, `danger`.
3. **Интерактив — только компонентами** (`Button`, `IconButton`, `ListItem`, `Tabs`),
   а не `div` с `onClick`. Это даёт клавиатуру, скринридер и корректный тап в PWA.
4. **Тап-таргет ≥ 48×48.** В `Button` это размер `md`/`lg`, у `IconButton` — `size={48}`.
5. **Иконки — Lucide**, 20/24px, `strokeWidth 1.75`, цвет `text-fg-muted`.
   Семантический цвет — только для статусов. **Эмодзи не используем.**
6. **Поля ввода — 16px.** Меньше нельзя: iOS Safari зумит страницу при фокусе.

## Токены

| Группа | Токены |
|---|---|
| Поверхности | `bg`, `surface`, `surface-2`, `surface-3` |
| Границы | `border`, `border-strong` |
| Текст | `fg`, `fg-muted`, `fg-subtle`, `fg-inverse` |
| Акцент | `accent` (иконки/рамки), `accent-text` (акцентный текст), `accent-solid` (заливка кнопок), `accent-soft` (выбранное), `accent-fg` (текст на заливке) |
| Статусы | `success`, `warning`, `danger`, `info` + `*-soft` |
| Радиусы | `rounded-control` 6, `rounded-card` 10, `rounded-overlay` 16 |
| Тени | `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-accent` |
| Градиенты | `--gradient-card`, `--gradient-accent`, `--gradient-page` |
| Утилиты объёма | `surface-card` (градиент внутри карточки), `surface-accent` (заливка кнопки), `surface-lift` (подъём при наведении) |
| Прочее | `bg-backdrop`, `bg-skeleton`, `ring` |

Использование: `bg-surface text-fg border-border rounded-card shadow-card`.

### Палитра и как её менять

Все цвета живут в одном блоке — `app/globals.css`, секции `@theme` (тёмная) и
`html[data-theme="light"]` (светлая). Экраны цветов не содержат.

| Что нужно изменить | Переменные |
|---|---|
| Общий фон приложения | `--color-bg`, `--gradient-page` |
| Карточки и панели | `--color-surface`, `--color-surface-2`, `--color-surface-3`, `--gradient-card` |
| Границы и разделители | `--color-border`, `--color-border-strong` |
| Основной и второстепенный текст | `--color-fg`, `--color-fg-muted`, `--color-fg-subtle` |
| Акцентные кнопки | `--color-accent-solid` (+ `-hover`), `--color-accent-fg`, `--gradient-accent`, `--shadow-accent` |
| Акцентный текст и иконки | `--color-accent`, `--color-accent-text` |
| Статусы (больничный, просрочка, ошибка) | `--color-success/warning/danger/info` + `*-soft` |

Текущая основа: тёмная — `#003D58`, акцент кнопок — `#1AD509`; светлая — акцент `#0B9BE8`.

Важно про акцент в светлой теме: `--color-accent` — ровно `#0B9BE8` (заливки, иконки,
индикаторы), а `--color-accent-text` темнее (`#07719F`), потому что мелкий текст этим
синим на белом не проходит по контрасту. Компоненты уже используют нужную переменную.

## Темы

Две темы: `dark` (по умолчанию) и `light`. Переключение — `data-theme` на `<html>`:

```tsx
const { theme, toggleTheme } = useTheme(); // components/theme/ThemeProvider
```

- Выбор хранится в `localStorage['el-theme']`.
- Инлайновый скрипт в `app/layout.tsx` выставляет тему до первой отрисовки — без вспышки.
- `<ThemeToggle />` — готовый переключатель (иконка появляется только после монтирования).

> Старые экраны приведены к токенам механически (убраны `#1a2332`, `white/10`,
> `gray-400`), поэтому тема применяется и к ним. Полная переработка их разметки —
> отдельный шаг: учительская `/` и дашборд `/admin`.

## Компоненты

### Примитивы

| Компонент | Ключевые пропсы |
|---|---|
| `Button` | `variant` (primary/secondary/ghost/danger), `size` (sm/md/lg), `loading`, `fullWidth`, `leftIcon`, `rightIcon` |
| `IconButton` | `icon`, `label` (обязателен → aria-label), `variant`, `size` (40/48), `withTooltip` |
| `Input` | `label`, `hint`, `error`, `leftIcon`, `rightSlot`, `clearable`, `onClear` |
| `Select` | `options`, `value`, `onChange(value)`, `placeholder`, `label`, `error` |
| `Checkbox` | `checked`, `onChange`, `label`, `description`, `disabled`, `error` |
| `RadioGroup` | `value`, `onChange`, `options[]`, `orientation`, `label` |
| `Switch` | `checked`, `onChange`, `label`, `description` |
| `SearchInput` | `value`, `onChange`, `placeholder` |
| `Badge` | `tone` (neutral/accent/success/warning/danger/info), `dot`, `icon`, `size` |
| `Chip` | `selected`, `onClick`, `onRemove`, `icon`, `count`, `disabled` |
| `Divider` | `orientation`, `inset`, `label` |
| `Skeleton` / `SkeletonText` | `width`, `height`, `radius`, `lines` |
| `Tooltip` | `content`, `side` (только десктоп — на тач не нужен) |

### Составные

| Компонент | Ключевые пропсы |
|---|---|
| `Card` | `title`, `description`, `action`, `footer`, `padding`, `interactive` |
| `ListItem` / `List` | `leading` (иконка или узел), `title`, `subtitle`, `meta`, `trailing` (chevron/badge/action), `actionIcon`+`actionLabel`, `selected`, `disabled`, `loading`, `density` |
| `DataTable` | `columns[]`, `rows`, `rowKey`, `onRowClick`, `rowAction`, `sort`/`onSortChange`, `loading`, `mobileTitle`, `mobileDetailKeys` |
| `Tabs` | `items[]`, `value`, `onChange`, `variant` (segmented/scrollable), `fullWidth` |
| `DonutChart` / `BarList` / `TrendBars` | `components/ui/charts.tsx`: `data[{label,value,color}]`, `activeIndex`, `onSelect`, `emptyText` |
| `Modal` / `BottomSheet` / `Sheet` | `open`, `onClose`, `title`, `description`, `footer`, `size`, `confirmOnClose`, `isDirty`. `Sheet` — панель справа на десктопе и шторка снизу на мобильном: для длинных форм и списков она удобнее центрированной модалки |
| `Toast` / `useToast` | `show({ title, description, tone, action, duration })` |
| `EmptyState` | `variant` (empty/no-results/error/forbidden), `title`, `description`, `action` |
| `PageHeader` | `title`, `subtitle`, `onBack`, `breadcrumbs`, `actions`, `tabs` |

### Tabs: как не сломать клики

`variant="scrollable"` позволяет тянуть ленту мышью. Важная деталь: **нельзя брать
`setPointerCapture` на `pointerdown`** — тогда `pointerup` уходит контейнеру, и `click`
тоже достаётся ему, а не кнопке: вкладка визуально не переключается (на тач-устройствах
это не проявляется, потому что там capture не используется).

В компоненте клик обрабатывается на контейнере через `closest('[role="tab"]')`, а
capture берётся только когда движение превысило 6 px, то есть началось перетаскивание.
Если добавляете в ленту свои обработчики — не вешайте `setPointerCapture` на `pointerdown`.

## Модалки

Все окна собираются из одного `Modal`/`BottomSheet` — не из собственной разметки.

```tsx
<Modal
  open={isOpen}
  onClose={onClose}
  title="Отметка присутствия"
  description="7А · 16 октября"
  size="md"
  confirmOnClose          // спросить подтверждение при закрытии
  isDirty={hasChanges}    // …если есть несохранённые изменения
  footer={
    <ModalFooter
      onCancel={onClose}
      onSubmit={handleSubmit}
      submitLabel="Сохранить"
      loading={submitting}
      disabled={!isValid}
    />
  }
>
  <FormError message={error} />
  {/* поля */}
</Modal>
```

Правила:

1. **Шторка на мобильном, окно на десктопе** — это решает сам компонент (`useIsMobile`).
2. **Фиксированные шапка и футер**, скроллится только тело. Sticky внутри `overflow` больше не используется.
3. **Один primary-экшен** в футере (`ModalFooter`), «Отмена» — ghost.
4. **Отправка через `useSubmit`**: дождаться ответа → закрыть → показать `Toast`. При ошибке окно остаётся открытым и текст виден в `FormError`. `onSubmit` **должен бросать исключение** при неудаче.
5. **`confirmOnClose` + `isDirty`** — защита от потери введённого. Клик по подложке и Esc спрашивают то же, что крестик.
6. Оверлей рендерится в `document.body` (portal) с ловушкой фокуса, `aria-modal` и блокировкой скролла страницы.
7. Никаких `alert()`/`confirm()` — только `Toast` и встроенные подтверждения.

## Работа с данными

| Механизм | Где | Зачем |
|---|---|---|
| `useSubmit` | `components/ui/kit/useSubmit.ts` | ожидание ответа, состояние загрузки, текст ошибки |
| `FormError` | `Field.tsx` | ошибка отправки в окне, без блокировки |
| `ModalFooter` | `Overlay.tsx` | одинаковые действия во всех окнах |
| `useToast` | `Toast.tsx` | успех/ошибка вне окна, без перекрытия экрана |



```tsx
import { PageHeader, Card, DataTable, Button, useToast, EmptyState } from "@/components/ui/kit";

export default function NewPage() {
  const toast = useToast();

  return (
    <div className="min-h-screen bg-bg">
      <PageHeader
        title="Новый раздел"
        subtitle="Короткое пояснение"
        breadcrumbs={[{ label: "Аналитика", href: "/admin" }]}
        actions={<Button onClick={save}>Сохранить</Button>}
      />
      <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4">
        <Card title="Заголовок блока">{/* содержимое */}</Card>
      </main>
    </div>
  );
}
```

Чек-лист нового экрана:

- [ ] Только токены, ни одного хардкодного цвета.
- [ ] Один primary-экшен.
- [ ] Все нажатия — через компоненты (`Button`, `ListItem`, `Tabs`).
- [ ] Состояния: загрузка (`Skeleton`/`loading`), пусто (`EmptyState`), ошибка (`EmptyState variant="error"`), нет прав (`forbidden`).
- [ ] Проверено на 360px: тап-таргеты ≥ 48, ничего не обрезано, поля не вызывают зум.
- [ ] Проверено в обеих темах.
- [ ] Клавиатура: Tab по интерактивным элементам, Esc закрывает модалку, фокус виден.

## Что осталось (этапы)

1. ~~Токены + UI Kit + витрина~~ — сделано (`/ui`).
2. ~~Каркас: sidebar/desktop, нижний tab bar, шапка, «Ещё»~~ — сделано, см. `components/shell/README.md`.
3. ~~Модалки на новый компонент во всех разделах~~ — сделано: `PassModal`, `AttendanceModal`, `ViolationModal`, `SelfExitModal`, `SchoolRecordModal`, `AuthorizationModal`, `NewsModal`, `NotesModal`, подтверждение в `ClassSelector`.
4. ~~Списки и таблицы~~ — готово: `ViolationsList`, `students`, `students/[aisId]`, `violations`, `violations/stats`, `truants`, `absent`, `school-records`, `classes`, `classes-overview` (+ карточка класса), `users`, учительская `/`. Остались только `ClassSelector` (перекрашен в токены, но структура старая) и `class-management`.
5. PWA-фиксы в старых экранах (тап-таргеты, hover-only, перекрытия).
6. QA-чек-лист и проверка на iOS/Android в standalone.

## Списки и таблицы: как выбирать

| Что нужно | Компонент |
|---|---|
| Список однотипных записей с навигацией (ученики, пропуска, нарушения) | `List` + `ListItem` |
| Табличные данные с сортировкой и разными колонками | `DataTable` — сам переключается на карточки на мобильном |
| Группа действий над строкой | `ListItem trailing="action"` или `DataTable rowAction` |
| Детали строки, которые не влезают | `Modal` по нажатию на строку (не разворачивать внутри таблицы) |

Правила:

- На мобильном не показывайте таблицу с горизонтальным скроллом — `DataTable` уже даёт карточки.
- Вложенных таблиц и разворачивающихся строк избегаем: детали — в модалке.
- Количество строк в подписи всегда честное: «Показано 1–25 из 234», а не молчаливая обрезка.
- Пустые состояния различаем: `EmptyState variant="no-results"` (фильтр не дал результатов) и `"empty"` (данных нет вовсе).
