---
title: F1. Bloques dinámicos y resolver
linear: HOS-2636
parent: HOS-2635
statusSource: linear
created: 2026-11-25
smokeLabels: []
---

# F1. Bloques dinámicos y resolver (HOS-2636)

Paraguas: [spec.md](./spec.md). Decisiones aplicables: D-1 (revalidación al enviar),
D-2, D-3, D-14 (resolver único con escrituras apagadas), D-15.

## 1. Objetivo

Que un admin pueda insertar en el editor de campañas un **bloque dinámico** (fuente,
cantidad, parámetros, mínimo) y que ese bloque se resuelva **en el momento del envío**,
una sola vez por campaña, con las mismas reglas que después usará el motor de F2.

## 2. Alcance

### Incluye

- Enums `NewsletterDynamicSourceEnum`, `NewsletterIfBelowMinEnum` y `DynamicBlockConfigSchema` (§4.5).
- Extensión TipTap `dynamicBlock` en el editor del admin (nodo atómico de raíz, panel de config).
- Resolvers `most_viewed`, `newest`, `top_rated`; `featured` declarado y rechazado (`FEATURED_SOURCE_DISABLED`).
- `resolveBlocks()` con `minItems` / `ifBelowMin`, revalidación y orden determinístico.
- `DynamicSourcePort` real sobre Drizzle (alojamientos) y fake para tests.
- Render de email por segmentos con tarjeta React Email (§4.3, §4.5).
- Integración en campañas manuales: `send()` resuelve y guarda `resolved_body_json`; `testSend` y el preview usan el mismo camino.
- `sendTestEmailFromContent` en el servicio de entregas (H-18).

### No incluye

- Plantillas, corridas, dedup entre ediciones (`excludeRecentEditions` se ignora en campañas manuales, no hay historial), soft-cap por plantilla. Todo eso es F2.
- `featured` operativo (HOS-1357).
- Resolvers y tarjetas de `VENUE` (comer y salir), `POST` (notas), `EVENT`, `EXPERIENCE`
  y `PARTNER`. F1 los **declara** (enum, registros, UI deshabilitada) pero no los
  implementa (OQ-4, §4.6). Van en HOS-2642.

## 3. Dependencias

- HOS-2565 ya está en staging (H-8): `@repo/email` exporta `Button`, `Callout`,
  `EmailTitle`, `OptionCard`, `SectionBar`, `EmailLayout` (variantes `user` / `staff`) y
  `emailPalette` (`packages/email/src/index.ts:12-105`). `NewsletterCampaign` ya usa
  `EmailLayout` y `Callout`. F1 no queda bloqueada por nada.
- Ninguna migración de permisos: F1 reutiliza `newsletter.campaign.*`.

## 4. Diseño

### 4.1 Semántica en una campaña manual

- El nodo guarda `attrs.config` (JSON string validado con `DynamicBlockConfigSchema`).
- `ifBelowMin` en campaña manual: `skip_run` significa que `send()` responde **422
  `DYNAMIC_BLOCK_BELOW_MIN`** y la campaña queda `draft`; `hide_block` quita el bloque;
  `send_anyway` manda lo que haya (incluso 0 ítems, con el bloque oculto si quedó vacío).
- Default de `ifBelowMin` al insertar: `skip_run` si es el único bloque dinámico del
  documento, si no `hide_block` (D-2). El default se recalcula al agregar o quitar bloques
  sólo si el admin no lo cambió a mano.

### 4.2 Fuentes (alojamientos)

Predicado base de elegibilidad, compartido por candidatos y revalidación:
`deleted_at IS NULL AND publication_status = 'PUBLISHED'` más los filtros del bloque
(`destination_id = :destinationId` si viene).

| Fuente | Orden | Parámetros | Notas |
|---|---|---|---|
| `most_viewed` | `COUNT(entity_views)` en `viewed_at >= now() - windowDays` desc, `id` asc | `windowDays` 1..90, default 30 | usa `idx_entity_views_entity_time`; 120 días de retención (H-14); excluye los de 0 vistas en la ventana (owner, 2026-11-26) |
| `newest` | `created_at` desc, `id` asc | ninguno | no hay `published_at` (H-15) |
| `top_rated` | `average_rating` desc, `reviews_count` desc, `id` asc | `minReviews` 1..100, default 3 | filtro extra `reviews_count >= minReviews`, también en revalidación |
| `featured` | n/a | n/a | rechazado por el schema |

