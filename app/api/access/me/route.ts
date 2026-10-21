// app/api/access/me/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAccess } from "@/lib/access/server";

/**
 * Доступы текущего пользователя для интерфейса: фильтрация меню и проверка
 * страниц. Серверные API защищены отдельно (requireSection), поэтому этот
 * эндпоинт нужен только для навигации и показа «нет доступа».
 */
export async function GET() {
    const access = await getSessionAccess();

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
        isAdmin: access.isAdmin,
        roles: access.roles,
        override: access.override,
        sections: access.sections,
    });
}
