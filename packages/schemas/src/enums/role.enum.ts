// Built-in roles for the Hospeda platform.
// Each role defines a set of permissions and access level in the system.
//
// SUPER_ADMIN: Has every possible permission, including system-level actions.
// ADMIN: Can manage almost everything except editing accommodation info directly.
// CLIENT_MANAGER: Manages client accounts, billing, subscriptions, and analytics.
// EDITOR: Can create/edit/publish events and posts only.
// HOST: Owner of an accommodation, can only edit their own accommodations.
// COMMERCE_OWNER: Owner of a commerce listing (gastronomy, experience, etc.).
//                 Can edit their own commerce entities; distinct from HOST.
//                 RETIRING (HOS-1077) — see GASTRONOMY_OWNER / EXPERIENCE_OWNER.
// GASTRONOMY_OWNER: Owner of a gastronomy listing. Per-vertical, like HOST.
// EXPERIENCE_OWNER: Owner of an experience listing. Per-vertical, like HOST.
// SPONSOR: External business or user that sponsors events/posts. Limited dashboard access.
// USER: Logged-in user of the public portal, can favorite and review, etc.
// GUEST: Public user, used for the website (not logged in).
// SYSTEM: Reserved non-loginable account used as assignedById for automated tag assignments
//         (seeds, cron jobs, webhooks). Has no granted permissions and cannot authenticate.

export enum RoleEnum {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    CLIENT_MANAGER = 'CLIENT_MANAGER',
    EDITOR = 'EDITOR',
    HOST = 'HOST',
    /**
     * Owner of a commerce listing (gastronomy, experience, etc.). Added in SPEC-239.
     *
     * RETIRING (HOS-1077 release 2). One role for two verticals is the role-side
     * half of the same defect as the `commerce.*` permission family: it cannot
     * express "owns a restaurant but not an excursion". Replaced by
     * {@link RoleEnum.GASTRONOMY_OWNER} and {@link RoleEnum.EXPERIENCE_OWNER},
     * which are per-vertical exactly as {@link RoleEnum.HOST} is.
     *
     * It survives the expand release because live `user_role` rows still carry
     * it and every gate still reads it. Do NOT grant it to new accounts once
     * release 2 lands.
     */
    COMMERCE_OWNER = 'COMMERCE_OWNER',
    /**
     * Owner of one or more gastronomy listings (HOS-1077).
     *
     * Per-vertical by design, in parity with {@link RoleEnum.HOST}. Since
     * HOS-296 dropped `users.role` and roles live in the `user_role` many-to-many
     * table, an account that owns a restaurant AND an excursion simply holds two
     * rows — there is no conflict to resolve between the two.
     */
    GASTRONOMY_OWNER = 'GASTRONOMY_OWNER',
    /**
     * Owner of one or more experience listings (HOS-1077).
     *
     * The experience twin of {@link RoleEnum.GASTRONOMY_OWNER}; see there for
     * why the two are separate roles rather than one role with per-vertical
     * permissions.
     */
    EXPERIENCE_OWNER = 'EXPERIENCE_OWNER',
    SPONSOR = 'SPONSOR',
    USER = 'USER',
    GUEST = 'GUEST',
    SYSTEM = 'SYSTEM'
}