Archivos: `packages/service-core/src/services/newsletter/dynamic/sources/{most-viewed,newest,top-rated}.source.ts`
y un registro `SOURCE_RESOLVERS` indexado por tipo de entidad y fuente (§4.6), para que
agregar un valor a cualquiera de los dos enums sin decidir su resolver no compile.

### 4.3 Tarjeta

`loadCards` trae nombre y resumen desde `name_i18n` / `summary_i18n`
(`accommodation.dbschema.ts:70-71`) con fallback a `name` / `summary` (es, `:46-47`),
portada desde `accommodation_media.is_featured = true` (`accommodation_media.dbschema.ts:117`),
y URL `${HOSPEDA_SITE_URL}/{locale}/alojamientos/{slug}/`
(`apps/web/src/pages/[lang]/alojamientos/[slug].astro`). Imágenes sólo `https`.

El componente `DynamicBlockCards` vive en `packages/notifications/src/templates/newsletter/`
(lo usa sólo el newsletter) y se arma con `Button` y `emailPalette` de `@repo/email`, con
los estilos en `<td>` como `OptionCard` (`packages/email/src/components/option-card.tsx`)
para Outlook. Si otro mail necesita la tarjeta, se promueve a `packages/email/src/components/`.

Atribución: los links de la tarjeta apuntan a nuestro origen, así que reciben UTMs sin
código nuevo. `delivery-factory.ts:59` aplica `applyEmailAttribution` sobre el HTML
renderizado completo, y `attributeCampaignHtmlFn` (`newsletter-delivery.service.ts:735`)
hace lo mismo con el HTML del lote. El render por segmentos tiene que devolver UN string
de cuerpo que alimente los dos caminos (`bodyHtml` de `:657` y el de `:702-707`).

### 4.4 Momento de resolución

1. `send()` (manual): carga campaña, resuelve con `phase: 'send'`, si `decision = skip_run` → 422; si no, dentro de la misma transacción que inserta entregas escribe `resolved_body_json` y `resolved_at`.
2. `processBatch` renderiza `resolved_body_json ?? body_json` (hoy `campaign.bodyJson` en `newsletter-delivery.service.ts:657`). Nunca resuelve.
3. `testSend` y `POST /campaigns/{id}/resolve-preview` resuelven en seco y no escriben.
4. Si `resolved_body_json` es null y el documento tiene un `dynamicBlock`, el worker falla la entrega con `DYNAMIC_BLOCK_UNRESOLVED` en vez de mandar un bloque vacío.

### 4.5 Contratos

`packages/schemas/src/entities/newsletter/newsletter-dynamic-block.schema.ts` (nuevo):

```ts
/** Config of one dynamic block. Stored inline in campaign docs, in `versions.blocks` for templates. */
export const DynamicBlockConfigSchema = z.object({
    blockKey: z.string().regex(/^[a-z0-9-]{8,64}$/),
    entityType: z.nativeEnum(NewsletterDynamicEntityTypeEnum),
    source: z.nativeEnum(NewsletterDynamicSourceEnum),
    count: z.number().int().min(1).max(12),
    params: z.object({
        windowDays: z.number().int().min(1).max(90).optional(),
        minReviews: z.number().int().min(1).max(100).optional(),
        destinationId: z.string().uuid().optional()
    }).strict(),
    minItems: z.number().int().min(1),
    ifBelowMin: z.nativeEnum(NewsletterIfBelowMinEnum),
    excludeRecentEditions: z.number().int().min(0).max(12),
    fillWithRepeats: z.boolean()
}).superRefine(/* minItems <= count; source !== 'featured' (FEATURED_SOURCE_DISABLED);
    entityType enabled (ENTITY_TYPE_NOT_ENABLED); (entityType, source) supported
    (SOURCE_NOT_SUPPORTED_FOR_ENTITY). See §4.6 */);
```

### 4.6 Tipos de entidad: preparados todos, habilitado uno (OQ-4)

Decisión del owner (2026-11-25): se sale sólo con alojamientos, pero el diseño queda listo
para comer y salir, notas, eventos, experiencias y partners. Sumar un tipo después no
pide migración ni cambios de contrato: es un resolver, una tarjeta y prender un flag.

- `NewsletterDynamicEntityTypeEnum` (nuevo, `packages/schemas/src/enums/`), subconjunto
  de `EntityTypeEnum` (`entity-type.enum.ts:40-54`): `ACCOMMODATION`, `VENUE`, `POST`,
  `EVENT`, `EXPERIENCE`, `PARTNER`. Es un enum propio y no `EntityTypeEnum` entero,
  para que `USER`, `PAYMENT` y compañía no sean seleccionables.
