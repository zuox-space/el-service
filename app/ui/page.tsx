"use client";

import { useState } from "react";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ClipboardList,
    FileText,
    Info,
    Pencil,
    Search,
    Settings,
    ShieldAlert,
    Trash2,
    UserRound,
    Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
    Badge,
    BottomSheet,
    Button,
    Card,
    Checkbox,
    Chip,
    DataTable,
    Divider,
    EmptyState,
    IconButton,
    Input,
    List,
    ListItem,
    Modal,
    PageHeader,
    RadioGroup,
    SearchInput,
    Select,
    Skeleton,
    SkeletonText,
    Switch,
    Tabs,
    Tooltip,
    useToast,
    type Column,
    type SortState,
} from "@/components/ui/kit";

/* ============================================================================
   Витрина UI Kit.
   Страница существует только для приёмки дизайн-системы: здесь видно каждый
   компонент и его состояния в обеих темах. Она же — пример разметки для новых
   экранов: только токены, только компоненты, никаких градиентов и эмодзи.
   ============================================================================ */

function Section({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <Card title={title} description={description} className={className}>
            {children}
        </Card>
    );
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
    return <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">{children}</p>;
}

/* ----------------------------- демо-данные ------------------------------- */

interface DemoStudent {
    id: string;
    name: string;
    className: string;
    absences: number;
    status: "active" | "warning" | "danger";
}

const demoStudents: DemoStudent[] = [
    { id: "1", name: "Иванов Иван Андреевич", className: "7А", absences: 12, status: "danger" },
    { id: "2", name: "Петрова Мария Сергеевна", className: "7А", absences: 5, status: "warning" },
    { id: "3", name: "Соколов Дмитрий Ильич", className: "8Б", absences: 1, status: "active" },
    { id: "4", name: "Кузнецова Анна Павловна", className: "9А", absences: 0, status: "active" },
];

const statusTone: Record<DemoStudent["status"], "success" | "warning" | "danger"> = {
    active: "success",
    warning: "warning",
    danger: "danger",
};

const statusLabel: Record<DemoStudent["status"], string> = {
    active: "Норма",
    warning: "Внимание",
    danger: "Риск",
};

const colorTokens: Array<{ token: string; className: string; hint: string }> = [
    { token: "bg", className: "bg-bg", hint: "фон приложения" },
    { token: "surface", className: "bg-surface", hint: "карточки, панели" },
    { token: "surface-2", className: "bg-surface-2", hint: "поля, вторичные зоны" },
    { token: "surface-3", className: "bg-surface-3", hint: "hover/active" },
    { token: "border", className: "bg-border", hint: "границы" },
    { token: "border-strong", className: "bg-border-strong", hint: "границы контролов" },
    { token: "fg", className: "bg-fg", hint: "основной текст" },
    { token: "fg-muted", className: "bg-fg-muted", hint: "второстепенный текст" },
    { token: "fg-subtle", className: "bg-fg-subtle", hint: "подписи" },
    { token: "accent", className: "bg-accent", hint: "акцент (текст/иконки)" },
    { token: "accent-solid", className: "bg-accent-solid", hint: "заливка primary" },
    { token: "accent-soft", className: "bg-accent-soft", hint: "выбранное состояние" },
    { token: "success", className: "bg-success", hint: "успех" },
    { token: "warning", className: "bg-warning", hint: "предупреждение" },
    { token: "danger", className: "bg-danger", hint: "ошибка/опасность" },
    { token: "info", className: "bg-info", hint: "информация" },
];

const typeScale = [
    { name: "xs", className: "text-xs", size: "12 / 16" },
    { name: "sm", className: "text-sm", size: "14 / 20" },
    { name: "base", className: "text-base", size: "16 / 24" },
    { name: "lg", className: "text-lg", size: "20 / 28" },
    { name: "xl", className: "text-xl", size: "24 / 32" },
];

const spacing = [4, 8, 12, 16, 24, 32, 48];

