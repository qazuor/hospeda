// Direction of a role mutation recorded in the `user_role_audit` trail (HOS-296).
//
// GRANT:  a hat was added to the user's role set (`user_role` row created).
// REVOKE: a hat was removed from the user's role set (`user_role` row deleted).
//
// Canonical source of truth for both the Zod `RoleGrantActionSchema`
// (@repo/schemas) and the `role_grant_action_enum` Postgres enum (@repo/db),
// mirroring how `PermissionEffectEnum` backs `permission_effect_enum`.

export enum RoleGrantActionEnum {
    GRANT = 'grant',
    REVOKE = 'revoke'
}
