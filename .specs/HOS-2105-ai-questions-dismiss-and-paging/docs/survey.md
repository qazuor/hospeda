# Survey de código — HOS-2105 (descarte y paginación de «Preguntas a la IA»)

Levantamiento factual del código que este spec toma como base. Todo claim lleva `ruta:línea`
sobre este worktree. No propone diseño: eso está en `../spec.md`.

## 1. Mapa del feature (HOS-2101, ya mergeado)

### 1.1 La pestaña en `apps/web`

| Pieza | Archivo | Detalle |
|---|---|---|
| Isla React compartida | `apps/web/src/components/listing/ai-questions/AiQuestionsPanel.client.tsx` | Fetch en cliente con la cookie del owner (`AiQuestionsPanel.client.tsx:91-94`); endpoint en la constante `AI_LISTING_QUESTIONS_PATH` (`:32`). La página es session-blind a propósito (`:10-12`) |
| CSS Module | `apps/web/src/components/listing/ai-questions/AiQuestionsPanel.module.css` | Colocado junto al componente |
| Página del editor de alojamiento | `apps/web/src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/preguntas-ia.astro` | Monta la isla en `:48-54`; arma `faqUrl` con la sección `preguntas` (`:33-36`) |
| Página del editor de comercio | `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/preguntas-ia.astro` | Monta la isla en `:45-51`; `faqUrl` en `:30-33` |
| Registro de secciones (alojamiento) | `apps/web/src/lib/editor/accommodation-editor-sections.ts:152-157` | `ACCOMMODATION_AI_QUESTIONS_SECTION`, slug `preguntas-ia`, deliberadamente FUERA de la lista congelada del catálogo (`:146-151`); se inserta después de FAQs en el registry (`:160-167`) |
| Registro de secciones (venue/experience) | `apps/web/src/lib/editor/listing-editor-registry.ts:81-86` | `LISTING_AI_QUESTIONS_SECTION`, se agrega al final del grupo content (`:69-72`) |

La isla separa los bloques en cliente con `splitAiQuestions` (`AiQuestionsPanel.client.tsx:63-71`): `answerStatus === 'unanswered'` va a «Sin responder», el resto a «Otras preguntas». El contador se renderiza en `:238` (`data.unansweredCount`), el aviso `truncated` en `:265-273`, y el atajo «Agregar como pregunta frecuente» en `:210-219` (solo ítems sin responder, y solo si `faqUrl !== ''`). Las respuestas del bot se muestran como HTML sanitizado vía `renderChatMarkdown` (`:24` y `:198`, importada de `apps/web/src/lib/ai-search/render-chat-markdown.ts:100`).

### 1.2 Ruta API (tier protected)

- `GET /api/v1/protected/ai/listing-questions?entityType=&entityId=` — `apps/api/src/routes/ai/protected/listing-questions.ts:33-58`. Fábrica `createProtectedRoute` (`:33`), query `AiListingQuestionsQuerySchema.shape` (`:42`), rate limit propio 60 req/min (`:56`). Monte en `apps/api/src/routes/ai/protected/index.ts:45`.
- Orden de rechazos declarado en el propio archivo (`listing-questions.ts:6-9`): 401 sin sesión (gate del tier) → 400 query malformada (Zod, antes de leer DB) → 404 para ficha inexistente, borrada o ajena.

### 1.3 Servicio

**No está en `service-core`.** Es un módulo de funciones de `apps/api`:
`apps/api/src/services/ai-listing-questions.service.ts`. Funciones:

- `isListingOwnedBy` (`:72-83`): existe + no borrada + `ownerId === userId`, con la tabla elegida por vertical (`listingTableFor`, `:44-51`).
- `retentionCutoff` (`:91-95`): ahora menos `AI_LISTING_QUESTIONS_RETENTION_MONTHS` meses.
- Caps del panel: `AI_LISTING_QUESTIONS_UNANSWERED_CAP = 100` (`:102`) y `AI_LISTING_QUESTIONS_OTHERS_CAP = MAX_ITEMS - 100 = 100` (`:105-106`, con `AI_LISTING_QUESTIONS_MAX_ITEMS = 200` en `packages/schemas/src/entities/ai/ai-listing-questions.schema.ts:40`).
- `readQuestionBlock` (`:185-243`): una sola query por bloque. Empareja cada pregunta (fila `role='user'`) con la respuesta más temprana (`role='assistant'`, misma conversación, `created_at >= pregunta`, no borrada) por LATERAL (`:195-211`). Filtro de bloque: `answer.answerStatus = 'unanswered'` para sin responder, `is distinct from 'unanswered'` para el resto (`:213-215`). `blockTotal` es `count(*) over ()` calculado antes del LIMIT (`:225`), orden `desc(question.createdAt)` (`:241`).
- `listListingQuestions` (`:256-274`): corre ambos bloques en paralelo y arma la respuesta con `toListingQuestionsResponse` (`:152-166`): `total = unansweredCount + otros` (`:157`), `truncated = total > items.length` (`:165`).

No hay modelo ni clase `BaseModel`: acceso directo a Drizzle con `getDb()` y las tablas `aiMessages` / `aiConversations`.

### 1.4 DB (`packages/db`)

- `ai_messages`: `packages/db/src/schemas/ai/ai_messages.dbschema.ts`. Columnas relevantes: `conversationId` FK cascade (`:36-38`), `role` varchar `system|user|assistant` (`:45`), `content` text verbatim (`:53`), `answerStatus` varchar nullable (`:71-77`), `createdAt` timestamptz (`:80`), `deletedAt` (`:84`).
- `ai_conversations`: `packages/db/src/schemas/ai/ai_conversations.dbschema.ts`. Referencia estructurada de ficha `listingEntityType` varchar(20) (`:76`) + `listingEntityId` uuid (`:79`), ambas nullable, sin FK (polimórfica sobre tres tablas, `:71-74`).
- Quién escribe esas columnas: `persistConversationTurn` (`apps/api/src/services/ai-chat-persistence.ts:185-321`) inserta SIEMPRE un par por request — una fila `user` (`:263-272`) y una `assistant` (`:294-307`) — y escribe `listingEntityType`/`listingEntityId` en el primer turno (`:227-228`). `persistChatTurn` (`:384-404`) fija `feature='chat'` para las tres verticales. `resolveReusableConversationId` (`:133-165`) evita colgar turnos de una conversación ajena o de otra ficha.

