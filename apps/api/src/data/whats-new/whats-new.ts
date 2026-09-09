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
        id: '2026-09-08-events-public-routes-envelope',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: 'Los listados de eventos responden siempre igual',
            en: 'Event listings always answer the same way',
            pt: 'As listas de eventos respondem sempre do mesmo jeito'
        },
        body: {
            es: 'Buscar eventos por autor, por lugar o por organizador devuelve ahora la misma estructura paginada, así que la lista no se corta ni se queda a medias al cambiar de filtro.',
            en: 'Searching events by author, venue or organiser now returns the same paginated structure, so the list no longer breaks or comes back half-empty when you switch filters.',
            pt: 'Buscar eventos por autor, local ou organizador agora devolve a mesma estrutura paginada, então a lista não quebra nem volta pela metade ao trocar de filtro.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-mobile-menu-single-controls',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'El menú del celular ya no repite los mismos botones',
            en: 'The mobile menu no longer repeats the same buttons',
            pt: 'O menu do celular não repete mais os mesmos botões'
        },
        body: {
            es: 'Los controles de idioma y preferencias aparecían dos veces al abrir el menú en pantallas chicas. Ahora hay uno solo de cada uno.',
            en: 'The language and preference controls used to appear twice when opening the menu on small screens. Now there is only one of each.',
            pt: 'Os controles de idioma e preferências apareciam duas vezes ao abrir o menu em telas pequenas. Agora há apenas um de cada.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-dialog-back-button',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'El botón «atrás» del celular cierra el diálogo, no la página',
            en: 'The phone back button closes the dialog, not the page',
            pt: 'O botão «voltar» do celular fecha o diálogo, não a página'
        },
        body: {
            es: 'Si tenés abierto un diálogo y apretás «atrás», ahora se cierra el diálogo y te quedás donde estabas, en vez de salir de la ficha entera.',
            en: 'If a dialog is open and you press back, the dialog now closes and you stay where you were, instead of leaving the whole page.',
            pt: 'Se um diálogo está aberto e você aperta «voltar», agora o diálogo fecha e você permanece onde estava, em vez de sair da ficha inteira.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-public-user-listings-are-actor-blind',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Tus borradores no se ven desde tu perfil público',
            en: 'Your drafts are not visible from your public profile',
            pt: 'Seus rascunhos não aparecem no seu perfil público'
        },
        body: {
            es: 'La lista pública de alojamientos de un anfitrión muestra únicamente los publicados. Un alojamiento en borrador o privado ya no aparece ahí para nadie, ni siquiera para vos mismo estando conectado.',
            en: "A host's public listing page now shows only published places. A draft or private listing no longer appears there for anyone, not even for you while signed in.",
            pt: 'A lista pública de acomodações de um anfitrião mostra apenas as publicadas. Uma acomodação em rascunho ou privada não aparece mais ali para ninguém, nem para você mesmo conectado.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-single-brand-phone-number',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Un solo teléfono de contacto en todo el sitio',
            en: 'One single contact phone across the site',
            pt: 'Um único telefone de contato em todo o site'
        },
        body: {
            es: 'El teléfono de Hospeda aparecía con formatos distintos según la página. Ahora es el mismo número en todas: en el botón de WhatsApp, en el enlace para llamar y en el texto visible.',
            en: "Hospeda's phone number used to appear in different formats depending on the page. Now it is the same number everywhere: on the WhatsApp button, on the call link and in the visible text.",
            pt: 'O telefone da Hospeda aparecia em formatos diferentes conforme a página. Agora é o mesmo número em todas: no botão de WhatsApp, no link para ligar e no texto visível.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-host-trade-benefit-usage-and-reviews',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['HOST'],
        title: {
            es: 'Registrá el uso del beneficio y valorá a los proveedores',
            en: 'Record benefit usage and rate your providers',
            pt: 'Registre o uso do benefício e avalie os fornecedores'
        },
        body: {
            es: 'El proveedor registra que te atendió y a vos te llega un pedido de confirmación de un solo clic. Una vez confirmado, podés dejarle una valoración pública, y él puede responderte. Sólo cuentan los usos confirmados.',
            en: 'The provider records that they served you and you get a one-click confirmation request. Once confirmed, you can leave a public review, and they can reply to it. Only confirmed usages count.',
            pt: 'O fornecedor registra que atendeu você e você recebe um pedido de confirmação de um clique. Uma vez confirmado, você pode deixar uma avaliação pública, e ele pode responder. Só valem os usos confirmados.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-seed-migration-column-guard',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['ADMIN', 'SUPER_ADMIN'],
        title: {
            es: 'Una migración de datos ya no puede correr sin su columna',
            en: 'A data migration can no longer run without its column',
            pt: 'Uma migração de dados não pode mais rodar sem sua coluna'
        },
        body: {
            es: 'Si una migración de datos necesita una columna que ya se borró, el proceso se detiene y avisa, en vez de mover cero filas y quedar registrada como aplicada para siempre.',
            en: 'If a data migration needs a column that was already dropped, the run now stops and says so, instead of moving zero rows and being recorded as applied forever.',
            pt: 'Se uma migração de dados precisa de uma coluna que já foi removida, o processo para e avisa, em vez de mover zero linhas e ficar registrada como aplicada para sempre.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-uploaded-photos-optimised-cards',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Las fotos que subís se muestran optimizadas en las tarjetas',
            en: 'The photos you upload are shown optimised on cards',
            pt: 'As fotos que você envia aparecem otimizadas nos cartões'
        },
        body: {
            es: 'Al subir una foto a tu ficha, la miniatura del listado se sirve ya redimensionada, así que la página carga más liviana sin que la imagen se vea peor.',
            en: 'When you upload a photo to your listing, the thumbnail in the results list is served already resized, so the page loads lighter without the image looking worse.',
            pt: 'Ao enviar uma foto para sua ficha, a miniatura da lista já vem redimensionada, então a página carrega mais leve sem a imagem ficar pior.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-provider-signup-benefit-value',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'El alta de proveedor sólo pide el valor cuando hace falta',
            en: 'Provider signup only asks for a value when it applies',
            pt: 'O cadastro de fornecedor só pede o valor quando faz sentido'
        },
        body: {
            es: 'Si tu beneficio es un porcentaje o un monto fijo, el formulario te pide el valor. Si es un 2x1 o una condición especial, ese campo directamente no aparece.',
            en: 'If your benefit is a percentage or a fixed amount, the form asks for the value. If it is a two-for-one or a special condition, that field simply does not appear.',
            pt: 'Se o seu benefício é uma porcentagem ou um valor fixo, o formulário pede o valor. Se é um 2x1 ou uma condição especial, esse campo simplesmente não aparece.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-ai-chat-answers-from-listing-faqs',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['USER'],
        title: {
            es: 'El asistente responde con los datos reales de la ficha',
            en: 'The assistant answers with the listing’s real data',
            pt: 'O assistente responde com os dados reais da ficha'
        },
        body: {
            es: 'Si preguntás por el horario de ingreso o si aceptan mascotas, la respuesta sale de las preguntas frecuentes que cargó el anfitrión, no de un texto genérico.',
            en: 'If you ask about check-in times or whether pets are allowed, the answer comes from the FAQs the host filled in, not from generic copy.',
            pt: 'Se você pergunta pelo horário de entrada ou se aceitam animais, a resposta sai das perguntas frequentes que o anfitrião preencheu, não de um texto genérico.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-plans-endpoint-domain-filter',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER', 'HOST'],
        title: {
            es: 'Cada rubro ve solamente sus propios planes',
            en: 'Each vertical sees only its own plans',
            pt: 'Cada segmento vê apenas seus próprios planos'
        },
        body: {
            es: 'Los planes de alojamiento, gastronomía, experiencias y aliados quedaron separados: pedir los de un rubro ya no devuelve los de otro.',
            en: 'Accommodation, dining, experience and partner plans are now separate: asking for one vertical no longer returns another’s.',
            pt: 'Os planos de acomodação, gastronomia, experiências e parceiros ficaram separados: pedir os de um segmento não devolve mais os de outro.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-slug-stays-put-after-publishing',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'El enlace de tu ficha no cambia solo al renombrarla',
            en: 'Your listing’s link no longer changes on its own when renamed',
            pt: 'O link da sua ficha não muda sozinho ao renomeá-la'
        },
        body: {
            es: 'Mientras la ficha está en borrador, el enlace sigue al nombre. Una vez publicada, cambiar el nombre ya no cambia el enlace salvo que lo pidas: te avisamos que Google y lo que hayas compartido apuntan al anterior.',
            en: 'While the listing is a draft, the link follows the name. Once published, renaming no longer changes the link unless you ask for it: we warn you that Google and anything you shared point to the old one.',
            pt: 'Enquanto a ficha está em rascunho, o link acompanha o nome. Depois de publicada, renomear não muda mais o link a não ser que você peça: avisamos que o Google e o que você compartilhou apontam para o anterior.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-bulk-photo-upload',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Subí muchas fotos de una sola vez',
            en: 'Upload many photos at once',
            pt: 'Envie várias fotos de uma vez só'
        },
        body: {
            es: 'Podés cargar una tanda entera de fotos sin que el sistema te corte a mitad de camino. Y si alguna vez llegás al límite, el aviso te lo dice en tu idioma.',
            en: 'You can upload a whole batch of photos without the system cutting you off halfway. And if you ever hit the limit, the notice tells you in your own language.',
            pt: 'Você pode enviar um lote inteiro de fotos sem o sistema cortar no meio. E se em algum momento atingir o limite, o aviso aparece no seu idioma.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-destination-copy-voseo',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Los textos de destinos hablan como hablamos acá',
            en: 'Destination copy now speaks the local way',
            pt: 'Os textos de destinos falam como falamos aqui'
        },
        body: {
            es: 'Las páginas de destinos pasaron a voseo rioplatense, y los nombres propios de cada lugar se mantienen intactos en inglés y portugués aunque el resto del texto sí se traduzca.',
            en: 'Destination pages now use the local River Plate voseo, and each place’s proper name stays intact in English and Portuguese even though the rest of the text is translated.',
            pt: 'As páginas de destinos passaram a usar o voseo rio-platense, e os nomes próprios de cada lugar ficam intactos em inglês e português, mesmo com o resto do texto traduzido.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-listing-editor-form-polish',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'El editor de tu ficha quedó más prolijo',
            en: 'Your listing editor got tidier',
            pt: 'O editor da sua ficha ficou mais organizado'
        },
        body: {
            es: 'Ajustamos el formulario de videos y los botones del editor: las etiquetas ya no se pegan a los campos, los títulos entran en un solo renglón y los botones tienen el tamaño que corresponde.',
            en: 'We tuned the video form and the editor buttons: labels no longer stick to their fields, titles fit on one line and buttons are the right size.',
            pt: 'Ajustamos o formulário de vídeos e os botões do editor: os rótulos não colam mais nos campos, os títulos cabem em uma linha e os botões têm o tamanho certo.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-import-listing-keeps-formatting',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['HOST'],
        title: {
            es: 'Importá tu ficha desde otra plataforma sin perder el formato',
            en: 'Import your listing from another platform without losing formatting',
            pt: 'Importe sua ficha de outra plataforma sem perder a formatação'
        },
        body: {
            es: 'Al importar una ficha, la descripción llega completa y con sus párrafos y saltos de línea tal como estaban, en vez de quedar como un bloque de texto corrido.',
            en: 'When importing a listing, the description arrives complete, with its paragraphs and line breaks intact, instead of collapsing into one run-on block.',
            pt: 'Ao importar uma ficha, a descrição chega completa e com seus parágrafos e quebras de linha, em vez de virar um bloco corrido.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-return-url-survives-signin',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Después de entrar volvés a donde estabas',
            en: 'After signing in you land back where you were',
            pt: 'Depois de entrar você volta para onde estava'
        },
        body: {
            es: 'Si te pedimos que inicies sesión en medio de algo, al terminar volvés a esa misma página y no al inicio.',
            en: 'If we ask you to sign in mid-task, you now come back to that same page instead of the home page.',
            pt: 'Se pedirmos que você entre no meio de algo, ao terminar você volta para a mesma página e não para o início.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-slug-follows-type-change',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Cambiar el tipo de alojamiento actualiza su enlace',
            en: 'Changing the listing type updates its link',
            pt: 'Mudar o tipo de acomodação atualiza o link'
        },
        body: {
            es: 'Si pasás tu ficha de departamento a cabaña, el enlace se rearma solo para reflejarlo, aunque no le hayas cambiado el nombre.',
            en: 'If you switch your listing from apartment to cabin, the link rebuilds itself to match, even if you did not change the name.',
            pt: 'Se você muda sua ficha de apartamento para cabana, o link se refaz sozinho para refletir isso, mesmo sem trocar o nome.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-menu-as-photo-or-pdf',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['GASTRONOMY_OWNER'],
        title: {
            es: 'Subí tu carta como foto o PDF, no sólo como enlace',
            en: 'Upload your menu as a photo or PDF, not just a link',
            pt: 'Envie seu cardápio como foto ou PDF, não só como link'
        },
        body: {
            es: 'Ahora tenés tres formas de mostrar la carta: un enlace externo, una foto, un PDF, o cargarla plato por plato. Y el botón de la ficha dice si lo que hay es una foto o un PDF.',
            en: 'You now have three ways to show your menu: an external link, a photo, a PDF, or item by item. And the button on your page says whether it is a photo or a PDF.',
            pt: 'Agora você tem três formas de mostrar o cardápio: um link externo, uma foto, um PDF, ou item por item. E o botão da ficha diz se é uma foto ou um PDF.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-opening-hours-partial-state',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Los horarios a medio cargar ya no se pierden',
            en: 'Half-filled opening hours are no longer lost',
            pt: 'Horários preenchidos pela metade não se perdem mais'
        },
        body: {
            es: 'Si destildás «cerrado» en un día y todavía no cargaste las franjas horarias, el formulario aguanta ese estado intermedio en vez de descartarte lo que venías haciendo.',
            en: 'If you untick “closed” on a day and have not filled the time slots yet, the form holds that in-between state instead of discarding what you were doing.',
            pt: 'Se você desmarca «fechado» em um dia e ainda não preencheu os horários, o formulário mantém esse estado intermediário em vez de descartar o que você estava fazendo.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-free-plan-already-yours',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: 'El plan gratis ya no te ofrece pagar cero pesos',
            en: 'The free plan no longer offers to charge you zero',
            pt: 'O plano grátis não oferece mais cobrar zero'
        },
        body: {
            es: 'Si estás en el plan gratuito, la tarjeta te dice «Ya tenés este plan» en vez de invitarte a un pago de $ 0 que no llevaba a ningún lado.',
            en: 'If you are on the free plan, the card now says “You already have this plan” instead of inviting you to a $0 checkout that went nowhere.',
            pt: 'Se você está no plano gratuito, o cartão diz «Você já tem este plano» em vez de convidar para um pagamento de R$ 0 que não levava a lugar nenhum.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-cron-panel-partial-state',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['ADMIN', 'SUPER_ADMIN'],
        title: {
            es: 'El panel de tareas distingue «parcial» de «falló»',
            en: 'The jobs panel tells “partial” apart from “failed”',
            pt: 'O painel de tarefas distingue «parcial» de «falhou»'
        },
        body: {
            es: 'Una tarea programada que procesó algunas cosas y falló en otras ahora se muestra como parcial y encabeza su categoría, en vez de mezclarse con las que salieron bien.',
            en: 'A scheduled job that processed some items and failed on others now shows as partial and heads its category, instead of blending in with the successful ones.',
            pt: 'Uma tarefa agendada que processou algumas coisas e falhou em outras agora aparece como parcial e encabeça sua categoria, em vez de se misturar com as que deram certo.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-featured-follows-live-entitlement',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Tu alojamiento destacado sigue a tu plan vigente',
            en: 'Your featured listing follows your current plan',
            pt: 'Sua acomodação em destaque acompanha seu plano vigente'
        },
        body: {
            es: 'Si tu plan o un complemento te dan destacado, tus alojamientos aparecen destacados en el listado sin que tengas que tocar nada. Si el beneficio se termina, dejan de estarlo solos.',
            en: 'If your plan or an add-on grants featuring, your listings show as featured automatically. When the benefit ends, they stop being featured on their own.',
            pt: 'Se o seu plano ou um complemento dão destaque, suas acomodações aparecem destacadas automaticamente. Quando o benefício termina, elas deixam de aparecer sozinhas.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-subscription-lookup-by-vertical',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER', 'HOST'],
        title: {
            es: 'Cada suscripción se consulta por su propio rubro',
            en: 'Each subscription is looked up by its own vertical',
            pt: 'Cada assinatura é consultada pelo seu próprio segmento'
        },
        body: {
            es: 'Si tenés alojamiento y gastronomía a la vez, cada rubro informa su propia suscripción y su propio estado, sin mezclarse ni pisarse.',
            en: 'If you run both an accommodation and a restaurant, each vertical reports its own subscription and its own status, without mixing or overriding the other.',
            pt: 'Se você tem acomodação e gastronomia ao mesmo tempo, cada segmento informa sua própria assinatura e seu próprio status, sem se misturar.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-plan-comparison-shows-real-limits',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER', 'HOST'],
        title: {
            es: 'La comparación de planes muestra los límites reales',
            en: 'The plan comparison shows the real limits',
            pt: 'A comparação de planos mostra os limites reais'
        },
        body: {
            es: 'Cada plan lista sólo lo que agrega respecto del anterior, los límites coinciden con lo que realmente vas a tener, y «sin límite» se lee «Ilimitado» en vez de un número raro.',
            en: 'Each plan lists only what it adds over the previous one, the limits match what you will actually get, and “no limit” now reads “Unlimited” instead of an odd number.',
            pt: 'Cada plano lista apenas o que acrescenta em relação ao anterior, os limites batem com o que você realmente terá, e «sem limite» aparece como «Ilimitado» em vez de um número estranho.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-no-native-browser-dialogs',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Se terminaron los avisos grises del navegador',
            en: 'No more grey browser pop-ups',
            pt: 'Acabaram os avisos cinzas do navegador'
        },
        body: {
            es: 'Borrar una colección, cancelar el boletín o pegar un enlace ya no abren esos cuadros grises del navegador: ahora son diálogos propios, en tu idioma y con el estilo del sitio.',
            en: 'Deleting a collection, unsubscribing from the newsletter or pasting a link no longer open those grey browser boxes: they are now proper dialogs, in your language and in the site’s style.',
            pt: 'Excluir uma coleção, cancelar a newsletter ou colar um link não abrem mais aquelas caixas cinzas do navegador: agora são diálogos próprios, no seu idioma e com o estilo do site.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-single-auth-screen-with-tabs',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Entrar y registrarse, en una sola pantalla',
            en: 'Sign in and sign up on a single screen',
            pt: 'Entrar e cadastrar-se em uma única tela'
        },
        body: {
            es: 'Ahora hay una sola pantalla con dos pestañas. Si cambiás de pestaña, no perdés el email que ya escribiste ni el lugar al que ibas, y podés ver la contraseña que tipeás.',
            en: 'There is now a single screen with two tabs. Switching tabs keeps the email you already typed and where you were heading, and you can reveal the password as you type it.',
            pt: 'Agora há uma única tela com duas abas. Ao trocar de aba você não perde o e-mail já digitado nem para onde ia, e pode ver a senha enquanto digita.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-similar-listings-real-photos',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: '«Alojamientos similares» muestra fotos de verdad',
            en: '“Similar places” now shows real photos',
            pt: '«Acomodações similares» mostra fotos de verdade'
        },
        body: {
            es: 'La sección de alojamientos similares al pie de cada ficha ya no muestra recuadros vacíos: cada sugerencia aparece con su propia foto.',
            en: 'The similar-places section at the bottom of each listing no longer shows empty boxes: every suggestion comes with its own photo.',
            pt: 'A seção de acomodações similares no rodapé de cada ficha não mostra mais quadros vazios: cada sugestão vem com sua própria foto.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-vertical-landing-pages',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Páginas de presentación para cada rubro',
            en: 'Presentation pages for each vertical',
            pt: 'Páginas de apresentação para cada segmento'
        },
        body: {
            es: 'Hay seis páginas nuevas que explican qué ofrece Hospeda a anfitriones, restaurantes, experiencias, aliados y proveedores, con enlaces cortos y directos para compartir.',
            en: 'Six new pages explain what Hospeda offers to hosts, restaurants, experiences, partners and providers, with short direct links you can share.',
            pt: 'Seis páginas novas explicam o que a Hospeda oferece a anfitriões, restaurantes, experiências, parceiros e fornecedores, com links curtos e diretos para compartilhar.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-search-ignores-accents',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['USER'],
        title: {
            es: 'Buscá sin tildes y encontrá igual',
            en: 'Search without accents and still find it',
            pt: 'Busque sem acentos e encontre do mesmo jeito'
        },
        body: {
            es: 'Escribir «Colon» encuentra Colón, «Gualeguaychu» encuentra Gualeguaychú y «cabana» encuentra Cabaña. Ya no hace falta acertarle a la tilde ni a la eñe.',
            en: 'Typing “Colon” finds Colón, “Gualeguaychu” finds Gualeguaychú and “cabana” finds Cabaña. You no longer have to get the accent or the ñ right.',
            pt: 'Digitar «Colon» encontra Colón, «Gualeguaychu» encontra Gualeguaychú e «cabana» encontra Cabaña. Não é mais preciso acertar o acento nem o ñ.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-partner-pages-without-prices',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['SPONSOR'],
        title: {
            es: 'La sección de aliados va sin precios publicados',
            en: 'The partners section goes without published prices',
            pt: 'A seção de parceiros vai sem preços publicados'
        },
        body: {
            es: 'Las páginas de aliados dejaron de anunciar importes: las condiciones se acuerdan caso por caso, y así lo dice ahora la página.',
            en: 'The partner pages no longer advertise amounts: terms are agreed case by case, and the page now says so.',
            pt: 'As páginas de parceiros deixaram de anunciar valores: as condições são acordadas caso a caso, e a página agora diz isso.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-collections-update-without-reload',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: 'Crear una colección ya no recarga la página',
            en: 'Creating a collection no longer reloads the page',
            pt: 'Criar uma coleção não recarrega mais a página'
        },
        body: {
            es: 'Al crear una colección de favoritos aparece al instante en la lista, con su aviso de confirmación, sin que se recargue nada.',
            en: 'When you create a favourites collection it shows up in the list instantly, with a confirmation notice, and nothing reloads.',
            pt: 'Ao criar uma coleção de favoritos ela aparece na hora na lista, com o aviso de confirmação, sem recarregar nada.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-courtesy-period-visible-to-subscriber',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Si te regalamos un período, lo ves en tu suscripción',
            en: 'If we gift you a period, you see it in your subscription',
            pt: 'Se presentearmos você com um período, ele aparece na sua assinatura'
        },
        body: {
            es: 'Tu panel de suscripción muestra la etiqueta «De regalo» y hasta qué fecha no se te cobra nada. Mientras dure, no hace falta cambiar de plan, y podés cancelar cuando quieras.',
            en: 'Your subscription panel shows a “Gifted” badge and the date until which you are not charged. While it lasts there is no need to change plan, and you can cancel whenever you want.',
            pt: 'Seu painel de assinatura mostra a etiqueta «De presente» e até que data nada é cobrado. Enquanto durar, não é preciso trocar de plano, e você pode cancelar quando quiser.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-editor-back-button-consistency',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Todos los editores tienen el mismo «Volver»',
            en: 'Every editor has the same “Back”',
            pt: 'Todos os editores têm o mesmo «Voltar»'
        },
        body: {
            es: 'Las secciones del editor comparten un mismo botón «Volver» que te deja siempre en el índice de tu ficha, vengas de donde vengas.',
            en: 'Editor sections now share a single “Back” button that always lands you on your listing’s index, no matter where you came from.',
            pt: 'As seções do editor compartilham um mesmo botão «Voltar» que sempre leva ao índice da sua ficha, venha de onde vier.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-menu-headers-readable',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Los títulos de los menús se distinguen de sus opciones',
            en: 'Menu headings now stand apart from their items',
            pt: 'Os títulos dos menus se distinguem das opções'
        },
        body: {
            es: 'En los menús desplegables, el título de cada grupo se ve claramente distinto de las opciones que agrupa, tanto en modo claro como oscuro.',
            en: 'In dropdown menus, each group heading now looks clearly different from the items it groups, in both light and dark mode.',
            pt: 'Nos menus suspensos, o título de cada grupo fica claramente diferente das opções que agrupa, tanto no modo claro quanto no escuro.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-alt-text-reminder-on-photos',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Te avisamos si tus fotos quedaron sin descripción',
            en: 'We warn you when your photos have no description',
            pt: 'Avisamos se suas fotos ficaram sem descrição'
        },
        body: {
            es: 'Al salir de la sección de fotos, si alguna quedó sin texto alternativo te lo recordamos y te explicamos para qué sirve: para los lectores de pantalla y para que Google entienda tu ficha.',
            en: 'When you leave the photos section, if any photo has no alternative text we remind you and explain what it is for: screen readers, and so Google understands your listing.',
            pt: 'Ao sair da seção de fotos, se alguma ficou sem texto alternativo lembramos você e explicamos para que serve: leitores de tela e para o Google entender sua ficha.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-photo-thumbnails-less-covered',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Los botones ya no tapan tus fotos',
            en: 'Buttons no longer cover your photos',
            pt: 'Os botões não cobrem mais suas fotos'
        },
        body: {
            es: 'En la grilla de fotos, los controles pasaron a ocupar menos de la décima parte de cada miniatura, quedan dentro del recuadro y son cómodos de tocar en el celular.',
            en: 'In the photo grid, controls now take up less than a tenth of each thumbnail, stay inside the frame and are comfortable to tap on a phone.',
            pt: 'Na grade de fotos, os controles passaram a ocupar menos de um décimo de cada miniatura, ficam dentro do quadro e são confortáveis de tocar no celular.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-photo-quota-warning-before-upload',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'Te avisamos antes de subir más fotos de las que entran',
            en: 'We warn you before uploading more photos than fit',
            pt: 'Avisamos antes de enviar mais fotos do que cabem'
        },
        body: {
            es: 'Si elegís más fotos de las que te quedan libres, te lo decimos con el número exacto antes de subir nada, en vez de cortar a mitad de camino.',
            en: 'If you pick more photos than you have room for, we tell you the exact number before uploading anything, instead of cutting off halfway.',
            pt: 'Se você escolher mais fotos do que o espaço disponível, avisamos o número exato antes de enviar qualquer coisa, em vez de cortar no meio.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-shared-report-view-is-clean',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'El informe que compartís se ve limpio',
            en: 'The report you share looks clean',
            pt: 'O relatório que você compartilha aparece limpo'
        },
        body: {
            es: 'La vista compartida de un informe ya no arrastra restos del sitio: quien la abre ve el informe y nada más.',
            en: 'The shared view of a report no longer drags in leftovers from the site: whoever opens it sees the report and nothing else.',
            pt: 'A visualização compartilhada de um relatório não arrasta mais restos do site: quem abre vê o relatório e nada mais.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-featured-addon-offer-on-editor',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST'],
        title: {
            es: 'La oferta para destacar aparece donde editás tu ficha',
            en: 'The offer to feature your listing shows where you edit it',
            pt: 'A oferta para destacar aparece onde você edita sua ficha'
        },
        body: {
            es: 'Si tu alojamiento todavía no está destacado, en el índice del editor ves la sección «Destacá este alojamiento» con la opción disponible. Si ya lo está por tu plan, la oferta no te molesta.',
            en: 'If your listing is not featured yet, the editor index shows a “Feature this listing” section with the available option. If your plan already grants it, the offer stays out of your way.',
            pt: 'Se sua acomodação ainda não está em destaque, o índice do editor mostra a seção «Destaque esta acomodação» com a opção disponível. Se o seu plano já garante isso, a oferta não incomoda.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-sitemap-covers-new-pages',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Las páginas nuevas entran al mapa del sitio',
            en: 'New pages make it into the sitemap',
            pt: 'As páginas novas entram no mapa do site'
        },
        body: {
            es: 'Las secciones agregadas últimamente ya figuran en el mapa del sitio en los tres idiomas, así que los buscadores las encuentran.',
            en: 'Recently added sections now appear in the sitemap in all three languages, so search engines can find them.',
            pt: 'As seções adicionadas recentemente já constam no mapa do site nos três idiomas, então os buscadores as encontram.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-editor-publishes-own-posts',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['EDITOR'],
        title: {
            es: 'Un editor de confianza publica sus propias notas',
            en: 'A trusted editor publishes their own posts',
            pt: 'Um editor de confiança publica seus próprios textos'
        },
        body: {
            es: 'Si sos editor, ya podés aprobar y publicar tus propias notas sin esperar a otra persona. La nota aparece en el blog público apenas la publicás.',
            en: 'If you are an editor, you can now approve and publish your own posts without waiting for someone else. The post shows up on the public blog as soon as you publish it.',
            pt: 'Se você é editor, já pode aprovar e publicar seus próprios textos sem esperar outra pessoa. O texto aparece no blog público assim que você publica.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-daily-specials-expire-on-their-own',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER'],
        title: {
            es: 'El menú del día se vence solo',
            en: 'Today’s specials expire on their own',
            pt: 'O cardápio do dia expira sozinho'
        },
        body: {
            es: 'Cargás el menú del día con su fecha de vigencia y se muestra en tu página mientras esté vigente. Cuando pasa, desaparece solo, sin que tengas que acordarte de borrarlo.',
            en: 'You set today’s specials with their validity dates and they show on your page while valid. When the date passes they disappear on their own — no need to remember to delete them.',
            pt: 'Você cadastra o cardápio do dia com sua vigência e ele aparece na sua página enquanto vale. Quando passa, some sozinho, sem você ter que lembrar de apagar.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-menu-in-three-languages',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['GASTRONOMY_OWNER'],
        title: {
            es: 'Tu carta, en español, inglés y portugués',
            en: 'Your menu in Spanish, English and Portuguese',
            pt: 'Seu cardápio em espanhol, inglês e português'
        },
        body: {
            es: 'Podés cargar el nombre y la descripción de cada sección y cada plato en los tres idiomas. En tu página aparece un selector para que el visitante elija en cuál leerla.',
            en: 'You can enter the name and description of every section and dish in all three languages. Your page shows a picker so visitors choose which one to read it in.',
            pt: 'Você pode cadastrar o nome e a descrição de cada seção e cada prato nos três idiomas. Na sua página aparece um seletor para o visitante escolher em qual ler.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-photo-per-dish',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER'],
        title: {
            es: 'Una foto por plato en tu carta',
            en: 'A photo per dish on your menu',
            pt: 'Uma foto por prato no seu cardápio'
        },
        body: {
            es: 'Cada plato puede llevar su propia foto, cargada desde la misma fila donde editás el precio, y se muestra junto al plato en tu página.',
            en: 'Each dish can carry its own photo, uploaded from the same row where you edit the price, and it shows next to the dish on your page.',
            pt: 'Cada prato pode ter sua própria foto, enviada da mesma linha onde você edita o preço, e ela aparece ao lado do prato na sua página.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-dietary-options-filter',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['USER', 'GASTRONOMY_OWNER'],
        title: {
            es: 'Filtrá restaurantes por opciones sin gluten, veganas o sin lactosa',
            en: 'Filter restaurants by gluten-free, vegan or lactose-free options',
            pt: 'Filtre restaurantes por opções sem glúten, veganas ou sem lactose'
        },
        body: {
            es: 'Los restaurantes pueden declarar si tienen opciones sin gluten, veganas o sin lactosa, y aparecen en la sección «Características» de su página. Vos podés filtrar el listado por eso.',
            en: 'Restaurants can declare whether they offer gluten-free, vegan or lactose-free options, shown in the “Features” section of their page. You can filter the listing by that.',
            pt: 'Os restaurantes podem declarar se têm opções sem glúten, veganas ou sem lactose, mostradas na seção «Características» da página. Você pode filtrar a lista por isso.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-multi-vertical-subscription-card',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Si tenés varias suscripciones, las ves todas',
            en: 'If you have several subscriptions, you see them all',
            pt: 'Se você tem várias assinaturas, vê todas'
        },
        body: {
            es: 'Cuando tenés más de una suscripción activa, tu cuenta te lo dice y el panel se abre con una pestaña por rubro, en vez de mostrarte sólo una y esconder el resto.',
            en: 'When you hold more than one active subscription, your account says so and the panel opens with one tab per vertical, instead of showing one and hiding the rest.',
            pt: 'Quando você tem mais de uma assinatura ativa, sua conta informa isso e o painel abre com uma aba por segmento, em vez de mostrar só uma e esconder o resto.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-features-on-commerce-pages',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: 'Las páginas de restaurantes y experiencias muestran sus características',
            en: 'Restaurant and experience pages now show their features',
            pt: 'As páginas de restaurantes e experiências mostram suas características'
        },
        body: {
            es: 'Lo que cargó el dueño — desde «actividad al aire libre» hasta «aire acondicionado» — ahora se ve en la página pública, agrupado en «Características» y «Comodidades».',
            en: 'What the owner filled in — from “outdoor activity” to “air conditioning” — now shows on the public page, grouped under “Features” and “Amenities”.',
            pt: 'O que o dono cadastrou — de «atividade ao ar livre» a «ar-condicionado» — agora aparece na página pública, agrupado em «Características» e «Comodidades».'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-cuisine-type-catalog',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER'],
        title: {
            es: 'El tipo de local y el tipo de cocina son dos cosas distintas',
            en: 'Venue type and cuisine type are two different things',
            pt: 'O tipo de local e o tipo de cozinha são duas coisas distintas'
        },
        body: {
            es: 'Podés declarar a la vez qué clase de local tenés — cervecería, parrilla, rotisería — y qué cocinas ofrecés, eligiendo más de una de un catálogo.',
            en: 'You can now state both what kind of venue you run — brewpub, grill, deli — and which cuisines you serve, picking more than one from a catalogue.',
            pt: 'Você pode declarar ao mesmo tempo que tipo de local tem — cervejaria, churrascaria, rotisseria — e quais cozinhas oferece, escolhendo mais de uma de um catálogo.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-dead-whatsapp-not-published',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Un WhatsApp que no corresponde ya no se publica',
            en: 'A WhatsApp number that does not apply is no longer published',
            pt: 'Um WhatsApp que não corresponde não é mais publicado'
        },
        body: {
            es: 'Si quedó un número de WhatsApp cargado en un campo que ya no se usa, no aparece en tu página pública ni escondido en el código, así que nadie te escribe a un número que no atendés.',
            en: 'If a WhatsApp number was left in a field that is no longer in use, it does not show on your public page nor hidden in the code, so nobody writes to a number you do not answer.',
            pt: 'Se sobrou um número de WhatsApp em um campo que não se usa mais, ele não aparece na sua página pública nem escondido no código, então ninguém escreve para um número que você não atende.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-vertical-specific-error-messages',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Cada rubro recibe el mensaje de error que le corresponde',
            en: 'Each vertical gets the error message that belongs to it',
            pt: 'Cada segmento recebe a mensagem de erro que lhe cabe'
        },
        body: {
            es: 'Si algo falla en tu ficha de gastronomía, el aviso habla de gastronomía; si falla en una experiencia, habla de experiencias. Ya no se cruzan las respuestas entre rubros.',
            en: 'If something fails on your dining listing, the message talks about dining; if it fails on an experience, it talks about experiences. Responses no longer cross between verticals.',
            pt: 'Se algo falha na sua ficha de gastronomia, o aviso fala de gastronomia; se falha em uma experiência, fala de experiências. As respostas não se cruzam mais entre segmentos.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-commerce-editor-by-sections',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'El editor de tu comercio ahora va por secciones',
            en: 'Your business editor now works section by section',
            pt: 'O editor do seu comércio agora vai por seções'
        },
        body: {
            es: 'En vez de un formulario único gigante, ahora editás tu ficha por partes — datos, fotos, horarios, carta — como ya se hacía con los alojamientos. Cada sección se guarda por su cuenta.',
            en: 'Instead of one giant form, you now edit your listing in parts — details, photos, hours, menu — just like accommodations already worked. Each section saves on its own.',
            pt: 'Em vez de um formulário único gigante, agora você edita sua ficha por partes — dados, fotos, horários, cardápio — como já funcionava nas acomodações. Cada seção salva por conta própria.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-listing-visibility-cache',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'La visibilidad de tu ficha se corrige sola',
            en: 'Your listing’s visibility corrects itself',
            pt: 'A visibilidade da sua ficha se corrige sozinha'
        },
        body: {
            es: 'El estado de tu suscripción y la visibilidad de tus fichas se revisan solos cada pocas horas, así que un aviso de pago que llegó tarde no deja una ficha escondida por error.',
            en: 'Your subscription status and your listings’ visibility are re-checked automatically every few hours, so a payment notice that arrived late does not leave a listing hidden by mistake.',
            pt: 'O status da sua assinatura e a visibilidade das suas fichas são revisados sozinhos a cada poucas horas, então um aviso de pagamento atrasado não deixa uma ficha escondida por engano.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-commerce-signup-rejects-hostile-fields',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'El alta de comercio ignora lo que no le corresponde',
            en: 'Business signup ignores what does not belong to it',
            pt: 'O cadastro de comércio ignora o que não lhe cabe'
        },
        body: {
            es: 'El alta de una ficha nueva ya no acepta que le manden campos que decide el sistema, como si está destacada o cuántas reseñas tiene. Nace siempre con los valores correctos.',
            en: 'Creating a new listing no longer accepts fields the system decides, such as whether it is featured or how many reviews it has. It always starts with the right values.',
            pt: 'O cadastro de uma ficha nova não aceita mais campos que o sistema decide, como se está em destaque ou quantas avaliações tem. Ela sempre nasce com os valores corretos.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-published-prices-match-plans',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER', 'HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Los precios publicados coinciden con los planes reales',
            en: 'Published prices match the real plans',
            pt: 'Os preços publicados batem com os planos reais'
        },
        body: {
            es: 'Los importes que se anuncian en las páginas de precios son exactamente los de cada plan. Se sacaron las frases vagas del tipo «del orden de».',
            en: 'The amounts advertised on the pricing pages are exactly those of each plan. Vague phrases like “in the region of” are gone.',
            pt: 'Os valores anunciados nas páginas de preços são exatamente os de cada plano. Frases vagas do tipo «na ordem de» foram removidas.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-open-redirect-protection',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Un enlace no puede llevarte fuera de Hospeda sin que lo sepas',
            en: 'A link cannot take you off Hospeda without you knowing',
            pt: 'Um link não pode levar você para fora da Hospeda sem que você saiba'
        },
        body: {
            es: 'El destino al que volvés después de iniciar sesión ahora se valida: sólo se honra si es una página de Hospeda. Un enlace preparado para desviarte a otro sitio queda rechazado.',
            en: 'The destination you return to after signing in is now validated: it is only honoured if it is a Hospeda page. A link crafted to divert you elsewhere is rejected.',
            pt: 'O destino para onde você volta depois de entrar agora é validado: só é honrado se for uma página da Hospeda. Um link preparado para desviar você é rejeitado.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-addon-raises-listing-quota',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Comprar un complemento te sube el cupo al instante',
            en: 'Buying an add-on raises your quota instantly',
            pt: 'Comprar um complemento aumenta sua cota na hora'
        },
        body: {
            es: 'Si llegaste al tope de fichas de tu plan, podés comprar un lugar extra y el cupo sube en el momento, sin cambiar de plan ni esperar al próximo período.',
            en: 'If you hit your plan’s listing cap, you can buy an extra slot and the quota goes up right away, with no plan change and no waiting for the next period.',
            pt: 'Se você atingiu o limite de fichas do seu plano, pode comprar uma vaga extra e a cota sobe na hora, sem trocar de plano nem esperar o próximo período.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-addon-requires-matching-subscription',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER', 'HOST'],
        title: {
            es: 'Cada complemento se compra sobre la suscripción que le corresponde',
            en: 'Each add-on is bought against the subscription it belongs to',
            pt: 'Cada complemento é comprado sobre a assinatura que lhe cabe'
        },
        body: {
            es: 'Si intentás comprar un complemento de gastronomía sin tener una suscripción de gastronomía activa, te lo decimos con claridad en vez de cobrarte algo que no ibas a poder usar.',
            en: 'If you try to buy a dining add-on without an active dining subscription, we tell you plainly instead of charging you for something you could not use.',
            pt: 'Se você tenta comprar um complemento de gastronomia sem ter uma assinatura de gastronomia ativa, avisamos com clareza em vez de cobrar algo que você não poderia usar.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-commerce-30-day-trial',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER'],
        title: {
            es: 'Publicá tu comercio con 30 días de prueba',
            en: 'Publish your business with a 30-day trial',
            pt: 'Publique seu comércio com 30 dias de teste'
        },
        body: {
            es: 'Cuando tu ficha tiene foto, contacto, horarios y precio, el botón «Publicar gratis 30 días» se habilita y tu comercio sale publicado sin cobro durante ese período.',
            en: 'Once your listing has a photo, contact details, hours and a price, the “Publish free for 30 days” button unlocks and your business goes live at no charge for that period.',
            pt: 'Quando sua ficha tem foto, contato, horários e preço, o botão «Publicar grátis por 30 dias» é liberado e seu comércio vai ao ar sem cobrança nesse período.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-favourites-return-to-the-listing',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: 'Guardar un favorito te devuelve al listado con tu filtro',
            en: 'Saving a favourite returns you to the listing with your filter',
            pt: 'Salvar um favorito devolve você à lista com seu filtro'
        },
        body: {
            es: 'Si tocás el corazón o el modo comparar desde un listado filtrado, al volver seguís en ese listado con el filtro puesto, y no en tu cuenta.',
            en: 'If you tap the heart or compare mode from a filtered list, you come back to that list with the filter still applied, not to your account page.',
            pt: 'Se você toca no coração ou no modo comparar em uma lista filtrada, ao voltar continua nessa lista com o filtro aplicado, e não na sua conta.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-admin-panel-own-dialogs',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['ADMIN', 'SUPER_ADMIN', 'EDITOR'],
        title: {
            es: 'El panel usa diálogos propios en vez de los del navegador',
            en: 'The admin panel uses its own dialogs instead of the browser’s',
            pt: 'O painel usa diálogos próprios em vez dos do navegador'
        },
        body: {
            es: 'Las confirmaciones del panel de administración pasaron a ser diálogos del sistema, en tu idioma y con el estilo del producto.',
            en: 'Confirmations in the admin panel are now product dialogs, in your language and in the product’s style.',
            pt: 'As confirmações do painel de administração passaram a ser diálogos do sistema, no seu idioma e com o estilo do produto.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-signup-verification-link-works',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'El registro ya no falla al volver desde el correo',
            en: 'Signing up no longer fails when you come back from the email',
            pt: 'O cadastro não falha mais ao voltar do e-mail'
        },
        body: {
            es: 'El enlace de verificación que te mandamos apunta a la dirección segura del sitio, así que al volver desde el mail el registro se completa en vez de rebotar.',
            en: 'The verification link we send points to the site’s secure address, so coming back from the email completes the signup instead of bouncing.',
            pt: 'O link de verificação que enviamos aponta para o endereço seguro do site, então voltar do e-mail conclui o cadastro em vez de dar erro.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-partner-card-without-price',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['SPONSOR'],
        title: {
            es: 'Ser aliado se acuerda a medida',
            en: 'Becoming a partner is agreed case by case',
            pt: 'Ser parceiro é acordado sob medida'
        },
        body: {
            es: 'La tarjeta «Ser partner de Hospeda» dejó de mostrar un importe y una prueba de 30 días que no correspondían: ahora dice que las condiciones comerciales se acuerdan a medida.',
            en: 'The “Become a Hospeda partner” card no longer shows an amount and a 30-day trial that did not apply: it now says commercial terms are agreed case by case.',
            pt: 'O cartão «Ser parceiro da Hospeda» deixou de mostrar um valor e um teste de 30 dias que não cabiam: agora diz que as condições comerciais são acordadas sob medida.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-future-dated-news-stay-hidden',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Una novedad con fecha futura no se adelanta',
            en: 'A future-dated announcement does not jump the gun',
            pt: 'Uma novidade com data futura não se antecipa'
        },
        body: {
            es: 'Las novedades programadas para más adelante quedan ocultas hasta su fecha: no aparecen en la lista, no suman al contador de no leídas ni abren el aviso emergente.',
            en: 'Announcements scheduled for later stay hidden until their date: they do not appear in the list, do not add to the unread count and do not pop the modal open.',
            pt: 'As novidades agendadas para depois ficam ocultas até sua data: não aparecem na lista, não somam ao contador de não lidas nem abrem o aviso.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-ai-writing-helpers',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['HOST', 'GASTRONOMY_OWNER', 'EXPERIENCE_OWNER', 'EDITOR'],
        title: {
            es: 'Ayuda con IA para escribir y traducir tus textos',
            en: 'AI help to write and translate your copy',
            pt: 'Ajuda com IA para escrever e traduzir seus textos'
        },
        body: {
            es: 'Desde el editor podés pedirle a la IA que mejore un texto o lo traduzca, además del chat de consultas.',
            en: 'From the editor you can ask the AI to improve a text or translate it, alongside the question chat.',
            pt: 'No editor você pode pedir à IA que melhore um texto ou o traduza, além do chat de dúvidas.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-tourist-plans-simplified',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['USER'],
        title: {
            es: 'Los planes de turista quedaron en dos: Gratis y VIP',
            en: 'Tourist plans are now just two: Free and VIP',
            pt: 'Os planos de turista ficaram em dois: Grátis e VIP'
        },
        body: {
            es: 'Se retiró el plan intermedio. La página de planes muestra dos opciones claras, y ninguna promete días de prueba que no existían.',
            en: 'The middle plan was retired. The plans page shows two clear options, and none promises trial days that did not exist.',
            pt: 'O plano intermediário foi retirado. A página de planos mostra duas opções claras, e nenhuma promete dias de teste que não existiam.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-partner-network-promise-retired',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Se retiró una promesa que el producto todavía no cumple',
            en: 'A promise the product does not yet keep was retired',
            pt: 'Retiramos uma promessa que o produto ainda não cumpre'
        },
        body: {
            es: 'Las páginas de beneficios dejaron de hablar de una «red de aliados verificados» que todavía no existe como tal. Preferimos decir sólo lo que hoy es cierto.',
            en: 'The benefits pages stopped referring to a “verified partner network” that does not yet exist as such. We would rather say only what is true today.',
            pt: 'As páginas de benefícios deixaram de falar de uma «rede de parceiros verificados» que ainda não existe. Preferimos dizer apenas o que hoje é verdade.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-whats-new-has-content',
        publishedAt: 'on-promotion',
        highlight: false,
        title: {
            es: 'Esta sección ahora te cuenta lo que cambió',
            en: 'This section now tells you what changed',
            pt: 'Esta seção agora conta o que mudou'
        },
        body: {
            es: '«Qué hay de nuevo» empezó a tener contenido de verdad, y cada novedad le llega sólo a quien le sirve: lo de anfitriones a los anfitriones, lo de restaurantes a los restaurantes.',
            en: '“What’s new” now has real content, and each item reaches only the people it is for: host news to hosts, restaurant news to restaurants.',
            pt: '«O que há de novo» passou a ter conteúdo de verdade, e cada novidade chega só a quem interessa: o de anfitriões aos anfitriões, o de restaurantes aos restaurantes.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
    {
        id: '2026-09-08-whats-new-written-by-the-signoff',
        publishedAt: 'on-promotion',
        highlight: false,
        roles: ['ADMIN', 'SUPER_ADMIN'],
        title: {
            es: 'Las novedades se escriben solas al verificar cada cambio',
            en: 'Announcements are written automatically when a change is verified',
            pt: 'As novidades são escritas sozinhas ao verificar cada mudança'
        },
        body: {
            es: 'Cada verificación manual deja escrita su novedad, que queda invisible hasta que alguien la aprueba en la promoción a producción. Ninguna promoción avanza si quedó un cambio sin decidir si es novedad o no.',
            en: 'Every manual verification now writes its announcement, which stays invisible until someone approves it at the production promotion. No promotion moves forward while a change has not been decided on.',
            pt: 'Cada verificação manual deixa sua novidade escrita, que fica invisível até alguém aprová-la na promoção para produção. Nenhuma promoção avança se algum item ficou sem decisão.'
        },
        translations: { en: 'machine', pt: 'machine' }
    },
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
