---
title: Preguntas a la IA — descartar («Ya lo vi»), paginar, precargar respuesta y borrador con IA
linear: HOS-2105
statusSource: linear
created: 2026-11-10
type: feature
areas:
  - web
  - api
  - db
smokeGates:
  - status-needs-smoke-staging
---

# Preguntas a la IA — descartar («Ya lo vi»), paginar, precargar respuesta y borrador con IA

## 1. Contexto

HOS-2101 (mergeada) sumó la pestaña «Preguntas a la IA» en los editores de fichas:
el owner ve lo que los visitantes le preguntaron al chat de su ficha, con las sin
responder arriba, un contador, y el atajo «Agregar como pregunta frecuente» que
abre el formulario de FAQ con la pregunta precargada (`docs/survey.md` §1).

Hoy la pestaña tiene tres limaduras que el owner pidió cerrar:

1. **No se puede descartar.** Una pregunta sin responder que ya no interesa queda
   para siempre en «Sin responder», inflando el contador y el digest semanal.
2. **No hay «ver más».** La respuesta trae como máximo 200 preguntas (100 sin
   responder + 100 del resto, `docs/survey.md` §2). Si hay más, solo aparece el
   aviso `truncated` (`AiQuestionsPanel.client.tsx:265-273`) y no hay forma de ver
   el resto. Con 12 meses de retención, una ficha con movimiento llega al tope.
3. **La FAQ se escribe desde cero.** «Agregar como pregunta frecuente» precarga
   solo la pregunta (`use-faq-prefill.ts:60-73`); la respuesta del bot —que ya
   existe en la pantalla— no viaja.

El relevamiento factual del código está en [`docs/survey.md`](./docs/survey.md);
cada decisión de diseño de abajo cita lo que ese relevamiento encontró.

## 2. Objetivo

- Que el owner marque una pregunta sin responder como «Ya lo vi» y esa pregunta
  salga de «Sin responder», baje el contador y quede recuperable en una sección
  «Descartadas» colapsada con «Deshacer». Nada se borra.
- Que guardar la FAQ desde ese atajo descarte la pregunta sola.
- Que el contador y el digest semanal dejen de contar las descartadas.
- Que «Otras preguntas» se pagine por cursor de a 50 hasta el horizonte de 12 meses.
- Que el formulario de FAQ llegue con la pregunta y, si el bot respondió, con su
  respuesta sin markdown y editable.
- Que el owner pueda pedir un borrador de respuesta generado con IA a partir de
  los datos de su ficha cuando llega al formulario desde una pregunta que el
  bot no respondió con veredicto `answered`; el borrador es editable y nunca se
  guarda solo.

## 3. Alcance / Fuera de alcance

### Alcance

- Columna estructural `owner_dismissed_at` en `ai_messages` (migración aditiva).
- Tres rutas protected nuevas (descartar / deshacer / faq-draft) siguiendo el
  contrato de errores.
- Cursor pagination en «Otras preguntas», de a 50.
- Bloque «Descartadas» en el panel + respuestas nuevas aditivas del GET.
- Exclusión de descartadas en `unansweredCount`, `total` y en la query del digest.
- Prefill de la respuesta del bot en el formulario de FAQ (ambos editores).
- Claves i18n nuevas (es/en/pt) y actualización del route manifest.
- Endpoint protected nuevo `POST /api/v1/protected/ai/listing-questions/{messageId}/faq-draft` — borrador de respuesta on-demand con IA (§5.8).
- Nuevo `AiFeature` `faq_draft` con sus claves de catálogo (`ai_faq_draft`,
  `max_ai_faq_draft_per_month`), su entry de `ai_settings`, su presupuesto de
  costo y un código de dominio 409 nuevo.
- Botón «Sugerir respuesta con IA» en el formulario de FAQ (ambos editores) con
  estados de carga, error, límite y disclaimer de borrador.
- Claves i18n del borrador (es/en/pt) y partials `billing.limit.*`.

### Fuera de alcance

- Borrar preguntas (el descarte no elimina nada; la retención de 12 meses sigue
  siendo el único borrador, `docs/survey.md` §2 y §9).
- Mostrar quién preguntó (sigue siendo NG-1 de HOS-2101).
- Paginar «Sin responder» (decisión 8: el bloque conserva su cap de 100).
- Pre-generar borradores desacoplados tras la clasificación o guardarlos en una
  columna nueva (la antigua opción (c) de OQ-1): el borrador es solo on-demand
  (decisión 7).
- Cambios al clasificador, a `persistChatTurn`, a la retención o a la cuota del
  visitante y su floor de 10/mes (el borrador no toca nada de eso,
  `docs/survey.md` §11.5).

## 4. Decisiones del owner (cerradas, no se reabren)

Ítems 1–6 de la redacción original; ítems 7–10 respondidos por el owner el
2026-11-10 sobre las preguntas abiertas del §9 anterior.

1. «Ya lo vi» con sección «Descartadas» colapsada y «Deshacer». No se borra nada.
2. Guardar la FAQ desde «Agregar como pregunta frecuente» descarta la pregunta sola.
3. `unansweredCount` y el digest semanal (`ai-questions-weekly-digest`) excluyen
   las descartadas.
4. Paginación de «Otras preguntas» de a 50.
5. La respuesta del bot se precarga SOLO si el bot efectivamente respondió
   (`answer_status = 'answered'`). Si quedó sin responder, el campo llega vacío
   con texto de ayuda.
6. Se requiere migración estructural (`owner_dismissed_at`).
7. **OQ-1** — El borrador de respuesta con IA se hace ON DEMAND y DENTRO de este
   spec, no en un spec separado: un endpoint protected genera al pedido del
   owner desde el formulario FAQ, a partir de los datos de la ficha; el
   borrador es editable y nunca se guarda automáticamente.
8. **OQ-2** — «Sin responder» conserva el cap de 100, sin paginación.
9. **OQ-3** — El prefill viaja por URL (`respuesta` + `mensaje`), como está
   diseñado en §5.5.
10. **OQ-4** — «Descartadas» con cap 50.
11. **Límite del borrador** (2026-11-10) — claves propias del catálogo,
    `ai_faq_draft` + `max_ai_faq_draft_per_month`; no se reusa `ai_text_improve`.
