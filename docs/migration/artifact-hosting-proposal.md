# Propuesta: artifacts publicados equivalentes a Claude

Fecha: 2026-09-15. Esta propuesta agrega el requisito de los artifacts online de Claude; todavía no implementa ni publica nada.

## Corrección del relevamiento anterior

El inventario de 271 HTML encontrado en `~/.claude/projects/**/tool-results/` describe capturas locales de resultados de herramientas. No demuestra cuántos artifacts fueron publicados en `claude.ai` ni contiene necesariamente sus URLs, versiones completas o permisos. Son dos inventarios distintos:

1. **Cache local de sesiones**: útil para recuperar contenido, pero efímero, duplicado y acoplado al runtime de Claude.
2. **Artifacts hospedados de Claude**: documentos con URL estable, publicación privada por defecto, opción de compartir, autoactualización, revisiones y selector de versiones.

El segundo es el comportamiento que queremos preservar. La cantidad real de artifacts hospedados queda **pendiente de inventariar** desde la cuenta/sesiones de Claude; no se debe inferir desde los 271 HTML locales.

Anthropic documenta que en Claude Code cada publicación crea una nueva versión bajo el mismo enlace, con historial y restauración, y que cada artifact es privado por defecto. También documenta compartir la última versión o una versión específica. Fuentes: [Claude Code artifacts](https://claude.com/blog/artifacts-in-claude-code), [publicar y compartir](https://support.claude.com/en/articles/9547008-publish-and-share-artifacts), [historial en Claude Cowork](https://support.claude.com/en/articles/14729249-use-artifacts-in-claude-cowork).

## Objetivo funcional

Para cada artifact queremos:

- documento HTML atractivo y responsive;
- edición iterativa desde OpenCode/Claude/Gentle-AI;
- URL estable por artifact;
- nueva revisión ante cada publicación aprobada;
- selector y comparación de versiones;
- restauración sin destruir el historial;
- privado por defecto;
- compartir mediante enlace, con modo público explícito;
- exportar HTML/JSON y mantener una copia reproducible versionada;
- trazabilidad de fuentes, fecha, autor/agente y hash;
- separación entre contenido persistente y datos personales de cada usuario,
  si en el futuro se agregan widgets con estado local.

## Alternativas de implementación

### A. Servidor propio de artifacts — recomendada

Crear un servicio pequeño y genérico, separado de Hospeda, en un repositorio de
infraestructura común. El renderer recibe un `artifact.json` validado y produce
HTML autocontenido. La API guarda:

- `artifact_id` opaco y slug opcional;
- metadatos y permisos;
- revisiones inmutables (`version_id`, hash, timestamp, autor, fuente);
- HTML sanitizado o bundle estático;
- relación `latest_version`;
- auditoría de publicar, compartir, revocar y restaurar.

Rutas conceptuales:

```text
GET  /artifacts/:id                 -> última versión autorizada
GET  /artifacts/:id/versions        -> historial autorizado
GET  /artifacts/:id/versions/:vid   -> versión concreta
POST /artifacts/:id/versions        -> nueva publicación autenticada
POST /artifacts/:id/restore/:vid    -> crea una nueva versión basada en una anterior
POST /artifacts/:id/share           -> cambia visibilidad con confirmación
POST /artifacts/:id/revoke          -> revoca un enlace compartido
```

Restaurar nunca borra versiones: crea una revisión nueva. El enlace estable
apunta al artifact y el selector permite elegir una revisión.

**Ventajas:** control de privacidad, independencia del proveedor de modelos,
versionado real, integración con Linear/Engram y posibilidad de alojarlo en la
infraestructura de Hospeda o en un servicio común.

**Costos:** autenticación, almacenamiento, autorización, sanitización, backup,
subida de HTML, UI de historial y mantenimiento operativo.

### B. Git + hosting estático

Cada artifact y versión vive en Git y se publica por GitHub Pages, Cloudflare
Pages u otro hosting. Es simple y auditable, pero no entrega por sí solo
privacidad por defecto, selector cómodo, restauración de usuario ni control de
acceso fino. No debe ser el único backend si los artifacts contienen análisis
internos de Hospeda.

### C. Object storage + índice propio

Versiones inmutables en R2/S3/MinIO y una pequeña API/UI para permisos e índice.
Es una buena base de producción, pero sigue requiriendo autenticación y una UI.
Puede ser la implementación de almacenamiento de la alternativa A.

### D. Servicio SaaS de terceros

Puede acelerar el primer prototipo, pero introduce dependencia, costos,
política de datos y riesgo de exposición. No se recomienda como fuente de verdad.

### E. Copiar Claude Artifact o usar un plugin de OpenCode

No hay una API pública general verificada que permita a OpenCode publicar en el
servicio Artifact de Claude. Un plugin de preview no resuelve hosting privado,
versiones, ACL ni restauración. No es una ruta de migración confiable.

## Diseño recomendado por etapas

### Fase 1 — contrato y renderer local

- Definir schema `artifact/v1`.
- Crear renderer determinista y plantilla visual.
- Generar HTML local, sin red ni publicación.
- Agregar validación de datos, sanitización y detección de secretos.
- Crear un artifact piloto de migración, usando datos no sensibles.

### Fase 2 — publicación privada mínima

- Servicio común con login personal y sesiones seguras.
- Artifact privado por defecto.
- URL estable y tabla de versiones inmutables.
- UI mínima: ver, elegir versión, copiar enlace privado, exportar.
- No habilitar enlaces públicos todavía.

### Fase 3 — compartir y restaurar

- Compartir explícito con advertencia de que un enlace público puede ser
  indexable.
- Revocar enlaces.
- Restaurar versión creando una nueva revisión.
- Auditoría de cambios y logs sin contenido secreto.

### Fase 4 — integración con OpenCode y hops

- `artifact-render` como tool/command de OpenCode.
- `hops artifact create`, `publish`, `refresh`, `versions`, `restore`,
  `share` y `revoke` como wrapper determinista.
- Ningún command publica automáticamente: debe existir una confirmación humana
  para la primera publicación y para cambiar visibilidad.
- `refresh` consulta fuentes autorizadas y publica una revisión solo después de
  validación.

### Fase 5 — integración con Gentle-AI

Gentle-AI puede producir proposal/spec/design/tasks/verify como datos fuente y
registrar lineage en Engram. No debe convertirse en el servidor de publicación.
Un artifact visual puede enlazar a esos artifacts técnicos, pero no duplicarlos
como otra fuente de verdad.

## Seguridad obligatoria

- Privado por defecto y ACL comprobada en cada lectura.
- Tokens y credenciales solo en el servidor; nunca dentro del HTML.
- Sanitización HTML estricta y CSP sin recursos externos por defecto.
- No ejecutar JavaScript arbitrario generado por el modelo sin sandbox/revisión.
- Sin iframes, fetch externos, imágenes remotas o fuentes CDN por defecto.
- Escaneo de secretos antes de publicar.
- Confirmación explícita antes de: hacer público, compartir por enlace,
  incluir datos de Linear, incluir datos de producción o permitir interacción
  que escriba en un servicio.
- Backup del índice y de bundles; prueba de restauración antes de uso real.
- El frontend público solo sirve una revisión autorizada; jamás expone el
  listado global de artifacts.

## Cómo migrar artifacts hospedados de Claude

No debemos intentar descubrirlos por fuerza bruta a partir del UUID. Para cada
artifact que el usuario quiera conservar:

1. Registrar URL, título, propietario, visibilidad y utilidad actual.
2. Descargar/exportar la versión actual y, si Claude lo permite, cada versión
   relevante del historial.
3. Guardar originales en backup fuera del repositorio.
4. Extraer contenido semántico, datos y fuentes; eliminar el runtime de Claude.
5. Importar como `artifact/v1` y producir una revisión inicial en el servidor
   nuevo.
6. Comparar visualmente, funcionalmente y en privacidad.
7. Marcar el artifact como migrado solo después de aprobación humana.

Los artifacts únicos, caducos, duplicados o sin fuente verificable deben quedar
archivados, no migrarse automáticamente.

## Decisiones que necesito confirmar

1. **Hosting:** ¿preferís que el servidor viva en infraestructura propia de
   Hospeda, en un repositorio/servicio común para varios proyectos, o empezar
   local y decidir después?
2. **Audiencia:** ¿los artifacts deben compartirse con usuarios sin cuenta,
   con autenticación, o ambos modos?
3. **Alcance de edición:** ¿querés editar el HTML directamente desde un visor,
   o que la edición ocurra siempre desde OpenCode y el visor sea de lectura?
4. **Datos vivos:** ¿un refresh debe consultar Linear/Git/Engram
   automáticamente, o requerir un snapshot explícito antes de publicar?
5. **Interactividad:** ¿necesitás widgets con estado persistente y comentarios,
   o inicialmente alcanza navegación, filtros, búsqueda, gráficos y enlaces?
6. **Migración:** ¿tenés una lista/export de las URLs de Claude, o debemos
   armar el catálogo manualmente a partir de tu galería y chats?
7. **Compatibilidad:** ¿querés que los artifacts generados por Claude sigan
   siendo editables en Claude después de migrarlos, o alcanza conservarlos como
   HTML/JSON independientes?

## Recomendación provisional

Construir primero un servidor común de artifacts, con renderer local y
persistencia de revisiones, antes de migrar los documentos. Mantener Hospeda
como consumidor mediante un adaptador; no acoplar la UI a OpenCode ni a
Gentle-AI. Migrar solo artifacts aprobados y conservar sus originales hasta
validar contenido, versiones y permisos.

## Decisiones recibidas del usuario

- El producto será una mini app multi-proyecto, potencialmente desplegada en
  Vercel.
- Los artifacts podrán ser públicos y accesibles sin cuenta, con headers/meta
  `noindex, nofollow`. Esto reduce descubrimiento accidental, pero **no es una
  medida de confidencialidad**: quien tenga el enlace puede compartirlo y los
  crawlers no están obligados a respetar esas directivas.
- El visor será de lectura, pero puede tener interacción: botones, checkboxes,
  filtros, tabs y controles equivalentes.
- El markup no será la fuente de estado. Cada artifact tendrá datos separados,
  versionados en JSON, y el HTML leerá esos datos y emitirá eventos.
- Las interacciones que deban persistir se guardarán en backend. No se confiará
  en `localStorage` como persistencia principal.
- Se publicará un snapshot explícito cuando el artifact deba actualizarse.
- La migración de artifacts antiguos de Claude queda fuera de esta etapa. El
  sistema se diseña para artifacts nuevos.
- No hace falta conservar compatibilidad de edición con Claude.

## Modelo de datos propuesto

Separar cuatro capas:

```text
Artifact (identidad, slug, proyecto, visibility, owner)
  └── Version (contenido, schemaVersion, asOf, sourceHash, rendererVersion)
        ├── data.json      datos declarativos del reporte
        ├── view.json      configuración de tabs, widgets y acciones permitidas
        └── render.html    markup derivado, sin estado autoritativo

ArtifactEvent (interacciones persistentes del visor)
  └── artifactId, versionId, eventId, action, payload validado, actor/capability,
      createdAt, idempotencyKey
```

El HTML puede incluir una copia firmada o embebida de `data.json` para cargar
rápido, pero el servidor debe conservar la copia canónica. Las acciones no
modifican arbitrariamente el HTML: envían eventos tipados a una API. La API
valida el evento, aplica límites y devuelve el nuevo estado o la secuencia de
eventos. Para controles que solo afectan la vista (filtros, tabs, orden) puede
usarse estado local; para checks, comentarios, decisiones o formularios debe
usarse persistencia remota.

## Escritura pública sin autenticación

La lectura pública sin login es viable. La escritura anónima abierta no lo es:
permitiría que cualquiera altere checks, comentarios o decisiones y también
abriría la puerta a spam y costos inesperados.

Propuesta:

- lectura: URL pública con `noindex, nofollow` y CSP estricta;
- publicación/versionado: solo OpenCode/hops mediante credencial de servidor;
- interacción persistente: capability token por artifact o por acción, no una
  clave global; el token se entrega en el HTML solo si el propietario acepta
  que esa acción sea pública;
- acciones públicas limitadas a un allowlist (`toggle_check`, `vote`, etc.),
  con validación de schema, rate limit, idempotencia y tamaño máximo;
- acciones privadas (editar contenido, publicar versión, restaurar, ver datos
  internos) requieren autenticación del propietario o un token de gestión que
  nunca se incrusta en el visor público;
- si no necesitamos colaboración anónima, el MVP deja los controles como
  estado local o usa un enlace de participación separado.

Esto debe resolverse antes de implementar widgets persistentes.

## Stack inicial sugerido

- App web TypeScript/React o Astro, separada de Hospeda.
- Vercel Functions para API y publicación.
- Base SQL administrada para metadata, versiones y eventos; no usar Blob como
  base de datos de estado. Vercel documenta Blob como almacenamiento de objetos
  y ofrece entrega privada mediante Functions; puede usarse para bundles HTML o
  assets grandes si el SQL guarda la metadata y permisos.
- Storage de objetos opcional para `render.html`, imágenes embebidas y exports.
- Renderer determinista compartido con OpenCode/hops, ejecutable localmente y
  en CI.
- Headers `X-Robots-Tag: noindex, nofollow, noarchive` y meta equivalente,
  además de `robots.txt` donde corresponda. Estas directivas no sustituyen ACL.

Fuentes Vercel consultadas: [Storage overview](https://vercel.com/docs/storage),
[Blob](https://vercel.com/docs/vercel-blob), [private Blob storage](https://vercel.com/docs/vercel-blob/private-storage).

## Decisión pendiente sobre interacción persistente

La pregunta 5 queda reducida a esta elección para el MVP:

- **A. Solo interacción de lectura:** tabs, filtros, búsqueda, copiar e
  imprimir; checks o formularios no persisten. Menor riesgo y complejidad.
- **B. Persistencia pública limitada (recomendada si realmente la necesitás):**
  checks/votos/comentarios con capability token por acción, rate limit y eventos
  inmutables. Permite colaboración sin login, pero requiere abuso y privacidad.
- **C. Usuarios autenticados:** persistencia completa por usuario, con más
  infraestructura y control.

Recomiendo comenzar por A y habilitar B únicamente para un widget concreto que
probemos con datos no sensibles.

## Decisión adicional: MVP local con widget persistente

El MVP no se desplegará inicialmente en Vercel ni en otro servidor remoto. Se ejecutará como una mini app local en la PC del usuario y tendrá:

- página de listado/galería de artifacts;
- página individual por artifact;
- versiones navegables;
- publicación de snapshots desde una CLI o command de OpenCode;
- un widget persistente desde el primer prototipo;
- base local y backup sencillo;
- arquitectura preparada para sustituir el almacenamiento local por API/base remota.

Esto permite validar el contrato y la interacción sin agregar todavía dominio,
TLS, OAuth, multiusuario, CDN, costos ni exposición pública.

### Alcance funcional mínimo

```text
/artifacts                         listado local
/artifacts/:artifactId             última versión
/artifacts/:artifactId?v=:version  versión concreta
/artifacts/:artifactId/events      eventos persistidos del widget
```

El primer widget recomendado es un **checklist de revisión** porque prueba el
ciclo completo sin requerir colaboración compleja:

- cada item tiene `id`, `label`, `status`, `required` y `order`;
- el usuario puede marcar/desmarcar;
- el cambio genera un evento tipado;
- el backend local valida y persiste el evento;
- el estado se reconstruye desde snapshot + eventos;
- la UI muestra `updatedAt` y el origen del último cambio;
- publicar una nueva versión no borra la historia de eventos anterior.

No se agregan comentarios, edición libre, uploads ni ejecución de código en el
primer MVP.

### Persistencia local

Para el MVP se recomienda SQLite local mediante una capa de repositorio, con
migraciones versionadas y WAL. Las tablas conceptuales son:

- `artifacts`: identidad, título, proyecto, visibilidad local y versión actual;
- `artifact_versions`: `version_id`, `artifact_id`, schema, datos, view,
  HTML, hash, renderer y timestamp;
- `artifact_events`: evento validado, payload, versión, timestamp e idempotency
  key;
- `artifact_sources`: fuentes y hashes declarados del snapshot.

El HTML puede incluir el JSON inicial para carga rápida, pero todas las acciones
persistentes pasan por una ruta local de API. `localStorage` solo puede guardar
preferencias de UI, como tab activo o filtros.

La base y los bundles deben quedar fuera del repositorio del proyecto por
omisión, en un directorio de datos de la app. La CLI debe ofrecer un export
portable y un backup antes de cambios de schema. Nunca se debe mezclar esta DB
con la DB de Engram.

### Autorización local

En localhost, la amenaza principal no es el acceso remoto sino que una página o
proceso local modifique artifacts sin intención. Para mantener el MVP pequeño:

- el servidor escucha solo en `127.0.0.1`;
- las mutaciones requieren un token de sesión local generado al iniciar;
- el token se entrega al navegador local mediante la sesión de la app y no se
  imprime en logs;
- la CLI de publicación usa el mismo canal local y una credencial almacenada
  fuera del repositorio;
- las rutas de lectura pueden ser públicas dentro de localhost;
- el servidor rechaza requests con `Origin` externo y aplica CSRF para
  mutaciones;
- no se ofrece binding `0.0.0.0` ni túnel remoto en el MVP.

No hace falta OAuth todavía. Cuando el servicio pase a remoto se reemplaza la
sesión local por autenticación real y ACL sin cambiar el contrato de artifacts ni
los eventos.

### Listado y estado

La galería local debe mostrar solo metadata segura:

- título;
- proyecto;
- estado;
- fecha de última versión;
- cantidad de versiones;
- si tiene interacción persistente;
- enlace a la última versión.

No debe renderizar contenido de artifacts en la página de listado ni exponer
fuentes, tokens, variables de entorno o payloads de eventos.

### Evolución remota

El MVP debe ocultar el almacenamiento detrás de interfaces:

```text
ArtifactRepository
VersionRepository
EventRepository
SourceRepository
```

La implementación inicial será SQLite local. Una etapa posterior podrá usar una
API en Vercel Functions y SQL administrado, con Blob privado para bundles
pesados. La UI y el renderer no deberían saber si la fuente es local o remota.

### Gate del MVP

No pasar a Vercel hasta demostrar localmente:

1. creación de un artifact desde un JSON validado;
2. render correcto y responsive;
3. listado y navegación por versiones;
4. marcar/desmarcar checklist y conservarlo tras reiniciar el servidor;
5. publicar una nueva versión sin borrar eventos anteriores;
6. restaurar una versión creando otra revisión;
7. exportar e importar un artifact en una segunda DB de prueba;
8. detectar y rechazar payloads inválidos y HTML externo no permitido.
