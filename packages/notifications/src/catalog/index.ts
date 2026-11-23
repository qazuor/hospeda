/**
 * The central email template catalog (HOS-2519 §6.2). See `catalog.ts`.
 *
 * @module catalog
 */

export { EMAIL_CATALOG, findEmailCatalogEntry } from './catalog.js';
export {
    type DefineEmailCatalogEntryInput,
    type DefineNotificationEntryInput,
    type DefineOutboxEntryInput,
    defineEmailCatalogEntry,
    defineNotificationEntry,
    defineOutboxEntry,
    EmailCatalogScenarioNotFoundError,
    type EmailScenarioList,
    type OutboxScenarioInput,
    readInputLocale
} from './define-entry.js';
export {
    buildEmailPixelManifest,
    EMAIL_PIXEL_MANIFEST_COMMAND,
    EMAIL_PIXEL_MANIFEST_PATH,
    type EmailPixelManifestEntry
} from './pixel-manifest.js';
export { type BuildPreviewOutboxRowInput, buildPreviewOutboxRow } from './preview-outbox-row.js';
export {
    EmailCatalogEntryNotFoundError,
    type RenderEmailCatalogScenarioInput,
    type RenderedEmailCatalogScenario,
    renderEmailCatalogScenario
} from './render-scenario.js';
export * from './types.js';