12. **Modelo del borrador** (2026-11-10) — `gpt-5.4-mini` por defecto (el que menos
    inventa de los medidos en HOS-2095/2100), y este spec agrega a `MODEL_RATES`
    las tarifas de `gpt-5.4-nano` y `gpt-5.4-mini`. Hoy `MODEL_RATES`
    (`packages/ai-core/src/usage/model-rates.ts:33-50`) solo tiene `gpt-4o`,
    `gpt-4o-mini` y dos modelos de Claude, y un modelo sin tarifa registra costo
    0 con `rated: false` (`docs/survey.md` §11). Salvo que producción tenga un
    override en `ai_settings.modelRates` (verificar antes de implementar), el
    costo del chat con nano/mini tampoco se mide hoy: cargar las tarifas cierra
    ese hueco también.

## 5. Diseño

### 5.1 Datos + migración

- `ai_messages` gana `owner_dismissed_at timestamptz NULL` (Drizzle:
  `timestamp('owner_dismissed_at', { withTimezone: true })` en
  `packages/db/src/schemas/ai/ai_messages.dbschema.ts`, junto a `answerStatus:71-77`).
  `NULL` = pregunta activa; fecha = descartada en ese instante. Es aditiva y sin
  backfill (todo lo existente nace activa).
- **La columna vive en la fila `user`** (la pregunta): es el id que el panel ya
  expone como `items[].id` (`ai-listing-questions.schema.ts:64`) y alcanza para
  panel y digest porque ambas queries emparejan por esa fila (`docs/survey.md`
  §2 y §4).
- **Sin índice nuevo.** Las lecturas van ficha → `aiConversations_listing_idx` →
  mensajes por conversación (`docs/survey.md` §7); el digest sigue entrando por
  `aiMessages_answerStatus_created_idx`. Filtrar `owner_dismissed_at IS NULL`
  sobre ese plan no agrega un orden nuevo.
- Migración Drizzle-generated (siguiente número de
  `packages/db/src/migrations/`, hoy el último es `0198_hos_2101_ai_listing_questions.sql`;
  verificar contra PRs abiertos antes de mergear). Nada en `extras/`: es una
  columna declarable (`docs/survey.md` §9, carril 1).
- La retención no cambia: una descartada se borra igual a los 12 meses
  (`ai-listing-questions-retention.ts:68-107`), así que «Deshacer» tiene el mismo
  horizonte que la pestaña entera. Se documenta en la UI con el copy existente
  de retención, sin estado nuevo.

### 5.2 API — GET con paginación y descartadas

Sobre `GET /api/v1/protected/ai/listing-questions` (`docs/survey.md` §1.2):

- Query aditiva: `othersCursor` opcional, opaco para el cliente, que codifica el
  par `(askedAt, id)` del último ítem de «Otras» ya recibido (absent = primera
  página). **Tiene que ser compuesto**: con solo `askedAt`, dos preguntas
  guardadas en el mismo instante quedan una de cada lado del corte y «Ver más»
  saltea o duplica una. El schema es `.strict()`
  (`ai-listing-questions.schema.ts:45-52`), así que agregar el campo es la vía
  correcta; un cursor malformado es 400 por la misma validación de hoy.
- Tamaño de página: constante nueva `AI_LISTING_QUESTIONS_OTHERS_PAGE_SIZE = 50`
  junto a los caps de `ai-listing-questions.service.ts:102-106`. El cap de sin
  responder sigue en 100 y el `MAX_ITEMS = 200` de `ai-listing-questions.schema.ts:40`
  se recalcula como presupuesto de la primera página (100 + 50 + preview de
  descartadas 50), dejando el 200 como techo duro de un solo response.
- Respuesta aditiva (política solo-aditiva de `@repo/schemas`):
  - `othersNextCursor: string | null` — cursor para la próxima tanda de «Otras»;
    `null` cuando no hay más dentro del horizonte.
  - `dismissed: AiListingQuestion[]` — bloque de descartadas, más nuevas primero,
    cap `AI_LISTING_QUESTIONS_DISMISSED_CAP = 50` (mismo patrón de bloques
    acotados de hoy).
  - `dismissedCount: number` — exacto dentro del horizonte (window count, igual
    que `blockTotal` hoy, `ai-listing-questions.service.ts:225`).
- Semántica de los campos existentes (cambio de contrato declarado):
  - `total` pasa a contar SOLO preguntas activas (no descartadas) dentro del
    horizonte: sigue siendo `unansweredCount + tamaño del resto`, que es como ya
    se calcula (`ai-listing-questions.service.ts:157`).
  - `unansweredCount` excluye descartadas (decisión del owner, item 3).
  - `truncated` conserva su fórmula `total > items.length` (`:165`) y en la
    primera página sigue significando «hay más activas que las mostradas»; el
    signal de paginación es `othersNextCursor`.
- El bloque de descartadas lista descartadas de cualquier estado (sin responder
  o no): la sección es un historial de lo que el owner ya vio, y su cap 50 con
  contador exacto cubre el desborde con el mismo aviso de truncado.

### 5.3 API — rutas de descarte (contrato de errores)

Patrón action-POST (las rutas de acción de este repo evitan DELETE-con-body,
`apps/api/CLAUDE.md` «DELETE-body factory gotcha»):

- `POST /api/v1/protected/ai/listing-questions/{messageId}/dismiss`
- `POST /api/v1/protected/ai/listing-questions/{messageId}/undismiss`

Ambas con `createProtectedRoute`, sin body, monte en
`apps/api/src/routes/ai/protected/index.ts` junto al GET (`:45`). Orden de
rechazos según `apps/api/docs/error-contract.md:12-19`:

1. **401** sin sesión (gate del tier protected).
2. **400** `messageId` no es UUID (params → antes de leer DB, H-68).
3. **404** `NOT_FOUND` si el mensaje no existe, no es una fila `role='user'` no
   borrada de una conversación con ficha, o esa ficha está borrada o es ajena.
   **Nunca 403 para una ficha ajena**: misma razón que el GET de hoy
   (`listing-questions.ts:8-9`, `error-contract.md:46`). La prueba de los dos
   caminos se compara como cuerpo completo, no por status (HOS-600,
   `error-contract.md:259-263`).
