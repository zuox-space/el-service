// lib/keys/queries.ts
//
// Доменная логика ключницы, перенесённая из keys-app и адаптированная под наши
// пользователи (User.id — строка) и доступы (разделы keys / keysAdmin).
import {
    KeyAccessScope,
    KeyRequestStatus,
    KeyRequestType,
    KeyStatus,
    Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessForUser, sectionsForRoleList, type AccessInfo } from "@/lib/access/server";
import { canAdminKeys, canConfirmKeys, canUseKeys, isKeysOperatorOnly } from "./access";
import { broadcastKeys } from "./bus";

/* ---------------------------------- типы ---------------------------------- */

export interface KeyRequestDto {
    id: string;
    type: KeyRequestType;
    status: KeyRequestStatus;
    requestedById: string;
    requestedByName: string;
    targetUserId: string | null;
    targetUserName: string | null;
    decidedByName: string | null;
    createdAt: string;
    updatedAt: string;
    expiresAt: string | null;
    keys: Array<{ id: string; buildingId: string; roomNumber: string; roomName: string; buildingName: string }>;
}

export interface KeyItemDto {
    id: string;
    buildingId: string;
    buildingName: string;
    roomNumber: string;
    roomName: string;
    floor: number;
    status: KeyStatus;
    holderId: string | null;
    holderName: string | null;
    issuedAt: string | null;
    accessScope: KeyAccessScope;
    favorite: boolean;
    pending: KeyRequestDto | null;
}

export interface KeysState {
    buildings: Array<{ id: string; name: string; address: string; classes: Array<{ id: string; name: string }> }>;
    keys: KeyItemDto[];
    requests: KeyRequestDto[];
    favorites: string[];
    canConfirm: boolean;
    canAdmin: boolean;
    canRequest: boolean;
    me: { id: string; name: string };
}

export interface KeyHistoryQuery {
    buildingId?: string | null;
    floor?: number | null;
    keyId?: string | null;
    type?: string | null;
    status?: string | null;
    q?: string | null;
    participantId?: string | null;
    participantName?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    limit?: number;
    offset?: number;
}

/* -------------------------------- include --------------------------------- */

const requestInclude = {
    requester: { select: { id: true, name: true } },
    targetUser: { select: { id: true, name: true } },
    decider: { select: { id: true, name: true } },
    keys: {
        include: {
            key: {
                select: {
                    id: true,
                    buildingId: true,
                    roomNumber: true,
                    roomName: true,
                    building: { select: { name: true } },
                },
            },
        },
    },
} satisfies Prisma.KeyRequestInclude;

type RequestRow = Prisma.KeyRequestGetPayload<{ include: typeof requestInclude }>;

const keyInclude = {
    building: { select: { id: true, name: true } },
    holder: { select: { id: true, name: true } },
} satisfies Prisma.KeyItemInclude;

type KeyRow = Prisma.KeyItemGetPayload<{ include: typeof keyInclude }>;

/* ------------------------------- сериализация ------------------------------ */

export function shortName(fullName: string | null | undefined): string {
    if (!fullName) return "Сотрудник";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return parts[0] ?? "Сотрудник";
    return `${parts[1]} ${parts[0][0]}.${parts[2] ? ` ${parts[2][0]}.` : ""}`;
}

function toRequest(row: RequestRow): KeyRequestDto {
    return {
        id: row.id,
        type: row.type,
        status: row.status,
        requestedById: row.requestedById,
        requestedByName: shortName(row.requester?.name),
        targetUserId: row.targetUserId,
        targetUserName: row.targetUser ? shortName(row.targetUser.name) : null,
        decidedByName: row.decider ? shortName(row.decider.name) : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        keys: row.keys.map(item => ({
            id: item.key.id,
            buildingId: item.key.buildingId,
            roomNumber: item.key.roomNumber,
            roomName: item.key.roomName,
            buildingName: item.key.building.name,
        })),
    };
}

