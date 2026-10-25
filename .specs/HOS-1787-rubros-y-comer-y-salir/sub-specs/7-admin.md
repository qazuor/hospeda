---
title: Sub-spec 7 · Admin
linear: HOS-1787 (hijo pendiente de crear)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (respuestas del owner a la vuelta 2)
---

# 7 · Admin (`apps/admin`)

Decisiones: DEC-FAC-005, 019, 026, 031, 034, de la vuelta 2: 047, 048, 056, 057, y de las respuestas del owner:
065 (dimensiones de reseña) y 067 (frontera de tipos). Depende de 2 y 3.

- Los rubros aparecen en el formulario consolidado de la ficha (grupo de checkboxes derivado del
  catálogo; las opciones habilitadas salen de `resolveBusinessLineOptions`, DEC-FAC-047; mínimo uno; misma
  validación que el servidor, por el validador genérico de DEC-FAC-026). Sólo cuando la vertical tiene más de un rubro; la columna y el
  filtro del listado, igual (F-V1-036).
- **Permiso** (F-V1-020): editar los rubros exige el mismo permiso que editar el tipo de la ficha
  (`venue.editAll` sobre una ficha ajena). La entrada es `businessLines: BusinessLine[]` (sin `vertical`,
  F-V1-047).
- **Registro**: un cambio de rubros hecho por un tercero queda en la línea de tiempo de la ficha
  (`domain_event`).
- **Aviso al dueño** (DEC-FAC-034): cuando soporte o un admin cambia los rubros de una ficha ajena, el dueño
  recibe un aviso **por correo e in-app** (se nombra qué rubros cambiaron y qué secciones dejan de verse o
  aparecen). Reusa el canal de REQUEST_FIX, sin mecanismo nuevo. Lo verificado en código: REQUEST_FIX
  (`apps/api/src/services/listing-publication/listing-moderation.service.ts` →
  `packages/verticals/src/publication/fix-request.ts`) hace dos cosas: (1) **correo**, con
  `tx.enqueueListingNotice` (`apps/api/src/utils/listing-publication/ports.ts`) que encola en
  `email_outbox` la plantilla `LISTING_FIX_REQUESTED_TEMPLATE` (`verticals.listing-fix-requested`,
  `packages/verticals/src/publication/moderation-notices.ts`), que renderiza `packages/notifications`;
  (2) **in-app**, no como notificación guardada sino como aviso **derivado** del hecho de la ficha
  (`fix_request` abierta + evento `listing.fix_request_opened`) que lee
  `apps/api/src/services/listing-notices/listing-notices.builder.ts` y muestra
  `apps/web/src/components/listing/ListingNotices.astro`. Para el cambio de rubros hay que agregar, con el
  mismo patrón: una plantilla de correo nueva, un evento registrado (`domain_event`, ya previsto arriba) y
  un tipo nuevo de aviso en el builder. Son piezas del mismo mecanismo, no un canal nuevo.
- **Vida útil del aviso in-app** (DEC-FAC-056, F-V2-032): a diferencia de la fix request (que se cierra), el cambio
  de rubros es un evento puntual. El aviso dura **30 días** desde el último cambio (criterio de
  `LIFT_NOTICE_WINDOW_DAYS`, `listing-notices.builder.ts:24`), varios cambios seguidos colapsan en el último, y
  desaparece si el dueño vuelve a editar sus rubros.
- **Corrección de rubros mal elegidos** (DEC-FAC-057, F-V2-033): es **política operativa**, no un bloqueo del
  sistema. Ante un error de clasificación, el admin emite un pedido de corrección al dueño (REQUEST_FIX), que el
  dueño resuelve desde su editor. El permiso de editar rubros es el mismo para admin y soporte (`venue.editAll`) y
  el sistema no distingue uno de otro: lo que garantiza es que toda edición directa quede registrada y avisada. Si
  ya hay una fix request abierta, `requestListingFix` responde `ALREADY_OPEN`
  (`packages/verticals/src/publication/fix-request.ts:55`): el admin espera a que se resuelva o suma la corrección
  de rubros a la abierta.
- **`nightInfo` en el admin** (DEC-FAC-057): el formulario consolidado **no** muestra sus campos (como no muestra la
  carta). El PATCH de admin (`routes/gastronomy/admin/patch.ts:30` → `venue`) ya pasa por la cadena, así que el
  paso 4b frena una escritura de `nightInfo` en una ficha sin `nightlife` igual que para el dueño.
- El selector de tipo de la config consolidada de venue se deriva del enum (sub-spec 4); `BAR` y `PUB`
  con descripciones propias (frontera de DEC-FAC-067: BAR tragos, PUB cerveza tirada, CERVECERIA productora).
- **Moderación de reseñas** (DEC-FAC-065): el flujo y los permisos de moderación no cambian
  (`venue.moderateReview`); la vista de una reseña de venue en el admin **muestra sus dimensiones votadas**, con las
  etiquetas del catálogo (`ReviewRules`), sin lista propia de dimensiones ni comparación por rubro. El admin no
  edita dimensiones.
- **Coordinación con HOS-1362 (V8)**: las rutas de la acción 15 (editar el contenido de una ficha ajena)
  **heredan** el paso 4b y el paso 6 de la cadena, que ya evalúan sobre el dueño (`subjectId`); no hay una
  «consulta al resolvedor» aparte. No se ofrecen secciones `absent` (F-V1-035).
- El admin hoy no tiene UI de carta, menú del día ni eventos; esta spec no la agrega.

## Criterio de aceptación

- Una edición directa de rubros (soporte o admin, mismo permiso) se refleja en la ficha pública tras la purga,
  queda en la línea de tiempo y el dueño recibe el aviso por correo e in-app; el aviso in-app desaparece a los 30
  días o cuando el dueño edita sus rubros.
- Un PATCH de admin con campos de `nightInfo` sobre una ficha sin `nightlife` es rechazado por el 4b.
- La validación de tipo ↔ rubros permitidos rechaza una combinación inválida también desde el admin
  (heladería con `nightlife`).
- Un REQUEST_FIX sobre los rubros llega al dueño y no modifica la ficha hasta que el dueño responde.
- Soporte con plan propio Premium que edita la ficha de un dueño Básico ve `locked` donde el dueño la ve.
- La moderación de una reseña de venue con dimensiones las muestra; una sin dimensiones muestra sólo la general.
