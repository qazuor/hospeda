import type { TranslationKey } from '@repo/i18n';
import { isApiError } from '@/lib/errors/api-error';

const ERROR_KEYS: Readonly<Record<string, TranslationKey>> = {
    NOT_FOUND: 'admin-billing.addonCatalogEditor.errors.NOT_FOUND',
    CONFLICT: 'admin-billing.addonCatalogEditor.errors.CONFLICT',
    ALREADY_EXISTS: 'admin-billing.addonCatalogEditor.errors.ALREADY_EXISTS',
    VALIDATION_ERROR: 'admin-billing.addonCatalogEditor.errors.VALIDATION_ERROR'
};

/** Returns localized copy for known catalog errors and the caller's generic fallback otherwise. */
export function addonCatalogErrorMessage({
    error,
    t,
    fallback
}: {
    error: unknown;
    t: (key: TranslationKey) => string;
    fallback: string;
}): string {
    if (!isApiError(error)) return fallback;
    const key = ERROR_KEYS[error.code];
    return key ? t(key) : fallback;
}