function toKey(row: KeyRow, favorite: boolean, pending: KeyRequestDto | null): KeyItemDto {
    return {
        id: row.id,
        buildingId: row.buildingId,
        buildingName: row.building.name,
        roomNumber: row.roomNumber,
        roomName: row.roomName,
        floor: row.floor,
        status: row.status,
        holderId: row.holderId,
        holderName: row.holder ? shortName(row.holder.name) : null,
        issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
        accessScope: row.accessScope,
        favorite,
        pending,
    };
}

/* --------------------------------- состояние ------------------------------- */

const KEY_REQUEST_TTL_MS = 60_000;

async function cancelExpiredRequests(): Promise<void> {
    const now = new Date();
    await prisma.keyRequest.updateMany({
        where: { status: "PENDING", expiresAt: { lte: now } },
        data: { status: "CANCELLED", updatedAt: now },
    });
}

export async function buildKeysState(access: AccessInfo): Promise<KeysState> {
    await cancelExpiredRequests();
    const manage = canConfirmKeys(access);
    const admin = canAdminKeys(access);
    const requestable = canUseKeys(access) && !isKeysOperatorOnly(access);

    const employeeKeyFilter: Prisma.KeyItemWhereInput = manage
        ? {}
        : {
            OR: [{ accessScope: "ALL" }, { permissions: { some: { userId: access.userId } } }],
        };

    const requestFilter: Prisma.KeyRequestWhereInput = manage
        ? {}
        : { OR: [{ requestedById: access.userId }, { targetUserId: access.userId }] };

    const [buildings, keyRows, pendingRows, requestRows, favorites, me] = await Promise.all([
        prisma.keyBuilding.findMany({
            orderBy: { name: "asc" },
            include: { classes: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
        }),
        prisma.keyItem.findMany({ where: employeeKeyFilter, include: keyInclude }),
        prisma.keyRequest.findMany({ where: { status: "PENDING" }, include: requestInclude }),
        prisma.keyRequest.findMany({
            where: requestFilter,
            include: requestInclude,
            orderBy: { createdAt: "desc" },
            take: 100,
        }),
        prisma.keyFavorite.findMany({ where: { userId: access.userId }, select: { keyId: true } }),
        prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } }),
    ]);

    const pendingByKey = new Map<string, KeyRequestDto>();
    for (const row of pendingRows) {
        const dto = toRequest(row);
        for (const item of dto.keys) pendingByKey.set(item.id, dto);
    }

    const favoriteIds = new Set(favorites.map(item => item.keyId));
    const keys = keyRows
        .sort(
            (a, b) =>
                a.building.name.localeCompare(b.building.name, "ru") ||
                a.roomNumber.localeCompare(b.roomNumber, "ru", { numeric: true }),
        )
        .map(row => toKey(row, favoriteIds.has(row.id), pendingByKey.get(row.id) ?? null));

    return {
        buildings,
        keys,
        requests: requestRows.map(toRequest),
        favorites: [...favoriteIds],
        canConfirm: manage,
        canAdmin: admin,
        canRequest: requestable,
        me: { id: access.userId, name: shortName(me?.name) },
    };
}

/* -------------------------------- проверки -------------------------------- */

export async function canAccessKey(access: AccessInfo, key: { id: string; accessScope: KeyAccessScope }): Promise<boolean> {
    if (canConfirmKeys(access)) return true;
    if (key.accessScope === "ALL") return true;
    const permission = await prisma.keyPermission.findUnique({
        where: { userId_keyId: { userId: access.userId, keyId: key.id } },
    });
    return permission !== null;
}

export async function listKeyUsers(): Promise<
    Array<{ id: string; name: string; email: string; roles: string[] }>
> {
    const users = await prisma.user.findMany({
        where: { archived: false },
        select: {
            id: true,
            name: true,
            email: true,
            accessOverride: true,
            sectionAccess: { select: { section: true, allowed: true } },
            userRoles: { select: { role: { select: { name: true, defaultSections: true } } } },
        },
        orderBy: { name: "asc" },
    });

    return users
        .map(user => {
            const roles = user.userRoles.map(item => ({
                name: item.role.name,
                defaultSections: item.role.defaultSections,
            }));
            const sections = user.accessOverride
                ? user.sectionAccess.filter(row => row.allowed).map(row => row.section)
                : sectionsForRoleList(roles);

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                roles: roles.map(role => role.name),
                sections,
            };
        })
        .filter(user => user.sections.includes("keys"))
        .map(({ sections, ...user }) => user);
}