export default function UiKitPage() {
    const toast = useToast();

    const [tab, setTab] = useState("passes");
    const [scrollTab, setScrollTab] = useState("all");
    const [switchOn, setSwitchOn] = useState(true);
    const [checkbox, setCheckbox] = useState(true);
    const [radio, setRadio] = useState("sick");
    const [query, setQuery] = useState("");
    const [inputValue, setInputValue] = useState("Иванов И.");
    const [selectValue, setSelectValue] = useState("7А");
    const [modalOpen, setModalOpen] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [dirtyModalOpen, setDirtyModalOpen] = useState(false);
    const [comment, setComment] = useState("");
    const [sort, setSort] = useState<SortState>({ key: "absences", direction: "desc" });

    const columns: Column<DemoStudent>[] = [
        {
            key: "name",
            header: "Ученик",
            sortable: true,
            render: row => <span className="font-medium">{row.name}</span>,
        },
        { key: "className", header: "Класс", width: "96px", sortable: true },
        {
            key: "absences",
            header: "Пропусков",
            width: "120px",
            align: "right",
            sortable: true,
            render: row => <span className="tabular-nums">{row.absences}</span>,
        },
        {
            key: "status",
            header: "Статус",
            width: "120px",
            render: row => <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>,
        },
    ];

    return (
        <div className="min-h-screen bg-bg">
            <PageHeader
                title="UI Kit"
                subtitle="Дизайн-система административного приложения"
                breadcrumbs={[{ label: "Главная", href: "/" }, { label: "UI Kit" }]}
                actions={
                    <>
                        <Badge tone="accent">v1</Badge>
                        <ThemeToggle />
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4">
                {/* --------------------------- ТОКЕНЫ --------------------------- */}
                <Section
                    title="Токены"
                    description="Значения живут в app/globals.css. Тема переключается атрибутом data-theme на <html>."
                >
                    <Label>Цвета (semantic)</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                        {colorTokens.map(item => (
                            <div key={item.token} className="flex flex-col gap-1">
                                <span className={`h-10 rounded-control border border-border ${item.className}`} aria-hidden />
                                <span className="text-xs font-medium text-fg">{item.token}</span>
                                <span className="text-[11px] leading-tight text-fg-subtle">{item.hint}</span>
                            </div>
                        ))}
                    </div>

                    <Divider className="my-4" />

                    <div className="grid gap-6 lg:grid-cols-3">
                        <div>
                            <Label>Типографика — 5 размеров</Label>
                            <div className="space-y-1">
                                {typeScale.map(item => (
                                    <div key={item.name} className="flex items-baseline justify-between gap-2">
                                        <span className={`${item.className} text-fg`}>Список класса</span>
                                        <span className="shrink-0 text-[11px] text-fg-subtle">{item.size}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Сетка 4 / 8</Label>
                            <div className="space-y-1.5">
                                {spacing.map(item => (
                                    <div key={item} className="flex items-center gap-2">
                                        <span className="w-6 shrink-0 text-[11px] tabular-nums text-fg-subtle">{item}</span>
                                        <span className="h-2 rounded-sm bg-accent-soft" style={{ width: item * 3 }} aria-hidden />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Радиусы и тени</Label>
                            <div className="flex items-end gap-2">
                                <div className="flex h-12 w-16 items-center justify-center rounded-control border border-border bg-surface-2 text-[11px] text-fg-muted">6</div>
                                <div className="flex h-12 w-16 items-center justify-center rounded-card border border-border bg-surface-2 text-[11px] text-fg-muted">10</div>
                                <div className="flex h-12 w-16 items-center justify-center rounded-overlay border border-border bg-surface-2 text-[11px] text-fg-muted">16</div>
                            </div>
                            <div className="mt-3 flex items-end gap-2">
                                <div className="flex h-12 w-16 items-center justify-center rounded-card bg-surface text-[11px] text-fg-muted shadow-card">card</div>
                                <div className="flex h-12 w-16 items-center justify-center rounded-card bg-surface text-[11px] text-fg-muted shadow-raised">raised</div>
                                <div className="flex h-12 w-16 items-center justify-center rounded-card bg-surface text-[11px] text-fg-muted shadow-overlay">overlay</div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ---------------------------- КНОПКИ ---------------------------- */}
                <Section title="Button" description="Один primary-экшен на экран. Высота 48px по умолчанию — тап-таргет.">
                    <div className="space-y-4">
                        <div>
                            <Label>Варианты</Label>
                            <Row>
                                <Button>Основное действие</Button>
                                <Button variant="secondary">Второстепенное</Button>
                                <Button variant="ghost">Без фона</Button>
                                <Button variant="danger" leftIcon={Trash2}>
                                    Удалить
                                </Button>
                            </Row>
                        </div>

                        <div>
                            <Label>Размеры</Label>
                            <Row>
                                <Button size="sm">sm · 40</Button>
                                <Button size="md">md · 48</Button>
                                <Button size="lg">lg · 56</Button>
                            </Row>
                        </div>

                        <div>
                            <Label>Состояния</Label>
                            <Row>
                                <Button leftIcon={CheckCircle2}>С иконкой</Button>
                                <Button loading>Сохранение</Button>
                                <Button disabled>Недоступно</Button>
                                <Button variant="secondary" rightIcon={Pencil}>
                                    Изменить
                                </Button>
                            </Row>
                        </div>

                        <div>
                            <Label>IconButton — обязательный label</Label>
                            <Row>
                                <IconButton icon={Search} label="Поиск" variant="secondary" />
                                <IconButton icon={Pencil} label="Редактировать" />
                                <IconButton icon={Trash2} label="Удалить" variant="danger" />
                                <Tooltip content="Обновить данные">
                                    <IconButton icon={Calendar} label="Обновить" variant="secondary" />
                                </Tooltip>
                            </Row>
                        </div>

                        <div>
                            <Label>Full width (мобильный сценарий)</Label>
                            <Button fullWidth leftIcon={ClipboardList}>
                                Отметить посещаемость
                            </Button>
                        </div>
                    </div>
                </Section>

                {/* ----------------------------- ПОЛЯ ---------------------------- */}
                <Section title="Поля ввода" description="Шрифт 16px и высота 48px: iOS не зумит страницу при фокусе.">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Input label="Фамилия и имя" placeholder="Начните вводить" value={inputValue} onChange={e => setInputValue(e.target.value)} clearable onClear={() => setInputValue("")} hint="Поиск по базе школы" />
                        <Input label="Комментарий" placeholder="Необязательно" error="Слишком длинный комментарий" defaultValue="Слишком длинный текст" />
                        <Input label="Дата" type="date" defaultValue="2026-10-16" />
                        <Input label="Недоступное поле" defaultValue="Только чтение" disabled />
                        <Select
                            label="Класс"
                            value={selectValue}
                            onChange={setSelectValue}
                            options={[
                                { value: "1А", label: "1А" },
                                { value: "7А", label: "7А" },
                                { value: "9А", label: "9А" },
                                { value: "10А", label: "10А" },
                            ]}
                        />
                        <div className="flex flex-col gap-1.5">
                            <Label>Поиск</Label>
                            <SearchInput value={query} onChange={setQuery} placeholder="Ученик или класс" />
                        </div>
                    </div>

                    <Divider className="my-4" />

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <Checkbox checked={checkbox} onChange={setCheckbox} label="Отмечен" description="Подпись-описание" />
                            <Checkbox checked={false} onChange={() => { }} label="Не отмечен" />
                            <Checkbox checked={false} onChange={() => { }} label="Недоступен" disabled />
                        </div>

                        <div className="space-y-4">
                            <RadioGroup
                                label="Причина отсутствия"
                                value={radio}
                                onChange={setRadio}
                                options={[
                                    { value: "sick", label: "Болен", description: "Справка от врача" },
                                    { value: "family", label: "По заявлению родителей" },
                                    { value: "other", label: "Причина неясна", disabled: true },
                                ]}
                            />
                            <Switch checked={switchOn} onChange={setSwitchOn} label="Показывать ушедших" description="Только сегодня" />
                        </div>
                    </div>
                </Section>

                {/* -------------------------- БЕЙДЖИ, ЧИПЫ ------------------------ */}
                <Section title="Badge и Chip" description="Статусы — через семантику tone, а не произвольный цвет.">
                    <Label>Badge</Label>
                    <Row>
                        <Badge>Черновик</Badge>
                        <Badge tone="accent">Активно</Badge>
                        <Badge tone="success" dot>
                            Норма
                        </Badge>
                        <Badge tone="warning" dot>
                            Внимание
                        </Badge>
                        <Badge tone="danger" dot>
                            Риск
                        </Badge>
                        <Badge tone="info" icon={Info}>
                            Информация
                        </Badge>
                    </Row>

                    <Divider className="my-4" />

                    <Label>Chip — фильтры (нажимаются)</Label>
                    <Row>
                        <Chip selected onClick={() => { }}>
                            Все классы
                        </Chip>
                        <Chip count={12} onClick={() => { }}>
                            7А
                        </Chip>
                        <Chip count={8} onClick={() => { }}>
                            8Б
                        </Chip>
                        <Chip icon={Calendar} onClick={() => { }}>
                            Сегодня
                        </Chip>
                        <Chip onRemove={() => { }} onClick={() => { }}>
                            Удаляемый фильтр
                        </Chip>
                        <Chip disabled>Недоступен</Chip>
                    </Row>
                </Section>

                {/* ---------------------------- ВКЛАДКИ --------------------------- */}
                <Section
                    title="Tabs"
                    description="segmented — основная навигация раздела; scrollable — много пунктов, без стрелок: снап, маски по краям, перетаскивание."
                >
                    <Label>segmented</Label>
                    <Tabs
                        value={tab}
                        onChange={setTab}
                        items={[
                            { id: "passes", label: "Пропуска", icon: FileText, count: 4 },
                            { id: "departed", label: "Ушедшие", icon: Users },
                            { id: "self", label: "Самовыход", icon: UserRound },
                        ]}
                    />

                    <Divider className="my-4" />

                    <Label>scrollable — попробуйте прокрутить и перетащить мышью</Label>
                    <Tabs
                        variant="scrollable"
                        value={scrollTab}
                        onChange={setScrollTab}
                        items={[
                            { id: "all", label: "Все" },
                            { id: "1", label: "1А", count: 24 },
                            { id: "2", label: "1Б", count: 25 },
                            { id: "3", label: "2А", count: 22 },
                            { id: "4", label: "2Б", count: 26 },
                            { id: "5", label: "3А", count: 23 },
                            { id: "6", label: "4А", count: 24 },
                            { id: "7", label: "5А", count: 20 },
                            { id: "8", label: "6А", count: 21 },
                            { id: "9", label: "7А", count: 19 },
                            { id: "10", label: "8Б", count: 18 },
                            { id: "11", label: "9А", count: 22 },
                            { id: "12", label: "10А", count: 19 },
                        ]}
                    />
                </Section>

                {/* ---------------------------- СПИСКИ --------------------------- */}
                <Section title="ListItem и List" description="Строка — настоящая кнопка или ссылка: работает клавиатура и тап в PWA.">
                    <List>
                        <ListItem leading={UserRound} title="Иванов Иван Андреевич" subtitle="7А · 12 пропусков" trailing="chevron" onClick={() => { }} />
                        <ListItem leading={Calendar} title="Пропуск №245" subtitle="Выход 12:30 · заявление родителей" trailing="badge" trailingContent={<Badge tone="warning">Не отмечен</Badge>} onClick={() => { }} />
                        <ListItem
                            leading={ClipboardList}
                            title="Нарушение: телефон"
                            subtitle="Сегодня, 10:15 · Петров С.А."
                            trailing="action"
                            actionIcon={Trash2}
                            actionLabel="Удалить нарушение"
                            actionTone="danger"
                            onActionClick={() => { }}
                            onClick={() => { }}
                        />
                        <ListItem leading={ShieldAlert} title="Состоит на ВШУ" subtitle="Поставлен 12.02.2026" selected onClick={() => { }} />
                        <ListItem leading={Users} title="Класс 7А" subtitle="19 учеников" trailing="chevron" disabled />
                        <ListItem loading title="Загрузка" />
                    </List>
                </Section>

                {/* --------------------------- ТАБЛИЦА --------------------------- */}
                <Section
                    title="DataTable"
                    description="На десктопе — таблица с сортировкой; на мобильном — карточки-строки из тех же колонок."
                >
                    <DataTable
                        columns={columns}
                        rows={demoStudents}
                        rowKey={row => row.id}
                        sort={sort}
                        onSortChange={setSort}
                        onRowClick={() => { }}
                        mobileTitle={row => row.name}
                        mobileSubtitle={row => `${row.className} · пропусков: ${row.absences}`}
                        mobileDetailKeys={["status"]}
                        rowAction={row => (
                            <IconButton icon={Pencil} label={`Изменить ${row.name}`} size={40} variant="ghost" onClick={() => { }} />
                        )}
                        caption="Пропуски по ученикам"
                    />

                    <div className="mt-4 space-y-2">
                        <Label>Состояния: загрузка и пусто</Label>
                        <DataTable columns={columns} rows={[]} rowKey={row => row.id} loading caption="Загрузка" />
                        <DataTable
                            columns={columns}
                            rows={[]}
                            rowKey={row => row.id}
                            emptyTitle="Ученики не найдены"
                            emptyDescription="Проверьте класс или запрос поиска"
                        />
                    </div>
                </Section>

                {/* ---------------------------- ОВЕРЛЕИ -------------------------- */}
                <Section
                    title="Modal и BottomSheet"
                    description="На мобильном — шторка снизу, на десктопе — центрированная модалка. Esc, ловушка фокуса, фиксированные header и footer."
                >
                    <Row>
                        <Button variant="secondary" onClick={() => setModalOpen(true)}>
                            Открыть модалку
                        </Button>
                        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                            Открыть BottomSheet
                        </Button>
                        <Button variant="secondary" onClick={() => setDirtyModalOpen(true)}>
                            С несохранёнными данными
                        </Button>
                    </Row>

                    <Modal
                        open={modalOpen}
                        onClose={() => setModalOpen(false)}
                        title="Отметить посещаемость"
                        description="7А · 16 октября 2026"
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                                    Отмена
                                </Button>
                                <Button
                                    onClick={() => {
                                        setModalOpen(false);
                                        toast.show({ title: "Отметка сохранена", description: "7А · 24 присутствуют", tone: "success" });
                                    }}
                                >
                                    Сохранить
                                </Button>
                            </div>
                        }
                    >
                        <div className="space-y-3">
                            <p className="text-sm text-fg-muted">
                                Скроллится только это содержимое: заголовок и кнопки остаются на месте.
                            </p>
                            <Input label="Комментарий к отметке" placeholder="Необязательно" />
                            <RadioGroup
                                label="Причина отсутствия"
                                value={radio}
                                onChange={setRadio}
                                options={[
                                    { value: "sick", label: "Болен" },
                                    { value: "family", label: "По заявлению родителей" },
                                    { value: "competition", label: "Соревнования" },
                                ]}
                            />
                        </div>
                    </Modal>

                    <BottomSheet
                        open={sheetOpen}
                        onClose={() => setSheetOpen(false)}
                        title="Быстрые действия"
                        description="7А · Иванов Иван"
                        footer={
                            <Button fullWidth onClick={() => setSheetOpen(false)}>
                                Готово
                            </Button>
                        }
                    >
                        <List>
                            <ListItem leading={FileText} title="Выдать пропуск" trailing="chevron" onClick={() => setSheetOpen(false)} />
                            <ListItem leading={AlertTriangle} title="Зафиксировать нарушение" trailing="chevron" onClick={() => setSheetOpen(false)} />
                            <ListItem leading={ShieldAlert} title="Поставить на ВШУ" trailing="chevron" onClick={() => setSheetOpen(false)} />
                        </List>
                    </BottomSheet>

                    <Modal
                        open={dirtyModalOpen}
                        onClose={() => {
                            setDirtyModalOpen(false);
                            setComment("");
                        }}
                        title="Нарушение"
                        description="Закрытие с несохранёнными данными требует подтверждения"
                        confirmOnClose
                        isDirty={comment.length > 0}
                        footer={
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button variant="ghost" onClick={() => setDirtyModalOpen(false)}>
                                    Отмена
                                </Button>
                                <Button
                                    onClick={() => {
                                        setDirtyModalOpen(false);
                                        setComment("");
                                        toast.show({ title: "Нарушение создано", tone: "success" });
                                    }}
                                >
                                    Сохранить
                                </Button>
                            </div>
                        }
                    >
                        <div className="space-y-3">
                            <Input
                                label="Комментарий"
                                placeholder="Введите текст, затем попробуйте закрыть"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                            />
                            <p className="text-xs text-fg-subtle">
                                Если поле не пустое, при закрытии появится запрос подтверждения.
                            </p>
                        </div>
                    </Modal>
                </Section>

                {/* ---------------------------- ТОСТЫ ---------------------------- */}
                <Section title="Toast" description="Замена alert(): не блокирует интерфейс, складывается в стек, объявляется скринридером.">
                    <Row>
                        <Button variant="secondary" onClick={() => toast.show({ title: "Пропуск выдан", description: "Иванов И. · выход 12:30", tone: "success" })}>
                            Успех
                        </Button>
                        <Button variant="secondary" onClick={() => toast.show({ title: "Нет соединения", description: "Изменения сохранены локально", tone: "warning" })}>
                            Предупреждение
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                toast.show({
                                    title: "Не удалось сохранить",
                                    tone: "danger",
                                    action: { label: "Повторить", onClick: () => { } },
                                })
                            }
                        >
                            Ошибка с действием
                        </Button>
                        <Button variant="secondary" onClick={() => toast.show({ title: "Данные обновлены", tone: "info" })}>
                            Информация
                        </Button>
                    </Row>
                </Section>

                {/* ------------------------- ПУСТЫЕ СОСТОЯНИЯ -------------------- */}
                <Section
                    title="EmptyState"
                    description="Четыре разных смысла, которые раньше выглядели одинаково — «нет данных»."
                >
                    <div className="grid gap-3 md:grid-cols-2">
                        <EmptyState variant="empty" title="Сегодня пропусков нет" description="Записи появятся, когда классный руководитель выдаст пропуск" />
                        <EmptyState variant="no-results" title="Ничего не найдено" description="Измените запрос или сбросьте фильтры" action={{ label: "Сбросить фильтры", onClick: () => { } }} />
                        <EmptyState variant="error" title="Не удалось загрузить" description="Сервер вернул ошибку 500" action={{ label: "Повторить", onClick: () => { } }} />
                        <EmptyState variant="forbidden" title="Нет доступа" description="Раздел доступен администратору" />
                    </div>
                </Section>

                {/* --------------------------- СКЕЛЕТОНЫ ------------------------- */}
                <Section title="Skeleton" description="Заглушки вместо спиннера: вёрстка не «прыгает» при загрузке.">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                            <Skeleton height={20} width="40%" />
                            <SkeletonText lines={3} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <Skeleton width={40} height={40} radius="full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton height={12} width="60%" />
                                    <Skeleton height={10} width="35%" />
                                </div>
                            </div>
                            <Skeleton height={48} radius="card" />
                        </div>
                    </div>
                </Section>

                {/* --------------------------- ПРАВИЛА --------------------------- */}
                <Section title="Правила системы" description="Что обеспечивает единообразие при добавлении новых экранов.">
                    <ul className="space-y-2 text-sm text-fg-muted">
                        {[
                            "Цвета, радиусы и тени берутся только из токенов — никаких #1a2332 и bg-surface в новых экранах.",
                            "Один primary-экшен на экран; остальные действия — secondary или ghost.",
                            "Иконки — Lucide, 20/24px, strokeWidth 1.75, цвет fg-muted; эмодзи не используются.",
                            "Тап-таргет не меньше 48×48: кнопки md/lg и IconButton size 48.",
                            "Все интерактивные элементы — компоненты (Button, ListItem, Tabs), не div с onClick.",
                            "Никаких градиентных кнопок, glassmorphism и цветных свечений.",
                            "Мобильный — основной режим: проверять на 360px, затем 768 / 1024 / 1440.",
                        ].map(rule => (
                            <li key={rule} className="flex gap-2">
                                <CheckCircle2 size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success" aria-hidden />
                                <span>{rule}</span>
                            </li>
                        ))}
                    </ul>

                    <Divider className="my-4" />

                    <Row>
                        <Badge tone="neutral" icon={Settings}>
                            Токены: app/globals.css
                        </Badge>
                        <Badge tone="neutral" icon={FileText}>
                            Компоненты: components/ui/kit
                        </Badge>
                        <Badge tone="neutral" icon={Calendar}>
                            Тема: components/theme
                        </Badge>
                    </Row>
                </Section>
            </main>
        </div>
    );
}
