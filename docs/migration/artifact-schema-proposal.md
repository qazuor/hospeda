# Contrato `artifact/v1` para el MVP local

Fecha: 2026-09-15. Propuesta de contrato; todavía no implementada.

## Principios

- El artifact tiene una identidad estable y muchas versiones inmutables.
- Una versión contiene datos declarativos y configuración de vista; el HTML es
  derivado y nunca es la fuente autoritativa.
- Las interacciones persistentes son eventos tipados y validados.
- Restaurar una versión crea una nueva versión; nunca elimina historial.
- Todos los IDs son opacos y estables.
- El contrato no contiene secretos ni credenciales.

## Bundle de publicación

Cada snapshot aceptado recibe un bundle lógico:

```json
{
  "schemaVersion": "artifact/v1",
  "artifact": {
    "id": "art_01J...",
    "project": "hospeda",
    "slug": "migration-status",
    "title": "Estado de migración",
    "description": "Resumen operativo",
    "audience": "internal",
    "visibility": "local",
    "createdAt": "2026-09-15T00:00:00Z",
    "updatedAt": "2026-09-15T00:00:00Z"
  },
  "version": {
    "id": "ver_01J...",
    "number": 1,
    "createdAt": "2026-09-15T00:00:00Z",
    "author": "opencode",
    "reason": "initial publish",
    "sourceHash": "sha256:...",
    "rendererVersion": "artifact-renderer/0.1",
    "basedOnVersion": null
  },
  "data": {},
  "view": {},
  "capabilities": [],
  "sources": []
}
```

Los valores de ejemplo no son credenciales ni IDs reales.

## `data`

Campos mínimos recomendados:

```json
{
  "status": "in_progress",
  "asOf": "2026-09-15T00:00:00Z",
  "summary": "...",
  "sections": [],
  "nextSteps": [],
  "decisions": [],
  "risks": [],
  "widgets": {
    "reviewChecklist": {
      "items": [
        {
          "id": "check-security",
          "label": "Revisar seguridad",
          "required": true,
          "order": 1,
          "initialState": "pending"
        }
      ]
    }
  }
}
```

`data` es declarativo. No contiene `checkedBy`, `checkedAt` ni valores que
cambien con cada visitante; eso vive en eventos/estado materializado.

## `view`

`view` describe presentación, no hechos:

```json
{
  "theme": "system",
  "tabs": ["overview", "checklist", "risks"],
  "defaultTab": "overview",
  "features": {
    "search": true,
    "print": true,
    "export": true
  },
  "widgetOrder": ["reviewChecklist"]
}
```

El renderer debe ignorar claves desconocidas y rechazar configuraciones que
intenten cargar scripts, iframes, fuentes, imágenes o fetch externos.

## Capabilities

Las capacidades describen acciones permitidas, no secretos:

```json
[
  {
    "id": "reviewChecklist.toggle",
    "scope": "artifact",
    "persistence": "event",
    "audience": "local"
  }
]
```

En el MVP local, la capability se valida contra la sesión local. En el futuro
remoto se puede reemplazar por un token limitado sin cambiar el nombre de la
acción.

## Eventos persistentes

Formato mínimo:

```json
{
  "eventId": "evt_01J...",
  "artifactId": "art_01J...",
  "versionId": "ver_01J...",
  "type": "reviewChecklist.itemToggled",
  "payload": {
    "itemId": "check-security",
    "checked": true
  },
  "actor": "local-session",
  "idempotencyKey": "uuid",
  "createdAt": "2026-09-15T00:00:00Z"
}
```

Reglas:

- `type` debe pertenecer a un allowlist versionado.
- `payload` se valida con schema estricto.
- `itemId` debe existir en la versión referenciada.
- repetir `idempotencyKey` devuelve el resultado anterior y no duplica el
  evento;
- un evento no puede cambiar una versión publicada ni `data` declarativo;
- el servidor limita tamaño, frecuencia y cantidad de eventos;
- el estado se calcula como snapshot inicial + eventos válidos posteriores.

## Estado materializado