/* --------------------------------- журнал --------------------------------- */

export async function writeKeyLog(entry: {
    keyId?: string | null;
    requestId?: string | null;
    actorId?: string | null;
    action: string;
    details: string;
}): Promise<void> {
    await prisma.keyActivity.create({
        data: {
            keyId: entry.keyId ?? null,
            requestId: entry.requestId ?? null,
            actorId: entry.actorId ?? null,
            action: entry.action,
            details: entry.details,
        },
    });
}

/* -------------------------------- заявки ---------------------------------- */

export class KeysConflictError extends Error {}

export async function createKeyRequest(
    access: AccessInfo,
    input: { type: KeyRequestType; keyIds: string[]; targetUserId?: string | null },
): Promise<{ requestId: string }> {
    await cancelExpiredRequests();
    if (!canUseKeys(access)) throw new KeysConflictError("Нет доступа к ключам");
    if (isKeysOperatorOnly(access)) throw new KeysConflictError("Охрана не создаёт заявки — она их обрабатывает");

    const keyIds = [...new Set(input.keyIds.filter(Boolean))];
    if (!["ISSUE", "RETURN", "TRANSFER"].includes(input.type)) throw new KeysConflictError("Некорректный тип заявки");
    if (keyIds.length === 0) throw new KeysConflictError("Выберите хотя бы один ключ");
    if (keyIds.length > 30) throw new KeysConflictError("Слишком много ключей за раз (максимум 30)");

    const keys = await prisma.keyItem.findMany({
        where: { id: { in: keyIds } },
        include: { building: { select: { name: true } } },
    });
    if (keys.length !== keyIds.length) throw new KeysConflictError("Некоторые ключи не найдены");

    for (const key of keys) {
        if (!(await canAccessKey(access, key))) {
            throw new KeysConflictError(`Нет доступа к ключу ${key.roomNumber}`);
        }
    }

    let targetUserId: string | null = null;
    if (input.type === "TRANSFER") {
        const targetId = input.targetUserId ?? "";
        if (!targetId) throw new KeysConflictError("Укажите коллегу");
        if (targetId === access.userId) throw new KeysConflictError("Нельзя передать ключ самому себе");

        const target = await getAccessForUser(targetId);
        const targetUser = await prisma.user.findUnique({ where: { id: targetId }, select: { archived: true } });
        if (!target || targetUser?.archived || !target.sections.includes("keys")) {
            throw new KeysConflictError("У коллеги нет доступа к ключам");
        }
        if (target.roles.includes("SECURITY")) throw new KeysConflictError("Нельзя передать ключ охране");

        for (const key of keys) {
            if (!(await canAccessKey(target, key))) {
                throw new KeysConflictError(`У коллеги нет доступа к ключу ${key.roomNumber}`);
            }
        }

        targetUserId = targetId;
    }

    const roomLabel = keys.map(key => key.roomNumber).join(", ");
    const requesterName = shortName(
        (await prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } }))?.name,
    );

    const requestId = await prisma.$transaction(async tx => {
        const busy = await tx.keyRequestItem.findFirst({
            where: { keyId: { in: keyIds }, request: { status: "PENDING" } },
            include: { key: { select: { roomNumber: true } } },
        });
        if (busy) throw new KeysConflictError(`По ключу ${busy.key.roomNumber} уже есть активная заявка`);

        const businessKeys = await tx.keyItem.findMany({ where: { id: { in: keyIds } } });

        if (input.type === "ISSUE") {
            const taken = businessKeys.filter(key => key.status !== "FREE");
            if (taken.length > 0) {
                throw new KeysConflictError(`Ключи уже на руках: ${taken.map(key => key.roomNumber).join(", ")}`);
            }
        } else {
            const notMine = businessKeys.filter(
                key => key.status !== "ISSUED" || key.holderId !== access.userId,
            );
            if (notMine.length > 0) {
                throw new KeysConflictError(`Ключи не у вас: ${notMine.map(key => key.roomNumber).join(", ")}`);
            }
        }

        const created = await tx.keyRequest.create({
            data: {
                type: input.type,
                requestedById: access.userId,
                targetUserId,
                expiresAt: new Date(Date.now() + KEY_REQUEST_TTL_MS),
                keys: { create: keyIds.map(keyId => ({ keyId })) },
            },
        });
        return created.id;
    });

    const action =
        input.type === "ISSUE" ? "request_issue" : input.type === "RETURN" ? "request_return" : "request_transfer";
    const details =
        input.type === "TRANSFER"
            ? `Запрос на передачу (${keyIds.length}): ${roomLabel} — ${requesterName} → ${shortName(
                (await prisma.user.findUnique({ where: { id: targetUserId! }, select: { name: true } }))?.name,
            )}`
            : `Запрос на ${input.type === "ISSUE" ? "выдачу" : "сдачу"} (${keyIds.length}): ${roomLabel} — ${requesterName}`;

    await writeKeyLog({
        keyId: keyIds.length === 1 ? keyIds[0] : null,
        requestId,
        actorId: access.userId,
        action,
        details,
    });
    broadcastKeys("update", { at: new Date().toISOString(), requestId });

    return { requestId };
}

