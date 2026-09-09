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