- Idempotente al estilo de la fila 30 del contrato (`error-contract.md:697-699`):
  re-descartar responde 200 con el instante ya guardado y no reescribe nada;
  deshacer algo activo responde 200 con `null`. La respuesta de ambas es
  `{ messageId, ownerDismissedAt: string | null }`.
- Rate limit igual al GET (60/min, `listing-questions.ts:56`).

### 5.4 Servicio

Todo en el módulo existente `apps/api/src/services/ai-listing-questions.service.ts`
(**no** en `service-core` — el feature vive entero en `apps/api`,
`docs/survey.md` §1.3):

- `isQuestionOwnedBy({ messageId, userId })`: `ai_messages` (id, `role='user'`,
  `deletedAt IS NULL`) → `ai_conversations` (`listingEntityType`/`listingEntityId`
  no nulos, no borrada) → tabla de la vertical por `listingTableFor`
  (`:44-51`): existe, no borrada, `ownerId === userId`. Es la generalización de
  `isListingOwnedBy` (`:72-83`) que hoy parte del id de ficha y no del de mensaje.
- `dismissListingQuestion` / `undismissListingQuestion`: `UPDATE ai_messages SET
  owner_dismissed_at = now() / NULL` acotado por el chequeo anterior (una sola
  statement con el join en el WHERE evita la carrera entre chequear y escribir).
- `readQuestionBlock` (`:185-243`) gana dos parámetros:
  - `dismissed: boolean` — filtra `question.owner_dismissed_at IS NULL` (activas)
    o `IS NOT NULL` (descartadas).
  - `after?: { createdAt: Date; id: string }` — el cursor:
    `(question.createdAt, question.id) < (after.createdAt, after.id)` además del
    `gte(question.createdAt, cutoff)` existente (`:237`); mismo plan de índices
    (`docs/survey.md` §7). El orden pasa a `desc(question.createdAt), desc(question.id)`
    (hoy solo `desc(question.createdAt)`, `:241`) para que el desempate sea
    estable y coincida con el cursor.
- `listListingQuestions` (`:256-274`) arma tres bloques: sin responder (activas,
  cap 100), otras (activas, página de 50 con cursor) y descartadas (cap 50), y
  compone la respuesta con los campos de §5.2.

### 5.5 Web

`AiQuestionsPanel.client.tsx`:

- **«Ya lo vi»**: botón en cada ítem de «Sin responder» (línea con el atajo FAQ,
  `:210-219`). Al confirmar: `POST .../dismiss` con `postProtected`, la ítem sale
  del bloque con actualización optimista, el contador baja con el valor
  `dismissedCount`/refetch del propio response (el GET recalcula los contadores;
  el panel no los resta a mano). Error → toast con la clave nueva y estado
  previo restaurado.
- **«Descartadas»**: nueva `<section>` colapsada (abierta/cerrada por estado del
  componente; por defecto cerrada cuando hay preguntas activas, abierta si es lo
  único que hay) con contador `dismissedCount`, lista con pregunta, respuesta,
  fecha y botón «Deshacer» (`POST .../undismiss`, mismo manejo de error). El
  ítem vuelve a su bloque según su `answerStatus` original, que la sección
  conserva.
- **«Ver más»** en «Otras preguntas»: al final del bloque, botón que repite el
  GET con `othersCursor = othersNextCursor` y agrega los ítems recibidos; se
  oculta cuando el cursor viene `null`. El aviso `truncated` (`:265-273`) queda
  solo para la primera página, donde sigue siendo cierto.
- **Flujo FAQ + descarte automático**: `buildFaqPrefillHref`
  (`use-faq-prefill.ts:45-52`) pasa a llevar, además de `pregunta`:
  - `respuesta` — SOLO cuando `answerStatus === 'answered'` (decisión del owner,
    item 5): el texto es `stripMarkdownPlain(item.answer)` — helper existente,
    `docs/survey.md` §8 — recortado al max de FAQ 2000 (`faq.schema.ts:26-31`).
    Si quedó sin responder (o `unclassified`, donde no se sabe si respondió), no
    viaja parámetro y el formulario muestra el texto de ayuda.
  - `mensaje` — el uuid de la pregunta, para el descarte automático.
- `useFaqPrefill` (`use-faq-prefill.ts:60-73`) se extiende: lee y sanea los tres
  parámetros (uuid validado para `mensaje`), los borra de la URL como hoy hace
  con `pregunta` (`:70-72`), y expone el par al callback. Ambos editores
  (`FaqSection.client.tsx:152-157` y `ListingFaqManager.client.tsx:241-246`)
  guardan el `mensaje` en estado del alta; después de un guardado exitoso llaman
  `POST .../dismiss` de forma best-effort: si falla, la pregunta queda activa y
  el owner la puede descartar a mano (se registra con el logger del cliente,
  sin bloquear el éxito de la FAQ).
- La página sigue session-blind: todo esto es código de isla, ninguna página de
  `src/pages` cambia (`docs/survey.md` §9).
- Cuando el prefill llega con `mensaje` y sin `respuesta` (pregunta sin
  veredicto `answered`), el formulario muestra además el botón del borrador con
  IA (§5.8).

### 5.6 Digest semanal

`readVerticalRows` (`apps/api/src/services/ai-questions-digest.selection.ts:46-96`):
el LATERAL de la pregunta (`:55-68`) pasa a exponer `owner_dismissed_at` y la
query externa agrega `question.owner_dismissed_at IS NULL` (la exclusión va en
el WHERE externo, NUNCA dentro del LATERAL: filtrar adentro haría que una
respuesta cuenta con el texto de una pregunta anterior no descartada,
`docs/survey.md` §4). El resto del job no cambia: ventana, opt-out
(`acceptsDigest`, `ai-questions-digest.helpers.ts:101-118`), idempotencia y
link (`buildPanelUrl`, `:142-154`) quedan igual.

### 5.7 i18n