export async function decideKeyRequest(
    access: AccessInfo,
    requestId: string,
    action: "confirm" | "cancel",
): Promise<void> {
    const item = await prisma.keyRequest.findUnique({
        where: { id: requestId },
        include: requestInclude,
    });
    if (!item) throw new KeysConflictError("Заявка не найдена");
    if (item.status !== "PENDING") throw new KeysConflictError("Заявка уже обработана");
    if (item.expiresAt && item.expiresAt.getTime() <= Date.now()) {
        await cancelExpiredRequests();
        throw new KeysConflictError("Заявка истекла — создайте новую");
    }

    const manage = canConfirmKeys(access);
    const isTransfer = item.type === "TRANSFER";
    const isTarget = item.targetUserId === access.userId;
    const isRequester = item.requestedById === access.userId;

    if (action === "confirm") {
        if (isTransfer) {
            if (!isTarget) throw new KeysConflictError("Ключ может принять только получатель");
        } else if (!manage) {
            throw new KeysConflictError("Выдать или принять ключ может только охрана или администратор ключей");
        }
    } else if (!(manage || isRequester || (isTransfer && isTarget))) {
        throw new KeysConflictError("Нет прав на отмену заявки");
    }

    const keyIds = item.keys.map(row => row.keyId);
    const now = new Date();

    await prisma.$transaction(async tx => {
        const claimed = await tx.keyRequest.updateMany({
            where: { id: requestId, status: "PENDING" },
            data: {
                status: action === "confirm" ? "CONFIRMED" : "CANCELLED",
                decidedById: access.userId,
                updatedAt: now,
            },
        });
        if (claimed.count === 0) throw new KeysConflictError("Заявка уже обработана");
        if (action !== "confirm") return;

        const keys = await tx.keyItem.findMany({ where: { id: { in: keyIds } } });

        if (item.type === "ISSUE") {
            const taken = keys.filter(key => key.status !== "FREE");
            if (taken.length > 0) {
                throw new KeysConflictError(`Ключи уже выданы: ${taken.map(key => key.roomNumber).join(", ")}`);
            }
            await tx.keyItem.updateMany({
                where: { id: { in: keyIds } },
                data: { status: "ISSUED", holderId: item.requestedById, issuedAt: now },
            });
        } else if (item.type === "RETURN") {
            const wrong = keys.filter(
                key => key.status !== "ISSUED" || key.holderId !== item.requestedById,
            );
            if (wrong.length > 0) {
                throw new KeysConflictError(`Ключи не у этого сотрудника: ${wrong.map(key => key.roomNumber).join(", ")}`);
            }
            await tx.keyItem.updateMany({
                where: { id: { in: keyIds } },
                data: { status: "FREE", holderId: null, issuedAt: null },
            });
        } else {
            const wrong = keys.filter(
                key => key.status !== "ISSUED" || key.holderId !== item.requestedById,
            );
            if (wrong.length > 0 || !item.targetUserId) {
                throw new KeysConflictError("Передача невозможна: ключи не у этого сотрудника");
            }
            await tx.keyItem.updateMany({
                where: { id: { in: keyIds } },
                data: { holderId: item.targetUserId, issuedAt: now },
            });
        }
    });

    const requesterName = shortName(item.requester?.name);
    const rooms = item.keys.map(row => row.key.roomNumber).join(", ");
    let logAction: string;
    let details: string;

    if (action === "cancel") {
        logAction = "cancel";
        const suffix = isRequester ? "отменён отправителем" : isTarget ? "отклонён получателем" : "отклонён охраной";
        details = `Запрос ${suffix} (${keyIds.length}): ${rooms} — ${requesterName}`;
    } else if (item.type === "ISSUE") {
        logAction = "confirm_issue";
        details = `Выдан ключ (${keyIds.length}): ${rooms} — ${requesterName}`;
    } else if (item.type === "RETURN") {
        logAction = "confirm_return";
        details = `Принят ключ (${keyIds.length}): ${rooms} — ${requesterName}`;
    } else {
        logAction = "confirm_transfer";
        details = `Передан ключ (${keyIds.length}): ${rooms} — ${requesterName} → ${shortName(item.targetUser?.name)}`;
    }

    await writeKeyLog({
        keyId: keyIds.length === 1 ? keyIds[0] : null,
        requestId,
        actorId: access.userId,
        action: logAction,
        details,
    });
    broadcastKeys("update", { at: new Date().toISOString(), requestId, action });
}

