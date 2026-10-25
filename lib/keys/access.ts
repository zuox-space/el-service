// lib/keys/access.ts
import type { AccessInfo } from "@/lib/access/server";

/** Может открыть пульт ключей и создавать заявки. */
export function canUseKeys(access: AccessInfo): boolean {
    return access.sections.includes("keys");
}

/** Может управлять ключами и подтверждать заявки (админка ключей). */
export function canAdminKeys(access: AccessInfo): boolean {
    return access.sections.includes("keysAdmin");
}

/**
 * Кто обрабатывает заявки: доступ к админке ключей или охрана.
 * Охрана не создаёт заявки — только подтверждает выдачу/сдачу.
 */
export function canConfirmKeys(access: AccessInfo): boolean {
    return canAdminKeys(access) || access.roles.includes("SECURITY");
}

/** Охрана без админки ключей — только пульт подтверждения. */
export function isKeysOperatorOnly(access: AccessInfo): boolean {
    return access.roles.includes("SECURITY") && !canAdminKeys(access);
}