- `ENABLED_DYNAMIC_ENTITY_TYPES` (constante en `@repo/schemas`): en F1 vale
  `['ACCOMMODATION']`. El schema rechaza el resto con `ENTITY_TYPE_NOT_ENABLED`.
- `SOURCE_RESOLVERS` pasa a ser
  `Record<NewsletterDynamicEntityTypeEnum, Partial<Record<NewsletterDynamicSourceEnum, SourceResolver>>>`.
  Una fuente sin resolver para ese tipo es `SOURCE_NOT_SUPPORTED_FOR_ENTITY` (por ejemplo,
  `top_rated` sobre `POST`, que no tiene reseñas). En F1 sólo `ACCOMMODATION` tiene entradas.
- `CARD_LOADERS` y `CARD_COMPONENTS`: mismo patrón, `Record<NewsletterDynamicEntityTypeEnum, … | null>`,
  así que agregar un valor al enum sin decidir su tarjeta no compila.
- `params` queda `.strict()` por tipo: cuando se habilite otro tipo, sus parámetros
  propios (por ejemplo, rango de fechas futuras en `EVENT`) entran como unión
  discriminada por `entityType`, sin tocar los de `ACCOMMODATION`.
- Admin: el selector de tipo muestra los 6, con los no habilitados deshabilitados y la
  etiqueta "Próximamente". El selector de fuente se filtra por lo que el tipo soporta.
- Test de guarda: cada valor del enum tiene entrada (aunque sea `null`) en los tres
  registros, y todo tipo en `ENABLED_DYNAMIC_ENTITY_TYPES` tiene al menos una fuente y su
  tarjeta.

Decisiones que quedan para HOS-2642, una por tipo: qué significa
`newest` en un evento (próximos, no recién creados), qué fuentes tiene una nota o un
partner, y que `PARTNER` sólo puede listar gold (los silver no tienen página, HOS-294).

Nodo TipTap: `{ type: 'dynamicBlock', attrs: { blockKey, config?: string } }`, sólo de
nivel raíz, atómico. En campañas `config` va serializado como JSON string, porque
`TiptapNode.attrs` es `Record<string, string | number>` (`packages/utils/src/tiptap-renderer.ts:34`).
En cuerpos de plantilla va sólo `blockKey`. Los defaults los aplica `applyDynamicBlockDefaults()`.

Resolver (RO-RO, `packages/service-core/src/services/newsletter/dynamic/`):

```ts
/** Data access the resolver needs. Real impl reads Drizzle; tests inject fakes. */
export interface DynamicSourcePort {
    fetchCandidates(input: { readonly block: DynamicBlockConfig; readonly now: Date;
        readonly excludeIds: readonly string[]; readonly limit: number }): Promise<readonly string[]>;
    revalidate(input: { readonly block: DynamicBlockConfig; readonly ids: readonly string[];
        readonly now: Date }): Promise<{ readonly validIds: readonly string[]; readonly dropped: readonly DroppedItem[] }>;
    loadCards(input: { readonly ids: readonly string[]; readonly locales: readonly Locale[] })
        : Promise<ReadonlyMap<string, LocalizedCard>>;
}

export interface ResolveBlocksInput {
    readonly blocks: readonly DynamicBlockConfig[];
    readonly phase: 'generate' | 'send';
    readonly now: Date;
    readonly history: readonly BlockHistoryEntry[];          // last sent run_items per blockKey (F2)
    readonly current?: ReadonlyMap<string, CurrentBlockState>; // draft items + manuallyEdited flag (F3)
    readonly locales: readonly Locale[];
    readonly port: DynamicSourcePort;
}

export interface ResolveBlocksOutput {
    readonly decision: 'send' | 'skip_run';
    readonly blocks: readonly ResolvedBlock[];   // { blockKey, itemIds, repeats, hidden, cards }
    readonly report: ResolutionReport;           // per block: candidates, dropped, repeatsUsed, belowMin, action
}

export async function resolveBlocks(input: ResolveBlocksInput): Promise<ResolveBlocksOutput>;
```

Reglas: orden determinístico (desempate por `id`), dedup, después `fillWithRepeats`
(menos recientemente mostrado primero), revalidación y por último `minItems`/`ifBelowMin`.
Con `manuallyEdited`, la fase `send` sólo quita inválidos y no rellena (D-1).

