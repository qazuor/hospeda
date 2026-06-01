// Direction of a per-user permission override (SPEC-170).
//
// GRANT: adds the permission to the user on top of what their role grants.
// DENY:  subtracts a role-granted permission from a single user. Deny wins
//        over grant at auth-time resolution (see apps/api actor.ts).
//
// Canonical source of truth for both the Zod `PermissionEffectSchema`
// (@repo/schemas) and the `permission_effect_enum` Postgres enum (@repo/db).

export enum PermissionEffectEnum {
    GRANT = 'grant',
    DENY = 'deny'
}
