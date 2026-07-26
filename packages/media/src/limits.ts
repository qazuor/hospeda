/**
 * Canonical upload size limits, shared by every client and by the server.
 *
 * These values are the SINGLE source of truth for "how big may an uploaded
 * image be". Before HOS-322 the number was copied into eleven places (three
 * web components, three admin constants/configs, the API upload helpers, the
 * avatar route, the shared validator's defaults and two entity editors), with
 * three different values — the effective cap was whichever copy happened to be
 * the smallest.
 *
 * The API may raise or lower the entity cap at runtime through
 * `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` (and the avatar cap through
 * `HOSPEDA_AVATAR_MAX_FILE_SIZE_MB`); both env vars default to the constants
 * below. Clients import the constants directly: a `PUBLIC_`/`VITE_` mirror
 * would be baked in at build time anyway, so it would buy no runtime
 * adjustability while adding a copy that can silently drift from the server.
 * The client check is a courtesy that fails fast; the server is the enforcer,
 * and its error message reports the cap it actually applied.
 *
 * @module limits
 */

/**
 * Maximum size, in MB, of a single entity photo (accommodation, destination,
 * event, post, gastronomy, experience).
 *
 * 15 MB covers a high-quality JPEG from any current phone camera (12-50 MP).
 * The previous effective cap of 5 MB rejected ordinary mid-range phone photos.
 */
export const DEFAULT_ENTITY_MAX_FILE_SIZE_MB = 15;

/**
 * Maximum size, in MB, of a user avatar.
 *
 * Deliberately lower than the entity cap: an avatar is cropped to a thumbnail,
 * so accepting a 15 MB original would spend bandwidth and storage on pixels
 * that are discarded.
 */
export const DEFAULT_AVATAR_MAX_FILE_SIZE_MB = 5;

/**
 * Convert a size in MB to bytes.
 *
 * @param mb - Size in megabytes
 * @returns The equivalent number of bytes
 */
export const mbToBytes = (mb: number): number => mb * 1024 * 1024;
