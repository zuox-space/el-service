// lib/roles.ts
//
// Подписи и цвета ролей для интерфейса. Техническое имя роли хранится в БД
// (Role.name), здесь — как её показывать человеку. Роль, добавленная через
// интерфейс, будет показана своим техническим именем, пока не появится здесь.

export type RoleTone = "accent" | "info" | "warning" | "success" | "neutral";

export const ROLE_META: Record<string, { label: string; tone: RoleTone }> = {
    ADMIN: { label: "Администратор", tone: "accent" },
    METHODIST: { label: "Методист", tone: "info" },
    HEAD_TEACHER: { label: "Завуч", tone: "warning" },
    CLASS_TEACHER: { label: "Классный руководитель", tone: "success" },
    TEACHER: { label: "Учитель", tone: "neutral" },
    SECURITY: { label: "Охранник", tone: "info" },
    EMPLOYEE: { label: "Сотрудник", tone: "neutral" },
};

export const roleLabel = (name: string): string => ROLE_META[name]?.label ?? name;

export const roleTone = (name: string): RoleTone => ROLE_META[name]?.tone ?? "neutral";
