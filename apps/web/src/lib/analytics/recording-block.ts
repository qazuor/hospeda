/**
 * Element-level block marker for the Umami session recorder (HOS-2347 §6.6).
 *
 * Defined ONCE. The components that must never appear in a replay carry
 * {@link UMAMI_BLOCK_ATTRIBUTE} (with an empty value) on their outermost
 * rendered element, and `pnpm umami:setup` declares
 * {@link UMAMI_BLOCK_SELECTOR} as the website's `replay_config.blockSelector`
 * (`scripts/umami/recorder-definitions.ts` imports it from here). The value is
 * the same for every visitor, so marked pages stay session-blind.
 *
 * This module has no imports on purpose: the setup script loads it with plain
 * `tsx`, outside the Astro build.
 */

/** Attribute that tells the recorder to replace an element with a placeholder. */
export const UMAMI_BLOCK_ATTRIBUTE = 'data-umami-block' as const;

/** CSS selector derived from {@link UMAMI_BLOCK_ATTRIBUTE}. */
export const UMAMI_BLOCK_SELECTOR = `[${UMAMI_BLOCK_ATTRIBUTE}]` as const;

/**
 * Spreadable props that mark an element as blocked, e.g.
 * `<div {...UMAMI_BLOCK_PROPS}>` in React or `{...UMAMI_BLOCK_PROPS}` in Astro.
 */
export const UMAMI_BLOCK_PROPS: Readonly<Record<typeof UMAMI_BLOCK_ATTRIBUTE, ''>> = {
    [UMAMI_BLOCK_ATTRIBUTE]: ''
};
