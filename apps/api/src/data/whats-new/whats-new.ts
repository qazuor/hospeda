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
 * - **Images**: do NOT publish an entry with an `image` field unless its origin
 *   is in {@link APPROVED_IMAGE_ORIGINS} (which, as of HOS-964, already includes
 *   `https://res.cloudinary.com` — Hospeda's one media CDN, already allowed by
 *   both apps' CSP `img-src`). A different origin still needs the checklist below.
 *   See SPEC-175 §9 (TBD-2, resolved) and T-016/T-018 for the original ops task.
 * - **ids**: ids are stable — never reuse a retired id. User settings may still
 *   reference it; a collision would silently mark a new entry as already seen.
 * - **Validation**: `WhatsNewCatalogSchema.parse(...)` runs at module import time.
 *   A malformed entry (e.g. missing required `es` title) will throw immediately
 *   and prevent the API process from serving traffic (AC-16, intended).
 *
 * ## Adding an image-bearing entry with a NEW (non-Cloudinary) CDN origin
 *
 * 1. Decide on the CDN origin (e.g. `https://assets.hospeda.com.ar`).
 * 2. Add the origin string to {@link APPROVED_IMAGE_ORIGINS} below.
 * 3. Update the CSP `img-src` directive in the security middleware or
 *    reverse-proxy config for whichever app(s) render the entry (see SPEC-175 §9).
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
 * **TBD-2 resolved (HOS-964)**: `https://res.cloudinary.com` is Hospeda's one
 * media CDN — every accommodation/commerce photo and every uploaded avatar
 * already goes through it (`@repo/media`'s `getMediaUrl`,
 * `apps/web/src/lib/media.ts`'s `ALLOWED_REMOTE_HOSTS`). It is ALREADY in both
 * apps' CSP `img-src` directive:
 * - `apps/admin/src/lib/csp-helpers.ts` — `https://res.cloudinary.com`
 * - `apps/web/src/lib/middleware-helpers.ts` — via `ALLOWED_REMOTE_HOSTS`
 *
 * So step 3 of the "adding an image-bearing entry" checklist above is already
 * satisfied for this origin — no CSP change needed to publish a Cloudinary
 * image in a What's New entry.
 *
 * ## How to add a DIFFERENT origin
 *
 * 1. Decide on the CDN host (e.g. `'https://assets.hospeda.com.ar'`).
 * 2. Add it to this set.
 * 3. Update the CSP `img-src` directive (security middleware / Coolify header)
 *    for whichever app(s) will render the entry.
 * 4. The CI test `image-origin.test.ts` will now pass for URLs from that origin.
 *
 * Keep this list minimal — add only origins you control and trust.
 */
export const APPROVED_IMAGE_ORIGINS: ReadonlySet<string> = new Set<string>([
    'https://res.cloudinary.com'
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
