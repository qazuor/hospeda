/**
 * Internationalization configuration for Hospeda — full catalog entry point.
 *
 * Composes the shared (web) namespaces from `config.shared.ts` and the admin
 * namespaces from `config.admin.ts` into a single unified `trans` object and
 * `namespaces` array. The public API of this module is unchanged so that all
 * existing consumers of `@repo/i18n` (admin app, API, service packages) keep
 * working without modification.
 *
 * Web-only consumers should import from `@repo/i18n/web` instead, which
 * references `config.shared.ts` directly and never pulls admin JSON files into
 * the module graph.
 */

// Re-export shared constants and types so that existing code importing them
// from 'config' continues to work without changes.
export {
    defaultLocale,
    defaultIntlLocale,
    locales,
    flattenObject,
    webTrans,
    type Locale,
    type WebNamespace
} from './config.shared';

import { adminNamespaces, adminTrans } from './config.admin';
import { type Locale, webNamespaces, webTrans } from './config.shared';

/**
 * All translation namespaces — web/shared + admin.
 * Preserves the original order: shared first, then admin.
 */
export const namespaces = [...webNamespaces, ...adminNamespaces] as const;

export type Namespace = (typeof namespaces)[number];

/**
 * Full flattened translations object (web + admin namespaces).
 * Structure: `{ [locale]: { "namespace.key": "value" } }`
 */
export const trans: Record<Locale, Record<string, string>> = {
    es: { ...webTrans.es, ...adminTrans.es },
    en: { ...webTrans.en, ...adminTrans.en },
    pt: { ...webTrans.pt, ...adminTrans.pt }
};