Claves nuevas bajo `host.properties.editor.aiQuestions.*` (el panel usa ese
namespace para ambos editores, `docs/survey.md` §1.6) en es/en/pt — con
`check:i18n-keys` exigiendo que existan las tres (`docs/survey.md` §9):
`markSeen` («Ya lo vi»), `undo` («Deshacer»), `dismissedTitle` («Descartadas»),
`dismissedError`, `undoError`, `viewMore` («Ver más»), `faqAnswerHelp` (texto de
ayuda del campo respuesta vacío en el formulario FAQ). El texto de ayuda del
formulario vive en el namespace que ya usan los editores FAQ de cada vertical.
Todas las cadenas nuevas pasan por `t()`; sin literales.

El borrador de IA (§5.8) agrega claves en el namespace de los editores FAQ de
cada vertical: `suggestAiAnswer` («Sugerir respuesta con IA»), `aiDraftLoading`,
`aiDraftDisclaimer` (aviso de borrador editable), `aiDraftError` y
`aiDraftNotEligible` (surface del 409). El toast de límite usa las partials
title-only `billing.limit.max_ai_faq_draft_per_month` en
`packages/i18n/src/locales/{es,en,pt}/billing.json` + alta en `KNOWN_LIMIT_KEYS`
(`apps/web/src/lib/billing-limit-error.ts:65-112` y `:188-245`),
`docs/survey.md` §11.6.

### 5.8 Borrador de respuesta con IA (on demand, decisión 7)

El owner llega al formulario FAQ desde el atajo de una pregunta que el bot no
respondió con veredicto `answered` y puede pedir un borrador generado con IA a
partir de los datos de la ficha. El resultado llena el textarea de respuesta
(editable); **nunca se guarda automáticamente**: el guardado sigue siendo el
submit del formulario y el descarte el flujo de §5.5. La única persistencia del
llamado es la fila de metering.

#### 5.8.1 Elegibilidad (quién ve el botón)

- El botón «Sugerir respuesta con IA» aparece en el formulario de FAQ (ambos
  editores) SOLO cuando el prefill trajo `mensaje` y NO trajo `respuesta`
  (§5.5): es la marca de llegada desde el atajo con una pregunta sin veredicto
  `answered`. Quedan habilitados `unanswered` y `unclassified`: en ambos el
  veredicto del bot no es confiable
  (`toQuestionStatus` trata `NULL` como `unclassified`,
  `ai-listing-questions.service.ts:127-134`), que es exactamente la premisa del
  borrador, y el borrador NO reusa la respuesta del bot: la regenera desde la
  ficha, así que es más segura que precargarla. Con `answered` no se ofrece:
  la decisión 5 ya precarga esa respuesta y regenerarla es costo sin valor.
- La autorización no la decide el rol: sin el entitlement `ai_faq_draft` del
  plan, el botón ni se renderiza (`PlanEntitlementGate`, patrón de
  `BasicInfoSection.client.tsx:222-226 y 354-358`), y el endpoint igual remata
  en 403 (defensa en profundidad, §5.8.4).

#### 5.8.2 Endpoint

`POST /api/v1/protected/ai/listing-questions/{messageId}/faq-draft` — mismo
patrón action-POST de §5.3 (`apps/api/CLAUDE.md` «DELETE-body factory gotcha»),
sin body, montado en `apps/api/src/routes/ai/protected/index.ts` junto al GET y
a dismiss/undismiss. Rate limit burst con `createAiRateLimitMiddlewares` —
defaults 20 req/min por usuario y 60/min por IP
(`apps/api/src/middlewares/ai-rate-limit.ts:41-68`), la factory compartida de
las rutas IA (`text-improve.ts:135-137`).

Orden de rechazos (extiende el contrato de §5.3):

1. **401** sin sesión (gate del tier protected).
2. **400** `messageId` no-UUID (params → antes de leer DB, H-68).
3. **404** `NOT_FOUND` — el mismo lookup y cuerpo que dismiss/undismiss vía
   `isQuestionOwnedBy` (§5.4): ajena e inexistente son byte-idénticas, nunca
   403.
4. **409** `FAQ_DRAFT_NOT_ELIGIBLE` (código de dominio nuevo) cuando la fila
   assistant emparejada (el mismo LATERAL de `readQuestionBlock`,
   `ai-listing-questions.service.ts:195-211`) tiene
   `answer_status = 'answered'`. La familia de códigos de dominio 409/422 por
   estado del recurso ya existe
   (`packages/schemas/src/enums/service-error-code.enum.ts:108-155`, rationale
   en `:88-97`); su mapping se agrega en `ERROR_CODE_TO_HTTP`
   (`apps/api/src/middlewares/response.ts:30-59`).
5. **403** `ENTITLEMENT_REQUIRED` / `LIMIT_REACHED` del gate de cuota
   (§5.8.4), último paso antes del llamado al modelo.

Response 200: `{ messageId, hasData, draft }` con `draft: string | null`;
`hasData: false` llega SIEMPRE con `draft: null` (el schema lo obliga) y la UI
responde con el texto de ayuda (§5.8.5). Schemas en
`packages/schemas/src/entities/ai/ai-faq-draft.schema.ts`: `AiFaqDraftOutputSchema`
(para el modelo) y `AiFaqDraftResponseSchema` (HTTP, `.strict()`, con refine
`draft null ⇔ hasData false`), siguiendo la política aditiva de `@repo/schemas`.

#### 5.8.3 Contrato de prompt y generación

El servicio vive en un módulo propio hermano del clasificador:
`apps/api/src/services/ai-faq-draft.service.ts` (misma separación que
`ai-chat-answer-classifier.ts`; re importa `isQuestionOwnedBy` de
`ai-listing-questions.service.ts`).

- **Contexto**: el MISMO assembler por vertical que usa el chat
  (`CHAT_CONTEXT_ASSEMBLERS`, `apps/api/src/services/ai-context/index.ts:52-56`),
  con los fences de datos del owner (`owner-data-fence.ts:36-37 y 56-67`). El
  borrador ve la misma verdad que el bot; venue/experience necesitan
  `resolveListingSections` igual que hoy (`chat.ts:229-236`), y la vertical sale
  del `listingEntityType` de la conversación, no del request.
