/**
 * Canonical entity names, in the one module that imports nothing (HOS-600).
 *
 * These strings are what `${entityName} not found` is built from, so a service
 * and its permissions module MUST agree on them exactly: the anti-enumeration
 * contract says the 404 for "row hidden from you" and the 404 for "no such row"
 * are the same answer, and the two are composed on opposite sides of that
 * boundary.
 *
 * Why a leaf module rather than reading the constant off the service class: a
 * permissions module cannot import its own service (that is a cycle), and
 * declaring the constant in the permissions module and importing it back into
 * the service produced a REAL cycle through the package barrel — the class
 * static initialised to `undefined` and every message became
 * `'undefined not found'`. A module with no imports of its own is always
 * evaluated before anything that imports it, so this cannot happen here.
 *
 * Add an entry only when both a service and its permissions module need the
 * same name; a service whose name is used in exactly one file keeps its literal.
 */

/** `UserService.ENTITY_NAME`. */
export const USER_ENTITY_NAME = 'user';

/** `AccommodationService.ENTITY_NAME`. */
export const ACCOMMODATION_ENTITY_NAME = 'accommodation';

/** `UserBookmarkService.ENTITY_NAME`. */
export const USER_BOOKMARK_ENTITY_NAME = 'userBookmark';

/** `UserBookmarkCollectionService.ENTITY_NAME`. */
export const USER_BOOKMARK_COLLECTION_ENTITY_NAME = 'userBookmarkCollection';

/** `AlertSubscriptionService.ENTITY_NAME`. */
export const PRICE_ALERT_ENTITY_NAME = 'priceAlert';