### 1.5 Schemas (`packages/schemas`)

`packages/schemas/src/entities/ai/ai-listing-questions.schema.ts`:

- `AiAnswerStatusSchema = ['answered','unanswered']` (`:21`), `AiListingQuestionStatusSchema` agrega `unclassified` (`:31`).
- `AI_LISTING_QUESTIONS_RETENTION_MONTHS = 12` (`:37`), `AI_LISTING_QUESTIONS_MAX_ITEMS = 200` (`:40`).
- `AiListingQuestionsQuerySchema` (`:45-52`): `entityType` + `entityId` uuid, `.strict()`.
- `AiListingQuestionSchema` (`:62-75`): `id` (uuid de la fila user), `question`, `answer`, `askedAt`, `answerStatus`, `.strict()`.
- `AiListingQuestionsResponseSchema` (`:83-97`): `items`, `total` (`:91`), `unansweredCount` (`:93`), `truncated` (`:95`), `.strict()`.
- `AiChatEntityTypeSchema = ['accommodation','venue','experience']` (`packages/schemas/src/entities/ai/ai-chat.schema.ts:125`).

### 1.6 i18n

- Claves del panel: `host.properties.editor.aiQuestions.*` en `packages/i18n/src/locales/es/host.json:719-731` (también en `en/` y `pt/`): `intro`, `loading`, `error`, `notOwner`, `empty`, `answerLabel`, `addAsFaq`, `unansweredTitle`, `unansweredHint`, `othersTitle`, `truncated` (con `{{shown}}`/`{{total}}`, `:730`).
- Etiqueta de la pestaña: `host.properties.editor.section.aiQuestions` (`es/host.json:288`) y `listing.owner.editor.sectionNav.aiQuestions` (`es/listing.json:104`).
- La isla usa las claves `host.*` para AMBOS editores (el componente es compartido; `AiQuestionsPanel.client.tsx:112-271`).

## 2. Qué es una «pregunta»

- **Definición**: fila de `ai_messages` con `role='user'`, no borrada, cuya conversación tiene `listingEntityType`/`listingEntityId` = la ficha y `createdAt >= cutoff` de 12 meses (`readQuestionBlock`, `ai-listing-questions.service.ts:230-240`; cutoff en `:91-95` con la constante `ai-listing-questions.schema.ts:37`).
- **Respuesta emparejada**: la fila `assistant` más temprana de la misma conversación con `created_at >= pregunta` (LATERAL, `:195-211`). Una pregunta cuya fila de respuesta falta se descarta del listado (JSDoc del módulo, `:17-20`).
- **Respondida / sin responder**: lo decide el clasificador asíncrono `apps/api/src/services/ai-chat-answer-classifier.ts`, que escribe `ai_messages.answer_status` de la fila assistant (`:5-7` del JSDoc; prompt fijo `:73-80`; feature de metering propia `chat_answer_classifier` que no quema cuota, `:55`). `NULL` = sin clasificar, nunca se lee como veredicto (`toQuestionStatus`, `ai-listing-questions.service.ts:127-134`).
- **Horizonte de 12 meses**: filtro `gte(question.createdAt, cutoff)` (`:237`) + borrado físico diario por el cron `ai-listing-questions-retention` (`45 3 * * *`, `apps/api/src/cron/schedules.manifest.ts:254`; servicio `apps/api/src/services/ai-listing-questions-retention.ts:68-107`, borra mensajes viejos de chat en tandas de 1000 (`:20`) y después conversaciones quedadas sin mensajes; job en `apps/api/src/cron/jobs/ai-listing-questions-retention.job.ts`).
- **Caps**: bloque «Sin responder» ≤ 100 (`:102`), «Otras» ≤ 100 (`:105-106`), total 200 (`ai-listing-questions.schema.ts:40`). Si hay más, `truncated: true` (`:165`) y la web muestra un aviso sin forma de ver el resto (`AiQuestionsPanel.client.tsx:265-273`).

## 3. `unansweredCount`

- **Cálculo**: `count(*) over ()` del bloque sin responder (window count previo al LIMIT), leído de la primera fila (`ai-listing-questions.service.ts:137-140` y `:225`), expuesto por `toListingQuestionsResponse` (`:156`). Es el número EXACTO de sin responder dentro del horizonte, no el tamaño del bloque.
- **Dónde se muestra**: contador junto al título «Sin responder» (`AiQuestionsPanel.client.tsx:238`) y en el digest semanal: `digest.totalUnanswered` por owner y `listing.unansweredCount` por ficha (`apps/api/src/cron/jobs/ai-questions-weekly-digest.job.ts:140-148`; agrupado en `groupDigestRows`, `apps/api/src/services/ai-questions-digest.helpers.ts:56-90`, contador en `:76`).

## 4. Digest semanal `ai-questions-weekly-digest`