- **System caller-wins fijo** (precedente `CHAT_ANSWER_CLASSIFIER_SYSTEM`,
  `ai-chat-answer-classifier.ts:73-80`): constante de código que NO pasa por
  `resolveSystemPrompt` — el contrato de grounding no se delega al admin (el
  modelo sí sigue administrable, §5.8.4). El tipado exhaustivo igual exige
  entries en `DEFAULT_PROMPTS`/`DEFAULT_RULES` al agregar el feature
  (`packages/ai-core/src/engine/default-prompts.ts:12-15 y 66`). Contenido
  mínimo: responder SOLO con el contexto de la ficha; si el dato pedido no
  está, `hasData: false` sin construir nada; texto plano sin markdown; largo
  objetivo ≤ 2000 chars (max de la respuesta de FAQ, `faq.schema.ts:26-31`);
  sin contactos que no estén verbatim en el contexto (espejo de
  `listing-chat-rules.ts:29`).
- **Salida estructurada**: `generateObject` con `AiFaqDraftOutputSchema =
  { hasData: boolean, draft: string }`, ambos campos requeridos — los schemas
  all-required usan el strict JSON nativo de OpenAI sin entrar en la excepción
  (`packages/ai-core/src/providers/vercel-openai.adapter.ts:101-104 y 369-423`).
  «No lo sé» se expresa como `hasData: false`, no como prosa inventada.
- **Idioma**: la respuesta va en el idioma de la pregunta.
  `appendReplyLanguageInstruction` sobre el system (`packages/ai-core/src/language/reply-language.ts:325-334`)
  + la regla genérica «en el idioma de la pregunta, traduciendo los valores de
  la ficha» (patrón `CHAT_LANGUAGE_RULE`, `owner-data-fence.ts:291-294`;
  instrucciones por idioma con traducción de labels, `reply-language.ts:283-287`).
  Si la detección no puede decidir (texto corto o mixto, `:261-267`), la regla
  genérica queda a cargo.
- **Inyección**: `guardPromptInjection(question)` antes de llamar al modelo;
  severidad `high` → no se genera: response `{ messageId, hasData: false,
  draft: null }` (mismo camino de «sin dato»), sin fila de metering (no hubo
  llamado ni costo). El guard existe y es detection-only, y hoy no está
  cableado en producción (`packages/ai-core/src/safety/injection-guard.ts:314`;
  `docs/survey.md` §11.1) — este sería su primer uso real. La moderación de
  input/output del engine sigue corriendo igual (`engine.ts:668-677 y 707-714`).
- **Params**: `maxTokens: 1024` (magnitud `DEFAULT_CHAT_MAX_OUTPUT_TOKENS`,
  `chat.helpers.ts:23`; cubre 2000 chars con holgura) y `temperature: 0`
  (precedente del clasificador, `ai-chat-answer-classifier.ts:237`).
- **Post-proceso server-side** (belt-and-suspenders; el system ya prohíbe
  markdown): `stripMarkdown` — fuente de verdad API, `entitlement-filter.ts:296`
  — y `truncateAtWord` a 2000 (`owner-data-fence.ts:150-161`). Output
  degenerado (draft vacío con `hasData` true) se devuelve como
  `hasData: false`: fail hacia el texto de ayuda, jamás hacia un borrador
  vacío.

#### 5.8.4 Feature, modelo, costo y cuota

- **Feature nuevo `faq_draft`** en `AiFeatureSchema`
  (`ai-provider.schema.ts:78-88`) + entries en `DEFAULT_PROMPTS`/`DEFAULT_RULES`.
  Es el label de metering — no un label suelto como el del clasificador — porque
  un límite mensual cuenta por `(user, feature)` y con `userId: null` su propio
  límite jamás dispararía (`docs/survey.md` §11.3).
- **Modelo**: el de `ai_settings.features.faq_draft.model`, inyectado por el
  engine (`engine.ts:690-692`). La entry la trae una data-migration de seed con
  `gpt-5.4-mini` como modelo por defecto (decisión 12; el patrón de la entry es el de
  `packages/seed/src/data-migrations/0101-hos-1220-ai-settings-commerce-chat-features.ts:105
  y 121`); el admin puede cambiarlo en runtime. Razón: generación de texto
  plano acotada (≤ 1024 tokens) donde el riesgo principal es inventar, y mini es
  el que menos inventó en los barridos. Las tarifas de `gpt-5.4-nano` y
  `gpt-5.4-mini` se agregan a `MODEL_RATES` (`model-rates.ts:33-50`) para que el
  costo se mida de verdad (hoy no figuran). Sin entry,
  el engine lanza `AiFeatureNotConfiguredError` (`resolver.ts:255-267`): el
  error honesto hasta que corra la migración.
- **Catálogo nuevo**: `ai_faq_draft` (fila con la misma forma de
  `entitlement-keys.ts:61-66`) + `max_ai_faq_draft_per_month` (misma forma de
  `limit-keys.ts:26-34`), miembros en `key-enums.ts:50-55 y 64-87`, mappings en
  `apps/api/src/utils/listing-access/ai-quota-catalog.ts:4-25`, SQL de catálogo
  regenerado en una migración NUEVA (`pnpm gen:catalog-sql`; guard G18,
  `check-catalog-sql.ts:2-9`) y grants por plan con los valores de OQ-5 (§9).
  G3 vigila que el código no use una key fuera del catálogo
  (`check-catalog-key-usage.ts:2-10`).
- **Gate**: `enforceAiQuota({ userId: ownerId, vertical: <de la ficha>,
  feature: 'faq_draft', entitlementKey: 'ai_faq_draft', limitKey:
  'max_ai_faq_draft_per_month' })` — vertical derivada del `listingEntityType`
  con el patrón `VERTICAL_BY_ENTITY_TYPE` (`text-improve.ts:150-155`), gate
  idéntico al owner-side de text-improve (`:156-162`).
- **Cuota del visitante intacta**: el borrador NO consume los 10/mes del
  visitante. El metering escribe la fila con `feature: 'faq_draft'`,
  `userId: ownerId` y SIN `consumerUserId`; todo conteo de cuota filtra por
  `feature` (`usage.queries.ts:421`), así que esa fila no matchea ningún conteo
  de chat — ni el consumer del visitante ni el owner de `max_ai_chat_per_month`
  (corolario mecánico verificado en `docs/survey.md` §11.5).
