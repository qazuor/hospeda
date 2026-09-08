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
 * - **`// origin:` comment**: an entry written by the smoke sign-off (HOS-1214
 *   §6.1) carries a `// origin: #NNNN, #NNNN` comment on the line(s) above it,
 *   naming the PRs it was written for. That comment is the ONLY link from an
 *   entry back to the PRs whose novelty decision it records, and it is what
 *   `hops whats-new drop` reads to flip those PRs to `whats-new-none` when the
 *   entry is withdrawn. Removing the comment does not break anything visible —
 *   it just makes the withdrawal unable to say which PRs to correct. Keep it
 *   attached to its entry.
 * - **Editing this file by hand is fine, and nothing overwrites you.** The
 *   date-resolution workflow only ever replaces the literal string
 *   `publishedAt: 'on-promotion'`; every other byte is copied through. Two
 *   consequences worth knowing: writing a REAL date by hand takes that entry
 *   out of the marker's protection and puts it under AC-9 (a past date is
 *   silently destroyed for every new account), and changing an `id` is harmless
 *   while the entry is unpublished — the guard still catches a collision.
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
 * Ids of What's New entries that have been retired — removed from
 * {@link whatsNewEntries} under the ~6-month archival policy (HOS-1214 F-4).
 *
 * **This ledger is APPEND-ONLY.** Once an id is added here, it must never be
 * reused for a new entry. `seenIds`, stored per-user in the settings JSONB
 * column, is keyed by entry id: reusing a retired id would silently mark a
 * brand-new entry as "already seen" for anyone who had previously dismissed
 * the old one carrying that id. That failure is invisible — the affected
 * user simply never sees the new notification, and nothing in the API
 * response or logs suggests why.
 *
 * `scripts/check-whats-new-catalog.sh` fails the build (and CI, via its step
 * in `ci.yml`'s `guards` job) when a live entry's `id` also appears here.
 *
 * Starts empty. When an entry is archived: move its `id` string into this
 * set, then delete the entry object from {@link whatsNewEntries}. Never
 * remove an id that is already here.
 */
export const RETIRED_WHATS_NEW_IDS: ReadonlySet<string> = new Set<string>([]);

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
// HOS-964 follow-up (owner finding, 2026-09-07): a brand-new visit to
// `/mi-cuenta/` lazily writes `baselineAt = now` on first read
// (`getWhatsNew.ts`'s `initWhatsNewBaseline` call), and `computeSeen`
// (`whats-new.helpers.ts`) treats any entry with `publishedAt <= baselineAt`
// as already seen. The four entries below were originally dated in the past
// (Sept 3-5), which meant anyone who had NEVER visited the dashboard before
// this batch shipped would baseline past all four and permanently lose them —
// only accounts with a pre-existing baseline would ever see them. `publishedAt`
// was moved to 2026-09-07 (the actual release day) for that reason, spread
// across distinct hours to preserve the original newest-first ordering (the
// GET handler sorts by `publishedAt` descending). The `id`s were DELIBERATELY
// left unchanged — they are the seen-state key and must stay stable, and they
// still honestly record when each change was made, which is real information
// distinct from when the batch was published. Do not "fix" this mismatch by
// renaming the ids to match `publishedAt`.
export const whatsNewEntries: WhatsNewEntry[] = WhatsNewCatalogSchema.parse([
    {
        id: '2026-09-05-commerce-publish-free-trial',
        publishedAt: '2026-09-07T12:00:00Z',
        highlight: true,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Publicá tu comercio gratis con la prueba de 30 días',
            en: 'Publish your business for free with the 30-day trial',
            pt: 'Publique seu comércio de graça com o teste de 30 dias'
        },
        body: {
            es: 'El botón de publicar ahora te avisa cuando podés publicar gratis gracias a tu prueba de 30 días, sin pedirte ningún dato de pago.',
            en: 'The publish button now tells you when you can publish for free thanks to your 30-day trial, without asking for any payment details.',
            pt: 'O botão de publicar agora avisa quando você pode publicar de graça graças ao teste de 30 dias, sem pedir nenhum dado de pagamento.'
        }
    },
    {
        id: '2026-09-04-accommodation-videos',
        publishedAt: '2026-09-07T09:00:00Z',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Sumá un video a tu alojamiento',
            en: 'Add a video to your listing',
            pt: 'Adicione um vídeo à sua acomodação'
        },
        body: {
            es: 'Ya podés agregar un video a la ficha de tu alojamiento para mostrarlo en movimiento. Aparece en su propia sección, justo después de la descripción.',
            en: 'You can now add a video to your listing page to show it in motion. It appears in its own section, right after the description.',
            pt: 'Agora você pode adicionar um vídeo à ficha da sua acomodação para mostrá-la em movimento. Ele aparece em uma seção própria, logo após a descrição.'
        }
    },
    {
        id: '2026-09-03-ai-chat-gastronomy-experience',
        publishedAt: '2026-09-07T06:00:00Z',
        highlight: true,
        roles: ['USER'],
        title: {
            es: 'Chat con IA en restaurantes y experiencias',
            en: 'AI chat on restaurants and experiences',
            pt: 'Chat com IA em restaurantes e experiências'
        },
        body: {
            es: 'Ahora podés chatear con un asistente de IA directamente desde la página de un restaurante o una experiencia para resolver tus dudas al instante.',
            en: 'You can now chat with an AI assistant right from a restaurant or experience page to get your questions answered instantly.',
            pt: 'Agora você pode conversar com um assistente de IA diretamente na página de um restaurante ou experiência para tirar suas dúvidas na hora.'
        }
    },
    {
        id: '2026-09-03-gastronomy-daily-menu',
        publishedAt: '2026-09-07T03:00:00Z',
        highlight: false,
        roles: ['GASTRONOMY_OWNER'],
        title: {
            es: 'Publicá el menú del día en tu página',
            en: "Publish today's specials on your page",
            pt: 'Publique o cardápio do dia na sua página'
        },
        body: {
            es: 'Ahora podés cargar el menú del día desde tu panel y se muestra automáticamente en tu página mientras esté vigente.',
            en: "You can now add today's specials from your dashboard, and they'll show automatically on your page while they're valid.",
            pt: 'Agora você pode cadastrar o cardápio do dia no seu painel, e ele aparece automaticamente na sua página enquanto estiver válido.'
        }
    }
] satisfies z.input<typeof WhatsNewCatalogSchema>);