Render: `renderNewsletterEmail({ doc, resolvedBlocks, locale })` parte el documento en
cada `dynamicBlock` de raíz. Los segmentos TipTap siguen por `renderTiptapEmailContent`
(`packages/notifications/src/utils/tiptap-email-renderer.ts:185`, con `sanitizeEmailHtml`
de `:120` intacto) y cada bloque se renderiza con `DynamicBlockCards`, que nunca recibe
HTML de usuario. `NewsletterCampaign` acepta `segments` además de `bodyHtml`
(retrocompatible). El preview del admin muestra en un iframe con `sandbox` el HTML
renderizado por la API, en lugar de `renderTiptapContent` (`CampaignPreview.tsx`).

## 5. Archivos a tocar

| Archivo | Cambio |
|---|---|
| `packages/schemas/src/enums/newsletter-dynamic-source.enum.ts` | nuevo |
| `packages/schemas/src/enums/newsletter-if-below-min.enum.ts` | nuevo |
| `packages/schemas/src/enums/index.ts` | export |
| `packages/schemas/src/entities/newsletter/newsletter-dynamic-block.schema.ts` | nuevo |
| `packages/schemas/src/entities/newsletter/newsletter-campaign.schema.ts` | `resolvedBodyJson`, `resolvedAt` opcionales (aditivo) |
| `packages/schemas/src/entities/newsletter/newsletter-campaign.http.schema.ts` | schema de `resolve-preview` |
| `packages/schemas/src/entities/newsletter/index.ts` | export |
| `packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts` | columnas `resolved_body_json`, `resolved_at` |
| `packages/db/src/migrations/NNNN_*.sql` | generado por `db:generate` |
| `packages/utils/src/tiptap-renderer.ts` | tipo `TiptapNode.attrs` admite `boolean`; nada más cambia |
| `packages/service-core/src/services/newsletter/dynamic/` | nuevo: `resolve-blocks.ts`, `dynamic-source.port.ts`, `drizzle-dynamic-source.ts`, `sources/*`, `defaults.ts`, `segments.ts` |
| `packages/service-core/src/services/newsletter/newsletter-campaign.service.ts` | `send()` y `testSend()` delegan en `dynamic/` (sin crecer el archivo; ya pasa de 500 líneas) |
| `packages/service-core/src/services/newsletter/newsletter-delivery.service.ts` | render por segmentos en `processBatch` (`:657`), `sendTestEmailFromContent` junto a `sendTestEmail` (`:959`), fallo ante bloque sin resolver |
| `packages/service-core/src/services/newsletter/index.ts` | exports |
| `packages/notifications/src/templates/newsletter/dynamic-block-cards.tsx` | nuevo, sobre `@repo/email` |
| `packages/notifications/src/templates/newsletter/index.ts` | export |
| `packages/notifications/src/templates/newsletter/newsletter-campaign.tsx` | prop `segments` opcional |
| `packages/notifications/src/utils/` | `render-newsletter-email.ts` nuevo |
| `apps/api/src/services/newsletter/delivery-factory.ts` | inyecta el render por segmentos y el port real; `buildCampaignReactElementFn` (`:189`) también para `sendTestEmailFromContent` |
| `apps/api/src/routes/newsletter/admin/campaigns.ts` | ruta `resolve-preview`; mapeo de `DYNAMIC_BLOCK_BELOW_MIN` a 422 |
| `apps/api/src/routes/newsletter/admin/dynamic-sources.ts` | nuevo, `GET /dynamic-sources` |
| `apps/api/src/routes/newsletter/admin/index.ts` | registrar rutas |
| `apps/admin/src/components/newsletter/RichTextEditor.tsx` | extensión `dynamicBlock` en `NEWSLETTER_EDITOR_EXTENSIONS` |
| `apps/admin/src/components/newsletter/dynamic-block/` | nuevo: extensión, nodo React, panel de config |
| `apps/admin/src/routes/_authed/newsletter/campaigns/-components/CampaignPreview.tsx` | iframe sandbox con HTML de la API |
| `apps/admin/src/routes/_authed/newsletter/campaigns/-components/SendConfirmDialog.tsx` | muestra el reporte de resolución y el 422 |
| `packages/i18n/src/locales/{es,en,pt}/` | textos del panel y de la tarjeta (CTA "Ver alojamiento") |

## 6. Criterios de aceptación