- **Job**: `apps/api/src/cron/jobs/ai-questions-weekly-digest.job.ts` (nombre `:181`, schedule `0 9 * * 1` `:184`, declarado en `apps/api/src/cron/schedules.manifest.ts:262` y `apps/api/docs/cron-system.md:925`). Ventana de 7 días (`DIGEST_WINDOW_DAYS`, `apps/api/src/services/ai-questions-digest.helpers.ts:15`), idempotencia por `notification_log` con key `ai-questions-digest:<userId>:<weekKey>` (`ai-questions-weekly-digest.job.ts:65-84` y `:126`).
- **Query** (`readVerticalRows`, `apps/api/src/services/ai-questions-digest.selection.ts:46-96`): filas `assistant` con `answerStatus='unanswered'`, no borradas, dentro de `[windowStart, windowEnd)` (`:84-88`), conversación con listing de la vertical y no borrada (`:89-90`), ficha existente y no borrada (`:91`). El texto de la pregunta sale de un LATERAL que trae la última fila `user` anterior o igual a la respuesta (`:55-68`).
- **Qué tendría que excluir**: la decisión del owner es que el digest excluya las descartadas. Como el descarte va a vivir en la fila `user` (la pregunta), el LATERAL de `:55-68` debe exponer `owner_dismissed_at` y la query externa filtrar las parejas cuya pregunta esté descartada — filtrar DENTRO del LATERAL sería un bug: traería una pregunta anterior no descartada como texto de la misma respuesta. Las tres verticales se recorren en `readDigestRows` (`:104-113`).
- Plantilla del mail: `packages/notifications/src/templates/ai/ai-questions-weekly-digest.tsx` (exportada en `packages/notifications/src/templates/ai/index.ts:1`); tests en `packages/notifications/test/templates/ai-questions-weekly-digest.templates.test.tsx`.

## 5. Flujo «Agregar como pregunta frecuente» hoy

1. **Viaje del prefill**: la pestaña arma el link con `buildFaqPrefillHref({ faqUrl, question })` (`apps/web/src/hooks/use-faq-prefill.ts:45-52`): `?pregunta=<texto urlencoded>`, recortado a 300 (`FAQ_PREFILL_MAX_LENGTH`, `:23` — coincide con el max de la pregunta de FAQ). El link solo se arma para ítems sin responder y con `faqUrl` no vacío (`AiQuestionsPanel.client.tsx:210-219`).
2. **Recepción**: `useFaqPrefill` (`use-faq-prefill.ts:60-73`) lee el parámetro en un effect, abre el formulario de alta y borra el parámetro de la URL (`:70-72`). Lo llaman ambos editores: `apps/web/src/components/host/editor/FaqSection.client.tsx:152-157` (alojamiento) y `apps/web/src/components/listing/ListingFaqManager.client.tsx:241-246` (venue/experience). **Solo precarga la pregunta; la respuesta llega vacía.**
3. **Guardado**:
   - Alojamiento: `POST /api/v1/protected/accommodations/{id}/faqs` (`apps/api/src/routes/accommodation/protected/addFaq.ts:28-60`), gate de ownership del factory `listingAccess: { vertical: ACCOMMODATION, operation: 'EDIT', idParam: 'id' }` (`:33`), servicio `accommodationService.addFaq` (`:52`).
   - Venue/experience: `POST /api/v1/protected/{venues|experiences}/{id}/faqs` (basePath armado en `ListingFaqManager.client.tsx:183` y usado en `:267-276` con `postProtected`).
   - Payload: `FaqWithChannelVisibilityCreatePayloadSchema` (`packages/schemas/src/common/faq.schema.ts:137-140`): `question` (10–300, `:19-24`), `answer` (10–2000, `:26-31` — ¡min 10!: vacío NO valida), `category` opcional (`:48-54`), flags opcionales.
4. **¿El guardado sabe qué mensaje lo originó?** NO. El payload no lleva ningún id de mensaje (`faq.schema.ts:118-122`); el vínculo entre «Preguntas a la IA» y la FAQ creada hoy no existe en ningún lado.

## 6. Chequeo de ownership y verticales cubiertas

- **Lectura del panel**: `isListingOwnedBy` manual (`ai-listing-questions.service.ts:72-83`) y la ruta responde `ServiceError(NOT_FOUND)` (`listing-questions.ts:48-51`). Ajena = 404, nunca 403, con el motivo documentado en el propio archivo (`:8-9`) y en `apps/api/docs/error-contract.md:46` («Resource exists but belongs to somebody else → 404»).
- **Guardado de FAQ**: gate estándar `listingAccess` del factory (`accommodation/protected/addFaq.ts:33`), que corre dentro de `resolveListingAccess` (paso 4 resource/ownership). También 404 para ajena (contrato, `error-contract.md:69-77`).
- **Verticales**: accommodation, venue y experience (`AiChatEntityTypeSchema`, `ai-chat.schema.ts:125`; los tres registros de editor montan la pestaña; el digest itera las tres, `ai-questions-digest.selection.ts:108`). No hay chat en partner ni tourist.

## 7. Índices existentes en `ai_messages` (relevantes para paginar por `created_at`)

Declarados en `packages/db/src/schemas/ai/ai_messages.dbschema.ts`:

- `aiMessages_conversationId_created_idx (conversation_id, created_at)` (`:92-95`) — lectura primaria por conversación.
- `aiMessages_conversationId_role_idx (conversation_id, role)` (`:101-104`).
- `aiMessages_answerStatus_created_idx (answer_status, created_at)` (`:109-112`), agregada por HOS-2101 (migración `packages/db/src/migrations/0198_hos_2101_ai_listing_questions.sql`) para el digest.

En `ai_conversations`: `aiConversations_listing_idx (listing_entity_type, listing_entity_id)` (`ai_conversations.dbschema.ts:94-97`) — el punto de entrada de ambas queries del panel y del digest.

**No hay ningún índice que lidere por `ai_messages.created_at` solo.** El acceso siempre va ficha → conversaciones → mensajes por conversación. Un cursor `question.created_at < cursor` es un WHERE más sobre la misma query de bloque (`:230-242`); sirve el mismo plan de índices. Cualquier índice nuevo sería una optimización, no un requisito de corrección.

## 8. Helper de strip de markdown: YA EXISTE

- **Web**: `stripMarkdownPlain` en `apps/web/src/lib/render-plain.ts:106-122`, con el set canónico `STRIP_MARKDOWN_REGEX_SET` (`:73-86`). Es el espejo declarado de la fuente de verdad `stripMarkdown` de `apps/api/src/utils/entitlement-filter.ts:296` (regla PD-1, `render-plain.ts:15-19` y `:88-96`). Tests que lo fijan: `apps/web/test/lib/render-plain.test.ts` y `apps/api/test/utils/entitlement-filter-strip.test.ts`.
- Para MOSTRAR respuestas con formato ya está `renderChatMarkdown` (markdown → HTML sanitizado con DOMPurify, `apps/web/src/lib/ai-search/render-chat-markdown.ts:100`), que la pestaña usa hoy (`AiQuestionsPanel.client.tsx:198`).

