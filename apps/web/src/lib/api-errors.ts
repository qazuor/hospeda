/**
 * @file api-errors.ts
 * @description Re-export shim — the implementation has moved to `@repo/i18n`.
 *
 * All existing import paths (`@/lib/api-errors`) continue to resolve correctly
 * with zero behavioral change. See `packages/i18n/src/api-errors.ts` for the
 * canonical source.
 *
 * @see packages/i18n/src/api-errors.ts
 */

export { translateApiError } from '@repo/i18n/web';
export type { ApiErrorShape, TranslationFn } from '@repo/i18n/web';
