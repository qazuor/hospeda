---
name: visual-artifact
description: Crear artifacts visuales ricos desde pedidos de análisis en lenguaje natural
---

Usá esta skill cuando el usuario pida un reporte, análisis, planificación,
auditoría o resumen que se beneficie de una página HTML navegable y compartible.
No supongas que el usuario tiene un JSON preexistente.

## Flujo

1. Interpretá el pedido y determiná objetivo, audiencia, período, fuentes y
   nivel de certeza.
2. Consultá solo fuentes autorizadas y seguras. Para Hospeda pueden ser repo,
   Linear, Git, `.specs`, OpenSpec, Engram y documentación. Nunca leas secretos.
3. Separá hechos verificados, inferencias, decisiones, riesgos y pendientes.
4. Elegí una composición visual adecuada: hero, métricas, narrativa, callouts,
   tablas, timeline, diagrama, checklist, código y enlaces según corresponda.
   No fuerces todo a una tabla.
5. Generá un bundle `artifact/v1` en un archivo temporal dentro del worktree.
   El bundle es fuente declarativa; el HTML será derivado.
6. Ejecutá `hops artifact validate <bundle>` cuando exista el validador. Si una
   fuente falló, marcala stale y no completes el hueco con memoria.
7. Mostrá al usuario un resumen de qué contiene y pedí aprobación antes de
   publicar. La investigación no publica ni muta Linear, Git, Engram o DB.
8. Tras aprobación, ejecutá `hops artifact publish <bundle>` y devolvé la URL
   local y la versión.

## Interactividad

Usá estado local para tabs, filtros, búsqueda, orden, copiar e imprimir. Usá
eventos persistentes solo para controles explícitos como checkboxes, votos o
comentarios. Cada evento necesita tipo, payload estricto e idempotency key.

## Reglas de contenido

- Incluir `asOf`, fuentes y nivel de certeza.
- Escapar texto de issues, PRs, commits, Engram y archivos.
- No incluir tokens, `.env`, passwords, DSN, cookies ni datos personales.
- No cargar scripts, iframes, fuentes ni imágenes externas por defecto.
- Si el pedido solo necesita una respuesta breve, no generes un artifact.

## División de responsabilidades

Generá datos y composición declarativa; no escribas HTML/CSS/JavaScript final en
cada artifact. Elegí componentes y variantes del schema permitido. El renderer
se ocupa de markup, estilos, controles, sanitización, CSP, accesibilidad,
responsive y eventos. Si falta una visualización, proponé un nuevo componente
para el renderer en lugar de inyectar markup libre.
