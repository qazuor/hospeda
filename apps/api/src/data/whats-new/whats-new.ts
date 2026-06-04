/**
 * @module data/whats-new
 *
 * Curated What's New / Release Notes entries for the admin panel.
 *
 * ## Authoring conventions
 *
 * - **Order**: entries are sorted **newest-first** by `publishedAt`. Always insert
 *   new entries at the top of the array.
 * - **Archival policy**: remove entries whose `publishedAt` is older than
 *   approximately 6 months. Orphaned `seenIds` stored in user settings are
 *   harmless — the GET endpoint never returns entries that are no longer in this
 *   array, and leftover ids in `seenIds` are silently ignored.
 * - **Images**: do NOT publish an entry with an `image` field until the CDN origin
 *   is added to the admin Content Security Policy `img-src` directive AND the
 *   origin has been added to {@link APPROVED_IMAGE_ORIGINS}.
 *   See SPEC-175 §9 (TBD-2) and T-016/T-018 for the ops task.
 * - **ids**: ids are stable — never reuse a retired id. User settings may still
 *   reference it; a collision would silently mark a new entry as already seen.
 * - **Validation**: `WhatsNewCatalogSchema.parse(...)` runs at module import time.
 *   A malformed entry (e.g. missing required `es` title) will throw immediately
 *   and prevent the API process from serving traffic (AC-16, intended).
 *
 * ## Adding an image-bearing entry (checklist)
 *
 * 1. Decide on the CDN origin (e.g. `https://assets.hospeda.com.ar`).
 * 2. Add the origin string to {@link APPROVED_IMAGE_ORIGINS} below.
 * 3. Update the admin CSP `img-src` directive in the security middleware or
 *    reverse-proxy config (see SPEC-175 §9).
 * 4. Add the entry with the `image` field populated.
 * 5. The CI test `apps/api/src/data/whats-new/__tests__/image-origin.test.ts`
 *    will fail if the image URL's origin is NOT in {@link APPROVED_IMAGE_ORIGINS}.
 *
 * **Never publish an entry with an `image` whose origin is not in this allowlist.**
 *
 * @see SPEC-175 §6.3, §9
 */
import type { WhatsNewEntry } from '@repo/schemas';
import { WhatsNewEntrySchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Approved CDN / image origins for What's New entry images (SPEC-175 §9 / T-018).
 *
 * **TBD-2**: The exact CDN origin is not yet decided. This set is intentionally
 * empty until an origin is chosen and the admin CSP `img-src` directive has been
 * updated to allow it.
 *
 * ## How to add an origin
 *
 * 1. Decide on the CDN host (e.g. `'https://assets.hospeda.com.ar'`).
 * 2. Add it to this set.
 * 3. Update the CSP `img-src` directive (security middleware / Coolify header).
 * 4. The CI test `image-origin.test.ts` will now pass for URLs from that origin.
 *
 * Keep this list minimal — add only origins you control and trust.
 */
export const APPROVED_IMAGE_ORIGINS: ReadonlySet<string> = new Set<string>([
    // Example (uncomment and adjust when the CDN is decided):
    // 'https://assets.hospeda.com.ar'
]);

/**
 * Array schema for the curated catalog. Minimum 0 entries (empty is valid).
 * Parsed at module import time — a validation failure aborts API startup.
 */
const WhatsNewCatalogSchema = z.array(WhatsNewEntrySchema).min(0);

/**
 * Curated What's New entries. Validated at API boot via `WhatsNewCatalogSchema.parse`.
 *
 * ## Adding an entry
 *
 * ```ts
 * // Example entry (uncomment and customize):
 * // {
 * //   id: '2026-05-29-cron-history',
 * //   publishedAt: '2026-05-29T00:00:00Z',
 * //   highlight: true,
 * //   title: {
 * //     es: 'Historial de trabajos programados',
 * //     en: 'Cron job history',
 * //     pt: 'Histórico de tarefas'
 * //   },
 * //   body: {
 * //     es: 'Ahora podés ver el historial de ejecuciones de cada cron desde el panel de administración.',
 * //     en: 'You can now view the execution history of each scheduled job from the admin panel.',
 * //     pt: 'Agora você pode ver o histórico de execuções de cada tarefa agendada.'
 * //   },
 * //   roles: ['ADMIN', 'SUPER_ADMIN']
 * // }
 * ```
 */
export const whatsNewEntries: WhatsNewEntry[] = WhatsNewCatalogSchema.parse(
    [] satisfies z.input<typeof WhatsNewCatalogSchema>
);