- **Metering**: `meterAiUsage({ userId: ownerId, feature: 'faq_draft', ... })`
  (`apps/api/src/utils/ai-usage-metering.ts:139`) — status `'success'` con
  draft entregado, `'error'` si el llamado corrió y no se entregó nada (regla
  del JSDoc, `:8-12`). El cost ceiling del engine suma esta fila como todas
  (`ceiling.ts:238-341`) y el feature gana una entrada propia en
  `DEFAULT_COST_CEILINGS` (`model-rates.ts:93-114`) para no depender solo del
  techo global.
- **Límite agotado**: 403 `LIMIT_REACHED` con
  `{ limitKey, currentCount, maxAllowed }` (`ai-quota-gate.ts:155-159`) → la UI
  usa el toast de billing compartido
  (`billing.limit.max_ai_faq_draft_per_month.title`, partial title-only como
  los demás AI keys, `billing-limit-error.ts:65-112 y 188-245`).

#### 5.8.5 UI

- Botón «Sugerir respuesta con IA» bajo el campo respuesta del formulario FAQ,
  visible solo con `mensaje` sin `respuesta` (§5.8.1) y dentro de
  `PlanEntitlementGate`. Al tocar: disabled + label `aiDraftLoading` — el
  endpoint es JSON único, no SSE: un turno acotado, no un stream.
- `hasData: true`: llena el textarea con el draft ya post-procesado. Debajo del
  campo queda visible `aiDraftDisclaimer` mientras el contenido venga del
  borrador («revisalo y editá antes de guardar»). Un segundo toque regenera y
  sobrescribe.
- `hasData: false`: no toca el textarea; muestra `faqAnswerHelp` (§5.7), el
  mismo texto de ayuda del prefill vacío.
- Errores: 409 → `aiDraftNotEligible`; 403 `LIMIT_REACHED` → toast de billing
  + `aiDraftError` bajo el botón; red/500 → `aiDraftError`. El borrador nunca
  guarda ni descarta nada por sí mismo.

## 6. Criterios de aceptación

1. **Dado** una pregunta sin responder, **cuando** el owner toca «Ya lo vi»,
   **entonces** la pregunta sale de «Sin responder», `unansweredCount` baja, la
   pregunta aparece en «Descartadas» (colapsada, con su respuesta y fecha) y el
   response del GET deja de contarla en `total` y `unansweredCount`.
2. **Dado** una pregunta descartada, **cuando** el owner toca «Deshacer»,
   **entonces** vuelve a su bloque original según su `answerStatus` y los
   contadores la vuelven a incluir.
3. **Dado** un owner que llega al formulario de FAQ desde «Agregar como pregunta
   frecuente» de una pregunta `answered`, **cuando** guarda la FAQ, **entonces**
   la pregunta queda descartada sin otra acción, y el formulario llegó con la
   pregunta y la respuesta del bot sin marcadores de markdown (`**`, `#`, `-`, enlaces),
   editable.
4. **Dado** una pregunta sin responder (o `unclassified`), **cuando** el owner
   abre el formulario desde el atajo, **entonces** la respuesta llega vacía con
   el texto de ayuda (la respuesta del bot nunca se precarga sin veredicto
   `answered`).
5. **Dado** un owner con preguntas descartadas, **cuando** corre el digest
   semanal, **entonces** el mail no las incluye ni en el `unansweredCount` por
   ficha ni en la lista de preguntas (regresión del digest).
6. **Dado** que la ficha tiene más de 50 preguntas activas «otras», **cuando** el
   owner toca «Ver más», **entonces** llegan las siguientes 50 más viejas por
   cursor, y así hasta agotar el horizonte de 12 meses; con el horizonte agotado
   el botón desaparece (`othersNextCursor: null`). Con dos preguntas del mismo
   `askedAt` partidas por el corte de página, ninguna se pierde ni se repite.
7. **Dado** un actor autenticado que no es dueño de la ficha (o un messageId
   inexistente), **cuando** llama a `dismiss`/`undismiss`, **entonces** recibe
   404 con cuerpo byte-idéntico al de un id inexistente, y nunca 403 (regresión
   de ficha ajena).
8. **Dado** un actor sin sesión, **cuando** llama a cualquier endpoint del
   panel, **entonces** recibe 401; un `messageId` no-UUID recibe 400 antes de
   cualquier lectura de DB.
9. **Dado** una pregunta descartada hace 12 meses y pico, **cuando** corre la
   retención, **entonces** se borra igual que cualquier otra (el descarte no
   exime del horizonte).
10. **Dado** un re-descarte o un deshacer repetido, **cuando** se repite la
    llamada, **entonces** responde 200 idempotente con el estado vigente y no
    reescribe la fecha original.
11. **Dado** el owner en el formulario FAQ desde el atajo de una pregunta sin
    responder, **cuando** toca «Sugerir respuesta con IA» y la ficha contiene
    el dato, **entonces** el textarea se llena con un borrador sin markdown, en
    el idioma de la pregunta y con el aviso de borrador visible, y el guardado
    sigue siendo manual (nada se guarda ni descarta solo).
12. **Dado** una pregunta cuyo dato no está en la ficha — y una pregunta con un
    intento de inyección de severidad `high` —, **cuando** se pide el borrador,
    **entonces** la respuesta es `{ hasData: false, draft: null }` y la UI
    muestra el texto de ayuda: el borrador nunca inventa contenido que no está
    en la ficha.
13. **Dado** una pregunta `answered`, **cuando** se pide el borrador,
    **entonces** recibe 409 `FAQ_DRAFT_NOT_ELIGIBLE`; y un `messageId` ajeno o
    inexistente recibe 404 byte-idéntico y nunca 403 (misma pareja
    paired-probe de §5.3).
14. **Dado** un owner que agotó `max_ai_faq_draft_per_month` (o cuyo plan no
    incluye `ai_faq_draft`), **cuando** pide el borrador, **entonces** recibe
    403 `LIMIT_REACHED`/`ENTITLEMENT_REQUIRED` con el toast de billing; sin el
    entitlement, el botón ni se renderiza.