/* --------------------------------- история -------------------------------- */

export async function queryKeyHistory(
    access: AccessInfo,
    params: KeyHistoryQuery,
): Promise<{ items: KeyRequestDto[]; total: number; hasMore: boolean; participants: Array<{ id: string; name: string }> }> {
    await cancelExpiredRequests();
    const where: Prisma.KeyRequestWhereInput = {};

    const keyFilter: Prisma.KeyItemWhereInput = {};
    if (params.buildingId) keyFilter.buildingId = params.buildingId;
    if (params.floor) keyFilter.floor = Number(params.floor);
    if (params.keyId) keyFilter.id = params.keyId;
    if (Object.keys(keyFilter).length > 0) where.keys = { some: { key: keyFilter } };
    if (params.type && params.type !== "all") where.type = params.type as KeyRequestType;
    if (params.status && params.status !== "all") where.status = params.status as KeyRequestStatus;

    if (params.dateFrom) {
        const from = new Date(`${params.dateFrom}T00:00:00`);
        if (!Number.isNaN(from.getTime())) where.createdAt = { gte: from };
    }
    if (params.dateTo) {
        const to = new Date(`${params.dateTo}T00:00:00`);
        if (!Number.isNaN(to.getTime())) {
            to.setDate(to.getDate() + 1);
            where.createdAt = { ...(where.createdAt as object), lt: to };
        }
    }

    if (!canConfirmKeys(access)) {
        where.OR = [{ requestedById: access.userId }, { targetUserId: access.userId }];
    }

    if (params.q?.trim()) {
        const q = params.q.trim().toLowerCase();
        const own = where.OR;
        where.AND = [
            ...(own ? [{ OR: own }] : []),
            {
                OR: [
                    { requester: { name: { contains: q, mode: "insensitive" } } },
                    { targetUser: { name: { contains: q, mode: "insensitive" } } },
                    { keys: { some: { key: { roomNumber: { contains: q, mode: "insensitive" } } } } },
                    { keys: { some: { key: { roomName: { contains: q, mode: "insensitive" } } } } },
                ],
            },
        ];
        delete where.OR;
    }

    // Список участников операций — для фильтра в истории ключа.
    const participantRows = await prisma.keyRequest.findMany({
        where,
        select: {
            requester: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true } },
            decider: { select: { id: true, name: true } },
        },
    });
    const participantMap = new Map<string, string>();
    for (const row of participantRows) {
        for (const user of [row.requester, row.targetUser, row.decider]) {
            if (user) participantMap.set(user.id, user.name);
        }
    }
    const participants = [...participantMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    if (params.participantId) {
        const participantId = params.participantId;
        where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
            {
                OR: [
                    { requestedById: participantId },
                    { targetUserId: participantId },
                    { decidedById: participantId },
                ],
            },
        ];
    }

    if (params.participantName?.trim()) {
        const name = params.participantName.trim();
        where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
            {
                OR: [
                    { requester: { name: { contains: name, mode: "insensitive" } } },
                    { targetUser: { name: { contains: name, mode: "insensitive" } } },
                    { decider: { name: { contains: name, mode: "insensitive" } } },
                ],
            },
        ];
    }

    const limit = Math.min(Math.max(params.limit ?? 30, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const [total, rows] = await Promise.all([
        prisma.keyRequest.count({ where }),
        prisma.keyRequest.findMany({
            where,
            include: requestInclude,
            orderBy: { createdAt: "desc" },
            skip: offset,
            take: limit,
        }),
    ]);

    return { items: rows.map(toRequest), total, hasMore: offset + rows.length < total, participants };
}

/* ------------------------------ администрирование -------------------------- */

export async function listAdminKeys(): Promise<KeyItemDto[]> {
    const [keys, favorites] = await Promise.all([
        prisma.keyItem.findMany({ include: keyInclude }),
        prisma.keyFavorite.findMany({ select: { keyId: true } }),
    ]);
    const favoriteIds = new Set(favorites.map(item => item.keyId));
    return keys.map(row => toKey(row, favoriteIds.has(row.id), null));
}

export async function createKey(input: {
    buildingId: string;
    roomNumber: string;
    roomName?: string;
    floor?: number;
    accessScope?: KeyAccessScope;
}): Promise<{ id: string }> {
    const building = await prisma.keyBuilding.findUnique({ where: { id: input.buildingId } });
    if (!building) throw new KeysConflictError("Здание не найдено");

    const existing = await prisma.keyItem.findFirst({
        where: { buildingId: input.buildingId, roomNumber: input.roomNumber },
    });
    if (existing) throw new KeysConflictError("Ключ с таким номером в этом здании уже есть");

    const row = await prisma.keyItem.create({
        data: {
            buildingId: input.buildingId,
            roomNumber: input.roomNumber.trim(),
            roomName: input.roomName?.trim() ?? "",
            floor: input.floor ?? 1,
            accessScope: input.accessScope ?? "ALL",
        },
    });
    await writeKeyLog({ keyId: row.id, action: "key_create", details: `Создан ключ ${row.roomNumber}` });
    broadcastKeys("update", { at: new Date().toISOString() });
    return { id: row.id };
}

export async function updateKey(
    id: string,
    input: { buildingId?: string; roomNumber?: string; roomName?: string; floor?: number; accessScope?: KeyAccessScope },
): Promise<void> {
    const key = await prisma.keyItem.findUnique({ where: { id } });
    if (!key) throw new KeysConflictError("Ключ не найден");

    const targetBuildingId = input.buildingId ?? key.buildingId;
    const targetRoomNumber = input.roomNumber?.trim() || key.roomNumber;
    const movingOrRenaming = targetBuildingId !== key.buildingId || targetRoomNumber !== key.roomNumber;

    if (movingOrRenaming) {
        const conflict = await prisma.keyItem.findFirst({
            where: { buildingId: targetBuildingId, roomNumber: targetRoomNumber, NOT: { id } },
        });
        if (conflict) throw new KeysConflictError("Ключ с таким номером уже есть в этом здании");
    }

    await prisma.keyItem.update({
        where: { id },
        data: {
            buildingId: input.buildingId,
            roomNumber: input.roomNumber?.trim(),
            roomName: input.roomName?.trim(),
            floor: input.floor,
            accessScope: input.accessScope,
        },
    });
    await writeKeyLog({ keyId: id, action: "key_update", details: `Изменён ключ ${input.roomNumber ?? key.roomNumber}` });
    broadcastKeys("update", { at: new Date().toISOString() });
}

export async function deleteKey(id: string): Promise<void> {
    const key = await prisma.keyItem.findUnique({ where: { id } });
    if (!key) throw new KeysConflictError("Ключ не найден");
    if (key.holderId) throw new KeysConflictError("Ключ на руках — сначала примите сдачу");
    const pending = await prisma.keyRequestItem.findFirst({
        where: { keyId: id, request: { status: "PENDING" } },
    });
    if (pending) throw new KeysConflictError("По ключу есть активная заявка");

    await prisma.keyItem.delete({ where: { id } });
    await writeKeyLog({ keyId: null, action: "key_delete", details: `Удалён ключ ${key.roomNumber}` });
    broadcastKeys("update", { at: new Date().toISOString() });
}

function normalizeClassIds(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

export async function createBuilding(input: {
    name: string;
    address?: string;
    classIds?: unknown;
}): Promise<{ id: string }> {
    const name = input.name.trim();
    if (!name) throw new KeysConflictError("Укажите название здания");
    const existing = await prisma.keyBuilding.findUnique({ where: { name } });
    if (existing) throw new KeysConflictError("Здание с таким названием уже есть");

    const classIds = normalizeClassIds(input.classIds);
    const row = await prisma.keyBuilding.create({
        data: { name, address: input.address?.trim() ?? "" },
    });

    if (classIds.length > 0) {
        await prisma.class.updateMany({
            where: { id: { in: classIds } },
            data: { buildingId: row.id },
        });
    }

    broadcastKeys("update", { at: new Date().toISOString() });
    return { id: row.id };
}

export async function updateBuilding(
    id: string,
    input: { name?: string; address?: string; classIds?: unknown },
): Promise<void> {
    await prisma.keyBuilding.update({
        where: { id },
        data: { name: input.name?.trim(), address: input.address?.trim() },
    });

    // Классы могут учиться только в одном здании: переносим выбранные сюда,
    // а снятые с здания — отвязываем.
    if (input.classIds !== undefined) {
        const classIds = normalizeClassIds(input.classIds);
        await prisma.class.updateMany({
            where: { buildingId: id, id: { notIn: classIds } },
            data: { buildingId: null },
        });
        if (classIds.length > 0) {
            await prisma.class.updateMany({
                where: { id: { in: classIds } },
                data: { buildingId: id },
            });
        }
    }

    broadcastKeys("update", { at: new Date().toISOString() });
}

export async function deleteBuilding(id: string): Promise<void> {
    const keys = await prisma.keyItem.count({ where: { buildingId: id } });
    if (keys > 0) throw new KeysConflictError("В здании есть ключи — сначала удалите их");
    await prisma.keyBuilding.delete({ where: { id } });
    broadcastKeys("update", { at: new Date().toISOString() });
}

/** Охрана подтверждает, что ключ на месте: сдача от последнего держателя. */
export async function confirmKeyReturnedByGuard(
    access: AccessInfo,
    keyId: string,
): Promise<{ requestId: string }> {
    if (!canConfirmKeys(access)) throw new KeysConflictError("Нет прав на подтверждение сдачи");

    const key = await prisma.keyItem.findUnique({ where: { id: keyId } });
    if (!key) throw new KeysConflictError("Ключ не найден");
    if (key.status !== "ISSUED" || !key.holderId) {
        throw new KeysConflictError("Ключ уже свободен");
    }

    const pendingTransfer = await prisma.keyRequest.findFirst({
        where: { type: "TRANSFER", status: "PENDING", keys: { some: { keyId } } },
        select: { id: true },
    });
    if (pendingTransfer) {
        throw new KeysConflictError("По ключу есть активная передача — сначала завершите её");
    }

    const pendingReturn = await prisma.keyRequest.findFirst({
        where: { type: "RETURN", status: "PENDING", keys: { some: { keyId } } },
        orderBy: { createdAt: "desc" },
    });

    const holderId = key.holderId;
    const now = new Date();

    const requestId = await prisma.$transaction(async tx => {
        let id: string;

        if (pendingReturn) {
            if (pendingReturn.requestedById !== holderId) {
                throw new KeysConflictError("Заявка на сдачу создана другим сотрудником");
            }
            const claimed = await tx.keyRequest.updateMany({
                where: { id: pendingReturn.id, status: "PENDING" },
                data: { status: "CONFIRMED", decidedById: access.userId, updatedAt: now },
            });
            if (claimed.count === 0) throw new KeysConflictError("Заявка уже обработана");
            id = pendingReturn.id;
        } else {
            const created = await tx.keyRequest.create({
                data: {
                    type: "RETURN",
                    status: "CONFIRMED",
                    requestedById: holderId,
                    decidedById: access.userId,
                    createdAt: now,
                    updatedAt: now,
                    keys: { create: [{ keyId }] },
                },
            });
            id = created.id;
        }

        await tx.keyItem.update({
            where: { id: keyId },
            data: { status: "FREE", holderId: null, issuedAt: null },
        });

        return id;
    });

    await writeKeyLog({
        keyId,
        requestId,
        actorId: access.userId,
        action: "confirm_return",
        details: `Охрана подтвердила сдачу ключа ${key.roomNumber}`,
    });
    broadcastKeys("update", { at: new Date().toISOString(), requestId });

    return { requestId };
}
export async function setKeyPermissions(
    keyId: string,
    input: { accessScope: KeyAccessScope; userIds: string[] },
): Promise<void> {
    const key = await prisma.keyItem.findUnique({ where: { id: keyId } });
    if (!key) throw new KeysConflictError("Ключ не найден");

    const userIds = [...new Set(input.userIds.filter(Boolean))];
    await prisma.$transaction([
        prisma.keyItem.update({ where: { id: keyId }, data: { accessScope: input.accessScope } }),
        prisma.keyPermission.deleteMany({ where: { keyId } }),
        ...(userIds.length > 0
            ? [prisma.keyPermission.createMany({ data: userIds.map(userId => ({ keyId, userId })) })]
            : []),
    ]);
    await writeKeyLog({ keyId, action: "permissions", details: `Обновлён доступ к ключу ${key.roomNumber}` });
    broadcastKeys("update", { at: new Date().toISOString() });
}

export async function getKeyPermissions(
    keyId: string,
): Promise<{ accessScope: KeyAccessScope; userIds: string[] }> {
    const key = await prisma.keyItem.findUnique({
        where: { id: keyId },
        select: { accessScope: true, permissions: { select: { userId: true } } },
    });
    if (!key) throw new KeysConflictError("Ключ не найден");
    return { accessScope: key.accessScope, userIds: key.permissions.map(item => item.userId) };
}

/* --------------------------------- импорт --------------------------------- */

export async function importKeysCsv(text: string): Promise<{ buildings: number; keys: number; updated: number }> {
    const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length === 0) throw new KeysConflictError("Файл пуст");

    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("building") || header.includes("room");
    const rows = hasHeader ? lines.slice(1) : lines;

    let buildings = 0;
    let keys = 0;
    let updated = 0;

    for (const line of rows) {
        const cells = line.split(/[;,\t]/).map(cell => cell.trim());
        const [buildingName, address = "", roomNumber, roomName = "", floorRaw = "1"] = cells;
        if (!buildingName || !roomNumber) continue;

        let building = await prisma.keyBuilding.findUnique({ where: { name: buildingName } });
        if (!building) {
            building = await prisma.keyBuilding.create({ data: { name: buildingName, address } });
            buildings++;
        }

        const floor = Number(floorRaw) || 1;
        const existing = await prisma.keyItem.findFirst({
            where: { buildingId: building.id, roomNumber },
        });

        if (existing) {
            await prisma.keyItem.update({
                where: { id: existing.id },
                data: { roomName, floor },
            });
            updated++;
        } else {
            await prisma.keyItem.create({
                data: { buildingId: building.id, roomNumber, roomName, floor },
            });
            keys++;
        }
    }

    await writeKeyLog({
        action: "import",
        details: `Импорт ключей: зданий +${buildings}, ключей +${keys}, обновлено ${updated}`,
    });
    broadcastKeys("update", { at: new Date().toISOString() });

    return { buildings, keys, updated };
}

/* -------------------------------- избранное ------------------------------- */

export async function toggleFavorite(userId: string, keyId: string): Promise<{ favorite: boolean }> {
    const where = { userId_keyId: { userId, keyId } };
    const existing = await prisma.keyFavorite.findUnique({ where });
    if (existing) {
        await prisma.keyFavorite.delete({ where });
        return { favorite: false };
    }
    await prisma.keyFavorite.create({ data: { userId, keyId } });
    return { favorite: true };
}