Conclusión factual: para el prefill de respuesta «sin markdown» NO hay que inventar nada — corresponde reutilizar `stripMarkdownPlain` (lado web). No existe ningún helper equivalente en `@repo/schemas` ni en `service-core`; si algún día se necesita server-side, la fuente de verdad sigue siendo `entitlement-filter.ts`.

## 9. Guards y tests que este cambio toca (o no)

| Guard / test | Qué mira | Impacto para HOS-2105 |
|---|---|---|
| `apps/api/test/utils/error-contract.guard.test.ts` | Seis aserciones estáticas sobre las rutas; una ruta nueva fuera del contrato falla | La ruta de descarte debe respetar 401 → 400 → 404 y no construir 403 |
| `apps/api/test/middlewares/ownership.contract.test.ts` + patrón de `apps/api/test/routes/existence-disclosure.paired-probe.test.ts` | Compara cuerpo completo de ajena vs inexistente (`expect(foreign).toEqual(missing)`) | La regresión 404 de ficha ajena debe testearse así, no por status |
| `apps/api/test/routes/protected-get-write-permission.guard.test.ts:6-7` | Cuenta congelada de rutas GET protected (`EXPECTED_GET_PROTECTED_COUNT = 101`) | Las rutas nuevas son POST: no mueven el número; el comentario de congelamiento igual hay que dejarlo consistente si se agregan archivos GET |
| `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` | Toda página de `src/pages` session-blind | No se tocan páginas (solo islas); cualquier cambio futuro de shell debe seguir ciego a sesión |
| `scripts/check-i18n-key-coverage.ts` (`check:i18n-keys`, `package.json:59`) | Toda clave literal usada en código debe existir en los locales; `pnpm --filter @repo/i18n check-locales` exige paridad es/en/pt | Las claves nuevas del panel y del formulario FAQ deben existir en las tres locales |
| `scripts/check-seed-migration-schema-probe.sh` (`check:seed-migration-schema-probe`) | Sonda de esquema para data-migrations de seed | No aplica: ningún fixture de seed escribe `ai_messages`/`ai_conversations` (búsqueda vacía sobre `packages/seed/src`) y la columna nueva es nullable |
| `check:catalog-sql`, `check:catalog-key-usage`, `check:vertical-axis-items`, `check:accommodation-editor-frozen`, `check:no-listing-dispatch` (todos en `package.json:59`) | Catálogo de claves / secciones congeladas / sin dispatch por id de sección | No aplica: la pestaña ya vive fuera del catálogo (`accommodation-editor-sections.ts:146-151`, `listing-editor-registry.ts:76-80`) y no se agregan secciones |
| `scripts/check-api-calls-registered.ts` (`check:api-calls-registered`) + `apps/api/test/route-manifest/route-manifest.test.ts` | Rutas literales del cliente web vs `apps/api/route-manifest.json` | Las dos llamadas POST nuevas del panel deben figurar en el manifest (regenerar con `UPDATE_ROUTE_MANIFEST=1`; hoy el GET está en `apps/api/route-manifest.json:2434`) |
| Retención | (no es guard, es comportamiento) | Las descartadas siguen dentro del horizonte: el cron las borra igual (`ai-listing-questions-retention.ts:68-107` no conoce el descarte) — el «Deshacer» tiene tope de 12 meses por diseño |

## 10. Otras observaciones útiles para el diseño

- Los schemas del panel son `.strict()` en los tres niveles (`ai-listing-questions.schema.ts:52,75,97`): agregar campos es seguro (aditivo), cambiar semántica de `total`/`unansweredCount` es una decisión de contrato que hay que declarar.
- La política de compatibilidad de `@repo/schemas` es solo-aditiva (`packages/schemas/CLAUDE.md`, «Schema Compatibility Policy»): nunca renombrar, nunca quitar, nunca apretar.
- La query de la pestaña es idéntica en forma a la del digest (par pregunta↔respuesta por LATERAL) pero en dirección inversa: la pestaña parte de la fila `user` y busca la respuesta; el digest parte de la fila `assistant` y busca la pregunta. Un descarte grabado en la fila `user` alcanza para ambas — ver `spec.md`.
- La respuesta de FAQ tiene `min(10)` (`faq.schema.ts:26-31`): un prefill de respuesta vacío o muy corto no pasaría validación; el texto de ayuda del formulario es la salida natural cuando el bot no respondió.
- El aviso `truncated` actual usa `total` (`AiQuestionsPanel.client.tsx:265-273`); si las descartadas dejan de contar en `total`, la frase del aviso sigue siendo coherente («mostradas X de Y» sobre las activas).
- El botón de la pestaña navega a la sección FAQ (`faqUrl` = `.../editar/preguntas/` en ambos editores, construido con `findEditorSectionBySlug({ slug: 'preguntas' })`, `preguntas-ia.astro:33-36` y `:30-33`).

## 11. Borrador de respuesta con IA — relevamiento factual (OQ-1)

Nota de numeración: la instrucción original pedía «§10», pero la §10 de este survey
ya existía (otras observaciones) y el spec la cita en R-1 (§8, Riesgos); esta
sección sume entonces como **§11**. Levantamiento para el diseño del borrador
on-demand del owner. Facts only, con `ruta:línea`.

### 11.1 La plataforma `packages/ai-core`

**Cómo se construye y se llama un feature:**