- **AC-F1-1 Insertar bloque.** Dado un admin con `newsletter.campaign.write` en el editor, cuando inserta un bloque `newest` con `count: 4`, entonces el documento guardado tiene un nodo `dynamicBlock` de raíz cuyo `attrs.config` valida contra `DynamicBlockConfigSchema` con `minItems: 1` e `ifBelowMin: 'skip_run'`.
- **AC-F1-2 Default de ifBelowMin con dos bloques.** Dado un documento con un bloque, cuando se inserta un segundo sin tocar `ifBelowMin`, entonces ambos quedan en `hide_block`.
- **AC-F1-3 featured rechazado.** Dado un config con `source: 'featured'`, cuando se valida, entonces falla con el código `FEATURED_SOURCE_DISABLED`, y `GET /dynamic-sources` lo devuelve con `enabled: false`.
- **AC-F1-4 most_viewed.** Dado A con 10 vistas en los últimos 7 días, B con 5 y C con 20 vistas de hace 40 días, cuando se resuelve `most_viewed` con `windowDays: 30, count: 2`, entonces los ítems son `[A, B]`.
- **AC-F1-5 Desempate determinístico.** Dados dos alojamientos con el mismo puntaje, cuando se resuelve dos veces, entonces el orden es idéntico y lo decide `id` ascendente.
- **AC-F1-6 top_rated con mínimo de reseñas.** Dado X con `average_rating 5.00, reviews_count 2` e Y con `4.50, 10`, cuando se resuelve `top_rated` con `minReviews: 3`, entonces X no aparece e Y sí.
- **AC-F1-7 Revalidación quita y rellena.** Dado un preview que mostró `[A, B, C]` y que A pasó a `UNPUBLISHED_BY_BILLING`, cuando se ejecuta `send()`, entonces el contenido enviado es `[B, C, D]` y el reporte lista A en `dropped` con motivo `not_published`.
- **AC-F1-8 Revalidación bajo el mínimo con skip_run.** Dado un único bloque con `minItems: 3`, `ifBelowMin: 'skip_run'` y sólo 2 elegibles, cuando se llama `send()`, entonces responde 422 `DYNAMIC_BLOCK_BELOW_MIN`, no se inserta ninguna entrega y la campaña sigue `draft`.
- **AC-F1-9 hide_block.** Dado un segundo bloque con `hide_block` que resuelve 0 ítems, cuando se envía, entonces el email no contiene ese bloque y sí el resto del cuerpo.
- **AC-F1-10 Contenido idéntico entre lotes.** Dada una campaña con bloque dinámico y 250 suscriptores con `batchSize 100`, cuando se procesan los 3 lotes y entre el lote 1 y el 3 se despublica un ítem, entonces los 3 lotes renderizan el mismo `resolved_body_json`.
- **AC-F1-11 Bloque sin resolver no sale vacío.** Dada una campaña `sending` con `dynamicBlock` y `resolved_body_json` null, cuando el worker procesa el lote, entonces las entregas quedan `failed` con `DYNAMIC_BLOCK_UNRESOLVED` y no se llama al transporte.
- **AC-F1-12 Preview sin escrituras.** Dado un borrador, cuando se llama `POST /campaigns/{id}/resolve-preview`, entonces la respuesta trae HTML y reporte, y `resolved_body_json` sigue null.
- **AC-F1-13 testSend con bloques.** Dado un borrador con bloque, cuando se usa "Enviar prueba", entonces el email de prueba contiene las tarjetas resueltas en ese momento y la campaña no cambia.
- **AC-F1-14 Fallback de idioma en tarjeta.** Dado un alojamiento con `name_i18n.en` vacío, cuando se renderiza en `en`, entonces la tarjeta usa el nombre `es`.
- **AC-F1-15 Saneado intacto.** Dado un párrafo TipTap con `<script>` y un link `javascript:`, cuando se renderiza un documento con bloque dinámico, entonces el HTML no contiene ni `script` ni `javascript:` (el bloque no abre una vía alrededor de `sanitizeEmailHtml`).
- **AC-F1-16 Campañas viejas.** Dada una campaña sin bloques dinámicos, cuando se envía, entonces el HTML es byte a byte el mismo que antes de F1.

## 7. Plan de tests