El servidor puede calcularlo bajo demanda o mantener una proyección:

```json
{
  "widget": "reviewChecklist",
  "items": {
    "check-security": {
      "checked": true,
      "lastEventId": "evt_01J...",
      "updatedAt": "2026-09-15T00:00:00Z"
    }
  }
}
```

La proyección es una optimización. El log de eventos es la evidencia y debe
poder reconstruirse en una base de prueba.

## Versionado y restauración

- `number` es monotónico por artifact.
- Una nueva publicación nunca reemplaza bytes de una versión anterior.
- “Restaurar versión 3” crea versión 7 con `basedOnVersion: 3`.
- Los eventos históricos siguen vinculados a sus versiones originales.
- Una versión nueva puede declarar si hereda o reinicia el estado del widget.
- El listado muestra latest y cantidad de versiones, sin exponer payloads.

## API local inicial

```text
GET  /api/artifacts
POST /api/artifacts
GET  /api/artifacts/:id
GET  /api/artifacts/:id/versions
GET  /api/artifacts/:id/versions/:version
POST /api/artifacts/:id/versions
POST /api/artifacts/:id/restore/:version
GET  /api/artifacts/:id/state
POST /api/artifacts/:id/events
GET  /api/health
```

`POST` requiere sesión local. La API no recibe HTML arbitrario para mutaciones;
recibe bundle/data/view validados y genera el render.

## Migración a remoto

El contrato no debe asumir SQLite, Vercel ni un proveedor de identidad. Solo el
adaptador de repositorio y la capa de sesión cambian:

```text
LocalSessionRepository  -> RemoteIdentityRepository
SQLiteRepositories       -> SQL/API repositories
localhost renderer       -> hosted renderer/API
```

El bundle exportado debe ser suficiente para reconstruir el artifact en otra
instancia sin copiar la base completa.

## Criterios de aceptación del contrato

1. Validar un bundle válido y rechazar uno con claves prohibidas.
2. Crear versión 1 y renderizarla.
3. Publicar versión 2 conservando versión 1.
4. Alternar un item y recuperar estado tras reiniciar.
5. Repetir una idempotency key sin duplicar eventos.
6. Restaurar versión 1 como versión 3.
7. Exportar/importar en una base vacía.
8. Confirmar que ningún secreto o recurso remoto entra al HTML.

## Corrección: el artifact nace de lenguaje natural

El bundle JSON no es la interfaz principal del usuario. Es el formato interno y
validable que produce el flujo conversacional. La experiencia debe aceptar
pedidos como:

```text
Analizá todos los issues de billing que siguen en backlog y armame un artifact
con el reporte.

Analizá las deficiencias del sistema actual de envío de mails y armame un
artifact con el análisis y el plan para mejorarlo.
```

El pipeline será:

```text
pedido en lenguaje natural
  → resolver alcance y fuentes
  → investigar (repo, Linear, Git, Engram, docs)
  → sintetizar hallazgos y plan
  → elegir estructura visual
  → producir bundle artifact/v1
  → validar contenido/secretos
  → mostrar preview local
  → pedir aprobación
  → publicar snapshot
```

El agente no debe inventar datos ni publicar durante la fase de investigación.
Si una fuente no está disponible, el artifact debe marcarla como stale o
pendiente y conservar la incertidumbre.

## Bloques visuales

`data.sections` no debe limitarse a tablas. El renderer debe soportar, como
mínimo:

- `hero`: título, contexto, estado y métricas principales;
- `prose`: explicación narrativa con Markdown seguro;
- `metricGrid`: números, etiquetas, tendencia y fuente;
- `callout`: decisión, advertencia, evidencia o criterio de salida;
- `table`: filas, columnas, badges y enlaces internos;
- `timeline`: fases, fechas, dependencias y estado;
- `checklist`: items persistentes o solo visuales;
- `diagram`: nodos/aristas SVG declarativos, sin HTML arbitrario;
- `code`: fragmento con lenguaje y botón copiar;
- `links`: referencias a issues, specs, PRs y fuentes;
- `accordion`: detalle opcional para no saturar la lectura.

