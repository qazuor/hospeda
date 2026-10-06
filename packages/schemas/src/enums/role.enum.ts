// Built-in roles for the Hospeda platform.
// Each role defines a set of permissions and access level in the system.
//
// SUPER_ADMIN: Has every possible permission, including system-level actions.
// ADMIN: Can manage almost everything except editing accommodation info directly.
// CLIENT_MANAGER: Manages client accounts, billing, subscriptions, and analytics.
// EDITOR: Can create/edit/publish events and posts only.
// HOST: Owner of an accommodation, can only edit their own accommodations.
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