- Fábrica pública: `createAiService(input)` (`packages/ai-core/src/engine/ai-service.ts:337`), con `getProvider(providerId)` obligatorio y opcionales `recordEvent`, `moderationProviderId`, `checkCeiling`, `defaultLocale` (`:88-172`). `AiService` expone `generateText` (`:211`), `streamText` (`:238`), `generateObject<T>(request, outputSchema: ZodType<T>)` (`:252-255`) y `moderate` (`:283`). `generateText` devuelve `{ text, usage, provider, model, finishReason }` (`packages/schemas/src/entities/ai/ai-capability.schema.ts:218-240`).
- Wiring real en API: `createConfiguredAiService()` (`apps/api/src/services/ai-service.factory.ts:157`) — instancia NUEVA por request (`:21-27`), desencripta credenciales del vault a un Map (`:163-190`), y cablea `recordEvent` (`:240`), `checkCeiling` (`:242-243`) y `moderationProviderId` desde `ai_settings.moderation` (`:203-204, 251`).
- Flujo del engine por llamado (`packages/ai-core/src/engine/engine.ts:653-717`): resolver config del feature (`:654`) → kill-switch (`:656-659`) → cost ceiling (`:664-666`) → moderación de input (`:670-677`) → `system` caller-wins si el caller lo provee (`:679-687`) → modelo inyectado de la config del feature si el caller no pasó `model` (`:690-692`) →cadena de providers con retry/fallback (`:696-704`) → moderación de output (`:707-714`).
- Contrato por llamado: `feature: AiFeature`, `locale`, `prompt | messages` (excluyentes), `system`, `model`, `params { temperature, maxTokens, topP }`, todo `.strict()` (`packages/schemas/src/entities/ai/ai-capability.schema.ts:73-95, 160-206`); los params están en `packages/schemas/src/entities/ai/ai-provider.schema.ts:119-135` (decisión YAGNI 2026-06-04: solo esos tres, `:114-117`).
- `generateObject` sobre OpenAI usa structured outputs nativos en modo estricto por defecto; SOLO los features con schemas con campos opcionales entran en la excepción `FEATURES_WITHOUT_STRICT_JSON_SCHEMA = {'search','accommodation_import'}` (`packages/ai-core/src/providers/vercel-openai.adapter.ts:101-104, 369-423`).
- Retry: 2 intentos por provider con delay lineal 200 ms, retryable = 429/5xx/timeout (`packages/ai-core/src/engine/retry.ts:57, 66, 125-171`); los adapters fijan `maxRetries: 0` — el engine es la única autoridad de retry. **No existe knob de timeout por-llamado** en ai-core (ni en schemas de request ni en adapters).
- Idioma: `detectMessageLanguage` devuelve `es | en | pt | null` — `null` si el texto es muy corto o mixto (`packages/ai-core/src/language/reply-language.ts:215-268, 261-267`); `REPLY_LANGUAGE_INSTRUCTIONS` trae la línea por idioma que ordena traducir hasta los valores de la ficha («pileta» → «pool») (`:283-287`); `appendReplyLanguageInstruction` agrega esa línea al FINAL del system message y NO lo altera cuando no puede decidir (`:325-334`).

**Moderación y seguridad:**

- El engine es el chokepoint de moderación: input ANTES del provider y output DESPUÉS (`engine.ts:668-677, 707-714`; `packages/ai-core/src/engine/moderation-pass.ts:148-212`). Es opt-in por config (sin `moderationProviderId`, el pass se salta sin error, `:151-154`); bloquea con `AiModerationBlockedError`; falla ABIERTO ante errores transitorios del moderador (`:202-210`) y CERRADO si el provider de moderación está configurado pero sin credencial (`:198-200`). No hay opt-out por-request (nada equivalente en `ai-capability.schema.ts:160-206`).
- `guardPromptInjection` (`packages/ai-core/src/safety/injection-guard.ts:314`) existe pero es DETECCIÓN-ONLY (las frases se reportan, no se sacan, `:10-13`) con severidades `none | low | high` (`:65`) y sanitización de zero-width/control chars + truncado a `DEFAULT_MAX_INPUT_LENGTH = 10_000` (`:38`). **NO está cableado en ninguna ruta de producción** — el único uso es `packages/ai-core/test/safety.test.ts`.
- `scrubPii` para telemetría (`packages/ai-core/src/safety/pii-scrubber.ts:258`).

**Selección de modelo y costo:**

- El modelo se elige POR FEATURE, nunca por código: `ai_settings.features.<feature>` trae `{ enabled, primaryProvider, fallbackChain, model, params }` (`packages/schemas/src/entities/ai/ai-settings.schema.ts:81-107`); el resolver lanza `AiFeatureNotConfiguredError` si falta la entry (`packages/ai-core/src/config/resolver.ts:255-267`). Los features válidos son los de `AiFeatureSchema` (`packages/schemas/src/entities/ai/ai-provider.schema.ts:78-88`).
- Agregar un miembro al `AiFeatureSchema` es compile-breaking: `DEFAULT_PROMPTS` y `DEFAULT_RULES` están tipados `Readonly<Record<AiFeature, string>>` — entrada faltante = error de compilación (`packages/ai-core/src/engine/default-prompts.ts:12-15, 66`).
- `MODEL_RATES` solo tiene `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022` (`packages/ai-core/src/usage/model-rates.ts:33-50`); un modelo desconocido registra costo 0 con `rated: false` y un warning una vez por proceso (`packages/ai-core/src/usage/cost-calculator.ts:93-108`; `packages/ai-core/src/usage/usage-recorder.ts:86-88`). Overrides por `ai_settings.modelRates` (`packages/schemas/src/entities/ai/ai-settings.schema.ts:291`).

### 11.2 Metering y cuotas