La estructura visual se decide según el contenido. Un análisis de backlog puede
usar métricas + tabla + fases; un plan de arquitectura puede usar hero +
callouts + diagrama + decisiones; una auditoría puede usar métricas, hallazgos,
riesgos y checklist.

Cada bloque declara `id`, `type`, `title` opcional, `data` y `interactions`
permitidas. El renderer solo acepta tipos conocidos y escapa todo texto.

## Separación entre contenido y estado

El artifact publicado contiene:

```text
artifact-data.json      hechos, hallazgos, plan y fuentes
artifact-view.json      composición visual y features habilitadas
artifact-state.json     estado materializado de widgets persistentes
artifact-events         historial de interacciones
render.html             representación derivada
```

Un pedido nuevo puede generar una versión nueva modificando `data` y `view`.
Una interacción del lector solo genera eventos sobre `state`; no reescribe el
markup ni altera los hechos del análisis.

## División de trabajo LLM vs renderer

La regla del sistema será:

```text
LLM: investiga, razona, redacta y elige componentes declarativos
Script: valida, renderiza, agrega interactividad y persiste eventos
```

El LLM **no debe escribir el HTML/CSS/JavaScript final** en el caso normal. Debe
entregar un bundle estructurado con:

- hechos, hallazgos, decisiones y plan;
- fuentes, fechas y nivel de certeza;
- bloques visuales conocidos (`hero`, `metricGrid`, `table`, `timeline`, etc.);
- variante de layout y tokens de diseño permitidos;
- acciones/interacciones declaradas mediante un allowlist;
- textos, etiquetas y datos de cada bloque.

El renderer se encarga de:

- generar todo el HTML semántico;
- aplicar el sistema visual, responsive y dark/light;
- producir CSS y JavaScript comunes una sola vez;
- implementar tabs, filtros, búsqueda, accordions, copiar, impresión y
  navegación de versiones;
- conectar checkboxes y acciones con la API de eventos;
- escapar texto y eliminar markup no permitido;
- insertar `noindex`, CSP, metadata, fuentes y hashes;
- comprobar overflow, links, tamaño y ausencia de secretos;
- producir el bundle final y el snapshot.

Así, un cambio visual global se implementa una vez en el renderer y mejora todos
los artifacts. El LLM sigue pudiendo decidir si un análisis necesita métricas,
una tabla, un timeline, un diagrama o un checklist, pero no consume tokens
repitiendo la implementación de cada control.

### Libertad visual controlada

Para no perder variedad, `view` ofrecerá opciones declarativas:

```json
{
  "theme": "editorial-dark",
  "density": "comfortable",
  "layout": "report",
  "accent": "cyan",
  "sections": [
    {"id":"summary","component":"hero","variant":"split"},
    {"id":"findings","component":"metricGrid","variant":"four-up"},
    {"id":"plan","component":"timeline","variant":"phases"}
  ]
}
```

El schema limitará `theme`, `density`, `layout`, `accent`, `variant` y
componentes a valores conocidos. El LLM puede combinar esos valores; no puede
inyectar CSS, JS, URLs remotas o atributos arbitrarios.

### Excepciones

Un artifact puede requerir una visualización especial. En ese caso el LLM
puede producir datos para un componente nuevo o un SVG declarativo validado,
pero no markup libre. Agregar un componente nuevo es trabajo de código del
renderer, con revisión y tests; no se resuelve insertando un `<div>` o un
`<script>` generado por cada reporte.

El HTML directo solo se permitiría en una vía avanzada, deshabilitada por
omisión, con sanitización estricta, sandbox y aprobación explícita. No forma
parte del MVP.

### Costo esperado

Con esta división, el LLM usa tokens para lo que aporta valor diferencial:
recolección, análisis, síntesis, decisiones y selección de estructura. El
renderer reutiliza código para todo lo mecánico y repetitivo. También reduce la
variación visual entre artifacts, facilita accesibilidad y evita que una
respuesta del modelo rompa la seguridad o el layout.
