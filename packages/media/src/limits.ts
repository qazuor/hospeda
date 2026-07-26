/**
 * Canonical upload size limits, shared by every client and by the server.
 *
 * These values are the SINGLE source of truth for "how big may an uploaded
 * image be". Before HOS-322 the number was copied into eleven places (three
 * web components, three admin constants/configs, the API upload helpers, the
 * avatar route, the shared validator's defaults and two entity editors), with
 * three different values — the effective cap was whichever copy happened to be
 * the smallest, and not one of them was checked against what the image provider
 * actually accepts.
 *
 * The API may lower either cap at runtime through
 * `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` / `HOSPEDA_AVATAR_MAX_FILE_SIZE_MB`; both
 * default to the constants below and are bounded above by
 * {@link PROVIDER_MAX_IMAGE_FILE_SIZE_MB}. Clients import the constants
 * directly: a `PUBLIC_`/`VITE_` mirror
 * would be baked in at build time anyway, so it would buy no runtime
 * adjustability while adding a copy that can silently drift from the server.
 * The client check is a courtesy that fails fast; the server is the enforcer,
 * and its error message reports the cap it actually applied.
 *
 * @module limits
 */

/**
 * Hard ceiling, in MB, that the image provider itself accepts for one asset.
 *
 * Cloudinary rejects a larger upload outright (`File size too large. Got N.
 * Maximum is 10485760.`) on the plan this project runs on. Verified against the
 * live account, not taken from documentation.
 *
 * Nothing may be configured above this: a file that clears every check of ours
 * and then dies at the provider costs the user the entire upload time and
 * surfaces as a generic `UPSTREAM_ERROR`, which is a worse experience than an
 * immediate, honest rejection. Raising it requires a provider plan change.
 */
export const PROVIDER_MAX_IMAGE_FILE_SIZE_MB = 10;

/**
 * Maximum size, in MB, of a single entity photo (accommodation, destination,
 * event, post, gastronomy, experience).
 *
 * Set to the provider ceiling: double the previous effective cap of 5 MB, which
 * rejected ordinary mid-range phone photos. A 12 MP JPEG typically lands
 * between 3 and 8 MB, so this covers the reported case; genuinely heavier
 * originals need downscaling before upload rather than a bigger cap.
 */
export const DEFAULT_ENTITY_MAX_FILE_SIZE_MB = PROVIDER_MAX_IMAGE_FILE_SIZE_MB;

/**
 * Maximum size, in MB, of a user avatar.
 *
 * Deliberately lower than the entity cap: an avatar is cropped to a thumbnail,
 * so accepting a full-size original would spend bandwidth and storage on pixels
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