- El ENGINE nunca escribe `ai_usage`; la ruta es responsable (JSDoc de `apps/api/src/utils/ai-usage-metering.ts:8-12`: escribir la fila `error` cuando no se entregó nada, si no la cuota queda congelada o cobra por nada). Wrapper non-throwing `meterAiUsage` (`:139`) con `METERING_TIMEOUT_MS = 1500` (`:59`).
- `recordAiUsage` (`packages/ai-core/src/usage/usage-recorder.ts:108`) → append-only en `ai_usage` y `ai_request_log` (`packages/ai-core/src/storage/usage.storage.ts:4, 93-118, 177-198`).
- Conteo de cuota: `countAiUsageForUserFeatureMonth` (`packages/ai-core/src/storage/usage.queries.ts:412-463`) filtra SIEMPRE por `feature` (`:421`) y por `status IN ('success','fallback')` (`QUOTA_COUNT_STATUSES`, `packages/ai-core/src/usage/reporting/monthly-call-count.ts:44`), ventana mes calendario UTC (`:90-92`). Según `keyedBy`: `'user'` cuenta `user_id = X`; `'consumer'` cuenta `consumer_user_id = X OR (consumer_user_id IS NULL AND user_id = X)` — el brazo OR-NULL es el backfill del cutover HOS-2095, documentado in situ (`usage.queries.ts:423-437`).
- Gate normalizado: `evaluateAiQuota` / `enforceAiQuota` (`apps/api/src/utils/listing-access/ai-quota-gate.ts:33-89, 92-160`) — sin entitlement lanza `ENTITLEMENT_REQUIRED` (`:122-128`); con límite agotado escribe una fila `quota_exceeded` y lanza `ServiceError(LIMIT_REACHED, { limitKey, currentCount, maxAllowed })` (`:130-143, 155-159`). HTTP: `LIMIT_REACHED` y `ENTITLEMENT_REQUIRED` → 403 (`apps/api/src/middlewares/response.ts:43-44`).
- Cost ceiling siempre activo (defaults si no hay blob: global USD 100; chat 45 / search 30 / text_improve 15 / support 10 — `packages/ai-core/src/usage/model-rates.ts:93-114`), chequeado dentro del engine antes del provider (`engine.ts:664-666`; `packages/ai-core/src/usage/ceiling.ts:238-341`).

### 11.3 El clasificador de respuestas — el precedente de feature-auxiliar barato

- Módulo: `apps/api/src/services/ai-chat-answer-classifier.ts`. JSDoc (`:2-7`): tras persistir el turno, un llamado barato decide si la respuesta respondió; el veredicto cae en `ai_messages.answer_status` de la fila ASSISTANT (escritura en `:189-196`).
- Input: `assistantMessageId`, `question`, `answer`, `feature` (el del chat de la vertical), `locale` (`:142-156`). NO toca la conversación ni más tablas.
- Prompt: system fijo en inglés `CHAT_ANSWER_CLASSIFIER_SYSTEM` (`:73-80`), user prompt `Question: ${clip(question)}\nReply: ${clip(answer)}` con clip a 1200 (`:44-45, 208-212, 236`).
- Llamado: `generateText({ feature, locale, system, prompt, params: { maxTokens: 16, temperature: 0 } })` (`:232-238`); `maxTokens: 16` porque el piso de la Responses API es 16 (`:57-66`). El modelo NO se pasa: lo inyecta la config del feature del chat (`engine.ts:690-692`).
- Veredicto: `ANSWERED | UNANSWERED` parseado estricto; salida no parseable deja la fila `unclassified` (`:104-118, 262-271`).
- Metering: label `chat_answer_classifier` DELIBERADAMENTE NO-AiFeature con `userId: null` (`:48-55, 170-182`) — entra al cost ceiling y dashboards pero NO a ninguna cuota (los conteos filtran por feature y por usuario). Un ceiling hit deja el turno sin clasificar (`:23-24, 230-231`).
- Trigger: `scheduleChatAnswerClassification` (`:297-299`), detached, llamado SOLO desde `apps/api/src/routes/ai/protected/chat.finalize.ts:135-141` dentro del `.then` de persistencia.

### 11.4 El chat de la ficha (de donde saldría el contexto del borrador)

- Ruta `POST /api/v1/protected/ai/chat` (`apps/api/src/routes/ai/protected/chat.ts:117`, montada por `apps/api/src/routes/ai/protected/index.ts:42`): orquestación inline en la ruta — target (158-184) → gates de cuota owner + consumer (194-217) → secciones por vertical (219-236) → system prompt + assembler (252-263) → `streamText` (279-285).
- Input del visitante: `content` ≤ 500 chars, ≤ 20 mensajes, `.strict()` (`packages/schemas/src/entities/ai/ai-chat.schema.ts:75, 106, 189, 207`). La pregunta viaja al modelo VERBATIM (`toEngineMessages`, `apps/api/src/routes/ai/protected/chat.helpers.ts:103-115`, mapeo 1:1 en `:113`) y igual a la DB (`apps/api/src/services/ai-chat-persistence.ts:354` JSDoc, filas en `:263-272`). **Nada sanitiza la pregunta del visitante hoy**: ni `guardPromptInjection` (unwired, §11.1), ni quoting; la única defensa en runtime es la moderación de input del engine (`engine.ts:668-677`) y las reglas del prompt (`packages/ai-core/src/engine/listing-chat-rules.ts:29, 31, 32, 36, 64-65` — sin contactos no-verbátim, declinar off-topic/override, «lo que tu contexto no cubre, decilo»).
- Contexto por vertical: registry exhaustivo `CHAT_CONTEXT_ASSEMBLERS` (`apps/api/src/services/ai-context/index.ts:52-56`) y features por vertical `{ accommodation: 'chat', venue: 'chat_venue', experience: 'chat_experience' }` (`:70-75`). Cada assembler lee la ficha/FAQs/amenities/datos duenos con caps por bloque y emite un bloque Markdown; venue/experience esperan `resolveListingSections` (accommodation devuelve Map vacío, `chat.ts:229-230`).
- El system message se arma con `buildChatSystemMessage(contextBlock, resolvedPrompt, locale)` (`apps/api/src/services/ai-context/owner-data-fence.ts:266-281`): contextBlock + `---` + resolvedPrompt + `CHAT_LANGUAGE_RULE` (`:291-294`, «respondé en el idioma del último mensaje del visitante… traducí los datos de la ficha») + línea de locale fallback. El texto dueno va FENCEADO con directivas inert-data (`:36-37, 56-67`), sanitizado para que no pueda forjar el cierre (`:92-97`), y `truncateAtWord` recorta por palabra (`:150-161`).
- `resolveSystemPrompt({ feature })` lee `ai_prompt_versions` (admin) y cae a los defaults de código (`packages/ai-core/src/config/prompt-resolver.ts:198-251`).
- `maxTokens` del chat: `resolveChatMaxOutputTokens(FEATURE)` (`chat.ts:270`), que lee la config admin o `DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 1024` (`chat.helpers.ts:23, 34-45`). Sin temperature.
- Metering del chat: UNA fila por request con `userId: ownerId` + `consumerUserId: actorId` (`apps/api/src/routes/ai/protected/chat.finalize.ts:96-109`); `status 'success'` solo con texto no vacío (`:61-77`; `apps/api/src/routes/ai/protected/chat.usage-status.ts:27-33`).