15. **Dado** cualquier borrador generado, **cuando** se inspecciona
    `ai_usage`, **entonces** la fila tiene `feature = 'faq_draft'`,
    `userId` del owner y sin `consumerUserId`, y el conteo mensual del
    visitante para cualquier feature de chat no cambia (regresión de cuota
    cruzada).

## 7. Plan de tests

API (`apps/api`):

- Rutas nuevas (`test/routes/ai-listing-questions.test.ts` extiende o hermano):
  owner OK, sin sesión 401, `messageId` no-UUID 400, ficha ajena/inexistente 404,
  **comparando cuerpo completo ajena vs inexistente** (patrón paired-probe,
  `docs/survey.md` §9), idempotencia (10), mensaje que no es `role='user'` → 404.
- Servicio (`test/integration/ai/listing-questions.test.ts` extiende): descarte
  excluye de ambos bloques activos y del `total`/`unansweredCount`; aparece en
  `dismissed` con su `answerStatus`; cursor de 50 respeta orden y horizonte;
  `othersNextCursor` nula al agotar; descartadas de cualquier estado listadas.
- Digest (extiende `test/cron/ai-questions-weekly-digest.job.test.ts` o su
  selección): pregunta descartada dentro de la ventana → cero filas para esa
  pareja; pregunta no descartada en la misma conversación sigue contando (regresión 5).
- Guard de contrato de errores: la ruta nueva pasa
  `test/utils/error-contract.guard.test.ts` sin cambios al guard.
- Manifest: regenerar `apps/api/route-manifest.json` (`UPDATE_ROUTE_MANIFEST=1`)
  para que `check:api-calls-registered` vea los POST nuevos (`docs/survey.md` §9).

Schemas (`packages/schemas`): campos nuevos de query/respuesta (`othersCursor`,
`othersNextCursor`, `dismissed`, `dismissedCount`) — validación, `.strict()` que
rechaza extras, cursor ISO malformado → 400.

Web (`apps/web`):

- `test/components/listing/ai-questions/AiQuestionsPanel.test.tsx` extiende:
  «Ya lo vi» (optimismo, contador, error), sección «Descartadas» colapsada con
  «Deshacer», «Ver más» acumulando y ocultándose sin cursor.
- `test/hooks/use-faq-prefill.test.tsx` extiende: `respuesta` solo con
  `answered`, strip de markdown y cap 2000, `mensaje` uuid válido descarta al
  guardar (best-effort: fallo del POST no rompe el éxito de la FAQ), limpieza de
  los tres parámetros de la URL.
- `test/lib/render-plain.test.ts` ya fija `stripMarkdownPlain` (sin cambios).

Borrador de IA (§5.8):

- Rutas (extiende o hermana de `test/routes/ai-listing-questions.test.ts`):
  sin sesión 401, `messageId` no-UUID 400, 404 paired-probe byte-idéntico
  (patrón `apps/api/test/routes/existence-disclosure.paired-probe.test.ts`),
  409 `FAQ_DRAFT_NOT_ELIGIBLE` con pregunta `answered`, 403
  `ENTITLEMENT_REQUIRED`/`LIMIT_REACHED`, y 200 `hasData`/`draft` con el
  servicio de IA mockeado; severidad `high` de `guardPromptInjection` →
  `hasData: false` sin fila de metering.
- Servicio/integración (extiende `test/integration/ai/`): assembler correcto
  por vertical; post-proceso — el draft con markdown sale limpio y el que
  excede 2000 queda truncado en 2000; fila `ai_usage` escrita con
  `feature='faq_draft'`, `userId = ownerId`, `consumerUserId` NULL y status
  `success`/`error` según el resultado; **regresión de cuota cruzada**: tras N
  borradores, `getMonthlyCallCount` con cada feature de chat
  (`chat`/`chat_venue`/`chat_experience`) y con `keyedBy: 'user'` y
  `'consumer'` no cambia (`packages/ai-core/src/usage/reporting/monthly-call-count.ts`).
- Schemas (`packages/schemas`): `AiFaqDraftOutputSchema` y
  `AiFaqDraftResponseSchema` — `.strict()`, `draft` null ⇔ `hasData` false
  (refine), campos sin opcionales para el strict JSON.
- Catálogo y settings: `check:catalog-key-usage` (G3) y `check:catalog-sql`
  (G18) sobre la migración de catálogo nueva; la data-migration de seed escribe
  `ai_settings.features.faq_draft` con `gpt-5.4-mini`; un test verifica que
  `MODEL_RATES` tiene tarifa para `gpt-5.4-nano` y `gpt-5.4-mini` (el test del
  resolver cubre el camino `AiFeatureNotConfiguredError` sin config).
- Manifest: la llamada POST nueva del cliente web figura en
  `apps/api/route-manifest.json` (regenerar con `UPDATE_ROUTE_MANIFEST=1`,
  `check:api-calls-registered`).
- Web (`apps/web`): `use-faq-prefill` expone el estado de llegada sin
  `respuesta`; los dos editores renderizan el botón gated
  (`PlanEntitlementGate`) y manejan `aiDraftLoading`, `aiDraftDisclaimer`,
  `hasData: false` → `faqAnswerHelp`, 409 → `aiDraftNotEligible` y 403 → toast
  de billing + `aiDraftError` (`test/components/...` de FaqSection /
  ListingFaqManager y `test/hooks/use-faq-prefill.test.tsx`).

Regresión obligatoria del contrato: la pareja 404-ajena/404-inexistente de
dismiss/undismiss como UNA aserción (`expect(foreign).toEqual(missing)`), y el
digest sin descartadas (5).

## 8. Riesgos

- **R-1 Semántica de `total`**: pasa a excluir descartadas. Es un cambio de
  contrato declarado en §5.2, no un accidente; el único consumidor del campo es
  el aviso de truncado del panel (`docs/survey.md` §10), que queda coherente.
- **R-2 Conversaciones multi-turno**: el descarte es por fila `user`; en una
  conversación de varios turnos cada pregunta se descarta por separado y su
  respuesta emparejada se calcula igual que hoy (LATERAL, `docs/survey.md` §2).
  La exclusión del digest en el WHERE externo (§5.6) evita el bug de re-emparejar
  con una pregunta anterior.
