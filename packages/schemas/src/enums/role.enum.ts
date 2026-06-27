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
    /** Owner of a commerce listing (gastronomy, experience, etc.). Added in SPEC-239. */
    COMMERCE_OWNER = 'COMMERCE_OWNER',
    SPONSOR = 'SPONSOR',
    USER = 'USER',
    GUEST = 'GUEST',
    SYSTEM = 'SYSTEM'
}
