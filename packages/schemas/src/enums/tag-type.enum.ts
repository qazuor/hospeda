/**
 * Discriminates user-tags into three operational tiers.
 *
 * - `INTERNAL`: Admin/super-admin only. Never visible to regular users.
 *   Operational labels such as "Spam", "Fraud", "Urgente".
 * - `SYSTEM`: Created by admins, usable by any authenticated user.
 *   Shared organizational tags the whole platform benefits from.
 * - `USER`: Created by the owner and visible only to that owner.
 *   Private personal organization ("Check later", "VIP client").
 *
 * There is no `scope` dimension. This single enum is the only type axis
 * for the user-tag subsystem (D-002 from SPEC-086).
 */
export enum TagTypeEnum {
    INTERNAL = 'INTERNAL',
    SYSTEM = 'SYSTEM',
    USER = 'USER'
}