### 11.5 La cuota mensual del visitante (confirmación pedida)

- Key: `max_ai_chat_consumer_per_month` (`packages/schemas/src/catalog/key-enums.ts:80`; fila `['max_ai_chat_consumer_per_month', 'vertical', 'SUM', 'DISABLE', 'COMMERCIAL']` en `packages/schemas/src/catalog/limit-keys.ts:28`).
- El valor 10 vive en el floor de Tourist: `TOURIST_FLOOR_EXCEPTION` con entitlement `ai_chat { planQuota: 10, trialQuota: 10 }` y limit `{ key: 'max_ai_chat_consumer_per_month', value: 10 }` (`packages/service-core/src/services/plan-catalog/plan-publication.rejections.ts:60-73`, `:64` para el entitlement y `:71` para el limit); la validación de publicación rechaza cualquier otro valor para esa key (`packages/service-core/test/services/plan-catalog/plan-publication.floor-exception.validation.test.ts:263, 279`).
- Check: `enforceAiQuota({ userId: actor.id, ..., feature: <feature del chat de la vertical>, limitKey: 'max_ai_chat_consumer_per_month', countKeyedBy: 'consumer', usageAttribution: { userId: ownerId, consumerUserId: actor.id } })` (`apps/api/src/routes/ai/protected/chat.ts:205-217`). La cuota es del ACTOR autenticado (no hay cookie ni sesión anónima: el chat es tier protected), por mes UTC, y el conteo filtra por el feature del chat.
- Agotada: 403 `LIMIT_REACHED` (`apps/api/src/middlewares/response.ts:43`) con mensaje del consumidor `accommodations.aiChat.consumerLimitReached` (`chat.ts:210`).
- **Corolario mecánico para el borrador del owner**: todo conteo de cuota filtra por `feature` (`usage.queries.ts:421`). Una fila con `feature: 'faq_draft'` y `userId: <ownerId>` NO entra en ningún conteo de chat — ni el consumer del visitante (que además matchea por `consumer_user_id`, `usage.queries.ts:431-437`) ni el owner de `max_ai_chat_per_month`. La única cuota que puede tocar es la de su propio feature. Confirmado en código, no por convención.

### 11.6 Features AI del lado owner — el patrón a reusar

- **text-improve** (el patrón mínimo y más parecido): `POST /api/v1/protected/ai/text-improve` (`apps/api/src/routes/ai/protected/text-improve.ts:125-162`, montado por `index.ts:39`). Gate: vertical derivada del `entityType` (`:150-155`) + `enforceAiQuota({ userId: actor.id, vertical, feature: FEATURE, entitlementKey: 'ai_text_improve', limitKey: 'max_ai_text_improve_per_month' })` (`:156-162`). Rate limit burst compartido `createAiRateLimitMiddlewares(FEATURE)` (`:135-137`; factory en `apps/api/src/middlewares/ai-rate-limit.ts`, defaults 20 req/min por usuario y 60/min por IP, `:41-68, 74-80`). Metering `meterAiUsage` con error branch (`:237-252, 264-274`). UI: `AiTextImprovePanel.client.tsx:140-316` (botón `:215`, loading `:228-241`, done con aceptar/descartar `:261-283`, error `:286-311`), montado dentro de `<PlanEntitlementGate entitlementKey="ai_text_improve" fallback={null}>` (`apps/web/src/components/host/editor/BasicInfoSection.client.tsx:222-226, 354-358`) — sin entitlement el botón ni se renderiza. Hook: `apps/web/src/hooks/useAiTextImprove.ts` (`TEXT_IMPROVE_PATH` `:121`, códigos de error `:65-78` incluyendo `ENTITLEMENT_REQUIRED`/`LIMIT_REACHED`, SSE `:341-353`, mapping de errores a i18n `:119-125` y `:378-399`). i18n EN: `packages/i18n/src/locales/en/host.json:498-521`.
- **translate**: `POST /api/v1/protected/ai/translate` con el mismo gate (`apps/api/src/routes/ai/protected/translate.ts:181-186`, `FEATURE = 'translate'` en `:38`, mount `index.ts:51`).
- **accommodation import** (variante con degradación amable): gate non-throwing + aviso dentro del 200 (`apps/api/src/routes/accommodation/protected/import-from-url.ts:340-360`; avisos `MSG_AI_ENTITLEMENT`/`MSG_AI_QUOTA` en `import-from-url.ai.ts:171-176, 211-220`).
- **Toast de billing compartido**: `apps/web/src/lib/billing-limit-error.ts` arma el toast desde `error.details` con `billing.limit.<limitKey>.title|message_one|message_other|cta` y fallback al genérico (`:188-245, 212-238`); las 9 keys AI están en `KNOWN_LIMIT_KEYS` con partials title-only (`:65-112, 77-101`).
- Patrón compilado para una key nueva (facts): (1) fila en `limit-keys.ts` + miembro en `key-enums.ts`, (2) si hay feature nuevo, mappings en `apps/api/src/utils/listing-access/ai-quota-catalog.ts:4-25`, (3) `pnpm gen:catalog-sql` pegado en una migración NUEVA + grants en `scripts/production-catalog/catalog.ts`, (4) i18n `billing.limit.<key>.*` en es/en/pt + alta en `KNOWN_LIMIT_KEYS`, (5) `enforceAiQuota` + `meterAiUsage` en la ruta.