| Nivel | Suite | Qué |
|---|---|---|
| Unit | `packages/schemas/test/entities/newsletter/newsletter-dynamic-block.schema.test.ts` (nuevo) | AC-F1-1..3, límites |
| Unit | `packages/service-core/test/services/newsletter/dynamic/resolve-blocks.test.ts` (nuevo) | AC-F1-5, 7, 8, 9 con port fake |
| Unit | `packages/service-core/test/services/newsletter/newsletter-campaign.service.test.ts` | `send()` escribe `resolved_body_json`, 422 bajo mínimo |
| Unit | `packages/service-core/test/services/newsletter/newsletter-delivery.service.test.ts` | AC-F1-10, 11, 16 |
| Unit | `packages/notifications/test/utils/tiptap-email-renderer.test.ts`, `packages/notifications/test/templates/newsletter.templates.test.tsx` | segmentos, AC-F1-15 |
| Unit | `packages/utils/test/tiptap-renderer.test.ts` | el renderer base no cambia de comportamiento |
| Integración | `packages/service-core/test/integration/services/newsletter-dynamic-sources.integration.test.ts` (nuevo) | AC-F1-4, 6, 14 contra Postgres real; exigir conteo de tests > 0 |
| API | `apps/api/test/routes/newsletter/admin-campaign-actions.test.ts` | 422 y `resolve-preview`; asertar `mock.calls` del servicio, no sólo el status |
| Admin | `apps/admin/src/components/newsletter/RichTextEditor.test.tsx`, `RichTextEditor.v3-roundtrip.test.ts` | el nodo sobrevive el roundtrip JSON |

Mutaciones mínimas a verificar a mano: quitar el filtro `publication_status` del
predicado compartido (debe romper AC-F1-7), quitar el desempate por `id` (AC-F1-5),
volver a resolver dentro de `processBatch` (AC-F1-10).

## 8. Guards

- Guard estático nuevo `packages/service-core/test/services/newsletter/dynamic/source-predicate.guard.test.ts`: cada resolver y `revalidate` pasan por `eligibleAccommodationPredicate()`; un predicado inline falla.
- `scripts/check-catalog-key-usage` y `check-commercial-values`: no aplican (no hay claves de catálogo ni precios).
- `safeIlike`: no se usa LIKE.
- `pnpm check:no-coerce-boolean`: los params nuevos usan `createBooleanQueryParam` si hiciera falta.
- Biome `useExhaustiveDependencies` en el nodo React del editor.

## 9. Smoke

No lleva `status-needs-smoke-*`: no toca proveedor, cron ni tiempos reales. Recomendado
igual en local: una campaña con bloque `most_viewed` enviada a una lista de prueba.

## 10. Tareas (orden de implementación)

1. **T-F1-01** Enums `NewsletterDynamicSourceEnum`, `NewsletterIfBelowMinEnum` + tests. (1h)
2. **T-F1-02** `DynamicBlockConfigSchema` + `applyDynamicBlockDefaults()` + tests AC-F1-1..3. (2h)
3. **T-F1-03** Columnas `resolved_body_json`, `resolved_at` + `db:generate` + schema Zod aditivo. (1h)
4. **T-F1-04** `DynamicSourcePort`, `eligibleAccommodationPredicate()` y guard estático. (1.5h)
5. **T-F1-05** Resolver `newest` + test de integración. (1.5h)
6. **T-F1-06** Resolver `most_viewed` + test de integración AC-F1-4. (2h)
7. **T-F1-07** Resolver `top_rated` + test de integración AC-F1-6. (1.5h)
8. **T-F1-08** `resolveBlocks()` con revalidación, `minItems`, `ifBelowMin` + unit AC-F1-5, 7, 8, 9. (2h)
9. **T-F1-09** `loadCards()` con fallback i18n + test AC-F1-14. (1.5h)
10. **T-F1-10** Componente `DynamicBlockCards` + `renderNewsletterEmail` por segmentos + tests AC-F1-15, 16. (2h)
11. **T-F1-11** `send()` resuelve y persiste; `processBatch` usa `resolved_body_json`; fallo `DYNAMIC_BLOCK_UNRESOLVED` + tests AC-F1-10, 11. (2h)
12. **T-F1-12** `sendTestEmailFromContent`; `testSend` delega + test AC-F1-13. (1h)
13. **T-F1-13** Rutas `resolve-preview` y `dynamic-sources` + tests de ruta. (1.5h)
14. **T-F1-14** Extensión TipTap `dynamicBlock` + roundtrip test. (2h)
15. **T-F1-15** Panel de config del bloque (TanStack Form + `safeParse`) + test de componente AC-F1-2. (2h)
16. **T-F1-16** Preview en iframe y reporte en `SendConfirmDialog` + i18n. (1.5h)