- **R-3 Largo de la URL del prefill**: `respuesta` puede llevar hasta 2000 chars
  urlencoded. Acotado por decisión del owner («Acotar el largo» del issue); si
  OQ-3 se resuelve por id de mensaje, el riesgo desaparece.
- **R-4 «Deshacer» caduca a los 12 meses**: la retención borra descartadas igual
  que activas (§5.1). Correcto por diseño; se comunica con el copy de retención.
- **R-5 Doble fuente del descarte**: el descarte manual (panel) y el automático
  (al guardar FAQ) escriben el mismo endpoint; ambos pasan por el mismo chequeo
  de ownership y la idempotencia (§5.3) hace inofensiva la doble escritura.
- **R-6 Carga del bloque de descartadas**: cap 50 + contador exacto evita
  respuestas sin techo; si en la práctica una ficha acumula miles de
  descartadas, la sección se queda en el preview (paginarla sería extensión
  trivial del mismo cursor, fuera de este spec).
- **R-7 Contenido inventado (§5.8)**: mitigado por capas — system de grounding
  estricto + salida estructurada (`hasData`) en vez de prosa de relleno +
  fences del owner + regla de no-contactos no-verbatim (`listing-chat-rules.ts:29`)
  + strip/truncate server-side + el hecho de que el borrador lo edita un humano
  antes de guardar. El residual es inherente a ML y por eso el draft NUNCA se
  guarda solo (decisión 7).
- **R-8 Prompt injection desde la pregunta del visitante (§5.8)**: la pregunta
  es input no confiable escrito por un visitante y viaja verbatim al prompt —
  exactamente como hoy al chat (`chat.helpers.ts:113`) y al clasificador
  (`ai-chat-answer-classifier.ts:236`). Mitigaciones: `guardPromptInjection`
  con severidad `high` corta antes del modelo (§5.8.3); salida estructurada y
  acotada (≤ 2000 chars, sin markdown, luego del strip); blast radius acotado —
  el resultado es una sugerencia que un humano edita, ninguna instrucción
  inyectada puede escribir en la DB. La moderación de input/output del engine
  sigue corriendo (`engine.ts:668-677 y 707-714`).
- **R-9 Costo del borrador (§5.8)**: es un llamado on-demand por click; lo
  acotan cuatro frentes — la cuota mensual `max_ai_faq_draft_per_month` del
  owner, el rate limit burst (§5.8.2), el maxTokens 1024 y el cost ceiling del
  engine con su entrada per-feature nueva (`model-rates.ts:93-114`). El owner
  asume el costo en su propia cuota; la del visitante queda intacta (§5.8.4).
- **R-10 Idioma equivocado (§5.8)**: la detección puede fallar (texto corto o
  mixto, `reply-language.ts:261-267`) o el modelo puede no respetar el idioma;
  el borrador es editable y el owner lo corrige en el mismo formulario. No
  bloquea el feature: es calidad del draft, no corrección de datos.

## 9. Preguntas abiertas

- **OQ-5 — Cuotas por plan para `max_ai_faq_draft_per_month`.** La key nueva
  necesita valores por tier en `scripts/production-catalog/catalog.ts` (y su
  reflejo en la migración de catálogo, G18) antes de mergear; los otros
  features AI usan escalas tipo 10/50/250
  (`packages/db/src/migrations/0144_production_plan_catalog.sql:334, 348, 362`).
  **Recomendación: espejar la escala de `max_ai_text_improve_per_month`**
  (verificar sus valores vigentes en el catálogo de producción al mergear). El
  valor exacto es decisión comercial, no de diseño.

## 10. Smoke

Label: **`status-needs-smoke-staging`**.

Por qué: la migración corre en la base real de staging (y desde cero en un
`db:fresh-dev` local), el flujo descarte↔FAQ cruza dos apps desplegadas (web +
API), y la exclusión del digest solo se observa contra un cron real o disparado
manualmente en staging con datos de esa base — un test unitario no puede probar
que el mail de la semana no trae lo que el owner descartó. Local alcanza para
migración y UI; el digest y el cross-app definen el gate de staging. No se pide
`prod` (no hay integración externa ni cobro involucrado).

El borrador de IA (§5.8) agrega su propio motivo para el mismo label: el
llamado al provider real — con moderación del engine, la config de modelo de
`ai_settings`, el cost ceiling y el camino 403 de cuota con datos reales — solo
es observable en staging; en local corre con stub/mock, porque los tests de
este repo nunca llaman providers reales (`packages/ai-core/CLAUDE.md`,
convenciones de testing). Verificar en staging: draft coherente en el idioma de
la pregunta, `hasData: false` cuando el dato no está (regresión del no-inventa
contra modelo real), y la fila de `ai_usage` con `feature='faq_draft'`.

## 11. Notas de implementación

- El número real de migración se confirma contra PRs abiertos al mergear (hoy
  el último es `0198_hos_2101_ai_listing_questions.sql`).
- Regenerar `route-manifest.json` con `UPDATE_ROUTE_MANIFEST=1` después de
  montar las rutas nuevas (`docs/survey.md` §9).
- Comentario congelado de `protected-get-write-permission.guard.test.ts:6-7`
  solo si cambia el número de GETs protected (estas rutas son POST: no cambia).
- Catálogo: regenerar el SQL con `pnpm gen:catalog-sql` en una migración NUEVA
  para `ai_faq_draft` / `max_ai_faq_draft_per_month` (G18) y sumar los grants
  por plan (OQ-5). La entry de `ai_settings.features.faq_draft` va en una
  data-migration de seed separada (patrón 0101,
  `docs/survey.md` §11.9).
- El código de dominio `FAQ_DRAFT_NOT_ELIGIBLE` necesita su mapping en
  `ERROR_CODE_TO_HTTP` (`apps/api/src/middlewares/response.ts:30-59`); el guard
  `test/utils/error-contract.guard.test.ts` exige que la ruta respete
  401 → 400 → 404 (§5.3) antes del 409/403 de §5.8.2.

## 12. Linear

Canonical tracking: HOS-2105