### 11.7 Catálogo: claves, G3 y G18

- Row del catálogo: `KeyRow = [key, scope, aggregation, enforcement, class]` (`packages/schemas/src/catalog/key-row.ts:10-17`, expandido `:27-37`); tipos en `packages/schemas/src/catalog/key-attributes.ts` (`KeyKind :9-11`, `KeyScope :18-20`, `AggregationStrategy :34-36`, `EnforcementStrategy :47-49`, `KeyClass :62-64`, regex del key `:74-83`). El scope `'vertical'` es user+vertical, NO por ficha (`:13-17`). El período NO es atributo: «per month» va en el nombre del key y el runtime usa mes UTC (`monthly-call-count.ts:90-92`).
- Enums con nombres SCREAMING_SNAKE → strings snake_case: `EntitlementKeyEnum` (`key-enums.ts:50-55`) y `LimitKeyEnum` (`:64-87`). Claves AI vigentes: limits `max_ai_text_improve_per_month` … `max_ai_accommodation_import_per_month`, todos `vertical/SUM/DISABLE/COMMERCIAL` (`limit-keys.ts:26-34`); entitlements `ai_text_improve` … `ai_accommodation_import`, todos `vertical/MAX/NONE/COMMERCIAL` (`entitlement-keys.ts:61-66`).
- **G3 (code→catálogo)**, `scripts/check-catalog-key-usage.ts:2-10`: toda clave usada en código de producción (miembros de `EntitlementKeyEnum`/`LimitKeyEnum` o literales dentro de `getCatalogKey`/`isCatalogKey`, `:14-23`) debe existir en el catálogo de `packages/schemas/src/catalog`. La dirección inversa la cubre la FK de las tablas de asignación a `catalog_key`.
- **G18 (catálogo→SQL)**, `scripts/check-catalog-sql.ts:2-9`: las filas que escriben las migraciones deben ser byte-idénticas a las que genera el código; el predicado compara los INSERT acumulativos por load (`:12-27`) y falla con cualquier shape no plegable (`:29-35`). Regeneración: `pnpm gen:catalog-sql` y pegar en una migración NUEVA, nunca en una aplicada (`scripts/generate-catalog-sql.ts:1-33`).
- Grants por plan: `scripts/production-catalog/catalog.ts:6-27` (`PlanCatalogDefinition.version.entitlements[]` y `.limits[]`, con `UNLIMITED_LIMIT_VALUE = 2147483647` en `:4`); ejemplo de filas por tier en `packages/db/src/migrations/0144_production_plan_catalog.sql:334, 348, 362` (import 10/50/250).
- G3 y G18 NO están en ningún CLAUDE.md (búsqueda repo-wide): viven en los docblocks de los scripts y en `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:52` (G3) y `:59` (G18).

### 11.8 Storage de metering y conclusiones factuales

- `ai_usage` (`packages/db/src/schemas/ai/ai_usage.dbschema.ts:36-111`): `userId` FK nullable ON DELETE SET NULL (`:42-46`), `consumerUserId` FK nullable (`:49-64`), `feature` varchar(50) (`:66-70`), tokens in/out, `costEstimateMicroUsd` entero (`:85-97`), `status` `success|error|fallback|quota_exceeded|ceiling_hit|kill_switch` (`:102-107`); append-only, solo `createdAt` (`:30-34, 109-110`). Índices `(userId, feature, createdAt desc)` (`:117-121`), `(consumerUserId, feature, createdAt desc)` (`:127-129`), `(provider, feature, createdAt desc)` (`:135-139`). Una sola tabla backea el límite owner (keyedBy user) y la cuota del visitante (keyedBy consumer).
- `maxTokens` tiene piso técnico de la Responses API: 16 (`OPENAI_MIN_OUTPUT_TOKENS`, `ai-chat-answer-classifier.ts:66`) — irrelevante para un draft de 1024 pero citado para el inventario de límites.
- Riesgo de cuota cruzada descartado: ver corolario mecánico de §11.5. Y el truco del clasificador (`userId: null` + label no-AiFeature, §11.3) NO sirve para el borrador: con `userId: null` su propio límite mensual jamás dispararía, porque el conteo es `user_id` + feature.
- Helpers server-side existentes reutilizables: `stripMarkdown` (fuente de verdad API, `apps/api/src/utils/entitlement-filter.ts:296`), `truncateAtWord` (`owner-data-fence.ts:150-161`), `guardPromptInjection` (`injection-guard.ts:314`). En web, `stripMarkdownPlain` (`apps/web/src/lib/render-plain.ts:106-122`) ya cubre el prefill (§8).

### 11.9 Qué NO existe (y dónde viviría)

- No existe ningún endpoint de borrador/generación para el owner asociado a preguntas (solo text-improve, translate e import). Viviría junto a los POST de acción §5.3, en `apps/api/src/routes/ai/protected/`.
- No existe un feature AiFeature de FAQ/draft: habría que sumar el miembro a `AiFeatureSchema` (`ai-provider.schema.ts:78-88`), sus entries en `DEFAULT_PROMPTS`/`DEFAULT_RULES` (`default-prompts.ts`), el mapping en `ai-quota-catalog.ts` y la entry de `ai_settings` vía data-migration de seed (patrón `packages/seed/src/data-migrations/0101-hos-1220-*.ts:105,121`, cuyo fallback model es `gpt-4o-mini` en `:121`).
- No existe un `AiFaqDraftOutputSchema` ni schema de response del draft en `packages/schemas`; el lugar natural es `packages/schemas/src/entities/ai/` (hermano de `ai-chat.schema.ts`).
- No existe entrada per-feature de `faq_draft` en `DEFAULT_COST_CEILINGS` (`model-rates.ts:93-114`): sin sumarla, el feature queda cubierto SOLO por el techo global.
