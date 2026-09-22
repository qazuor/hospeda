# Artifacts visuales: Claude Code → OpenCode + Gentle-AI

Fecha de relevamiento: 2026-09-15. Este documento es análisis; no instala plugins, no publica páginas y no copia artifacts.

## Qué existe hoy en Claude

La instalación de Claude conserva el plugin oficial `project-artifact`. Su documentación lo describe como una skill que genera una página HTML auto-contenida, con pestañas, estado, próximos pasos, riesgos y decisiones, y la publica mediante el `Artifact` propietario de Claude en una URL privada de `claude.ai`. Mantiene un `config.md` y un `page.html` por proyecto para refrescar la misma URL y calcular deltas. Requiere sesión interactiva y login de claude.ai; `claude -p` no dispone de esa herramienta.

Esto es más que “Markdown con CSS”: hay un generador de HTML, un modelo de layout, un estado estructurado para refresh, publicación/versionado y un visor compartible. El archivo local encontrado en `tool-results/` es el resultado capturado por Claude, no necesariamente el registro completo de la URL publicada. Ver `artifact-hosting-proposal.md` para separar ese cache del Artifact online con URL, versiones y permisos.

## Qué ofrece OpenCode hoy

La documentación oficial actual de OpenCode V2 no describe un tipo de dato ni un visor llamado Artifact. OpenCode sí aporta las piezas para construirlo:

- `write`/`edit` y comandos para generar archivos;
- tools y plugins TypeScript/JavaScript locales en `.opencode/tools/` y `.opencode/plugins/`;
- hooks de plugin para controlar ejecución;
- `opencode serve`/`web` para exponer una sesión por HTTP;
- permisos configurables;
- posibilidad de ejecutar un servidor estático o abrir un navegador, si se autoriza explícitamente.

Eso permite generar un HTML local, pero no proporciona por sí mismo un servicio de publicación privada, URL estable, selector de versiones, comentarios o almacenamiento de artifacts equivalente al de Claude.

Fuentes oficiales consultadas:

- [OpenCode V2](https://opencode.ai/v2/docs)
- [Plugins](https://opencode.ai/docs/plugins/)
- [Custom tools](https://opencode.ai/docs/custom-tools/)
- [Tools y permisos](https://opencode.ai/docs/tools/)
- [Server](https://opencode.ai/docs/server/)

## Qué aporta Gentle-AI

Gentle-AI usa “artifact” en un sentido de trazabilidad: proposal, spec, design, tasks, verify-report y archive-report se guardan en OpenSpec y/o Engram según el modo elegido. Son artifacts técnicos estructurados, casi siempre Markdown/YAML/JSON; no son un visor visual ni una publicación HTML. La convención de Engram y OpenSpec es valiosa como fuente de estado y lineage, pero no debe confundirse con una solución de reportes visuales.

Fuentes actuales: [convención de artifacts de Engram](https://github.com/Gentleman-Programming/gentle-ai/blob/main/internal/assets/skills/_shared/engram-convention.md), [convención OpenSpec](https://github.com/Gentleman-Programming/gentle-ai/blob/main/internal/assets/skills/_shared/openspec-convention.md), y [repositorio Gentle-AI](https://github.com/Gentleman-Programming/gentle-ai).

## Opciones consideradas

| Opción | Resultado | Recomendación |
|---|---|---|
| OpenCode nativo | Genera archivos y puede servir una UI externa, pero no hay Artifact viewer/publicación equivalente verificada | No alcanza solo |
| Plugin comunitario | Puede resolver preview, TUI o browser, pero no encontramos evidencia de un plugin estable que replique estado, refresh, publicación privada y versionado | No usar como dependencia principal |
| Copiar el plugin Claude | Está atado a la herramienta Artifact y a `claude.ai`; no es portable | Rechazar |
| Renderer propio versionado | Permite HTML auto-contenido, datos explícitos, snapshots, revisión local y CI; puede funcionar con OpenCode, Claude y otros agentes | **Elegir como base** |
| SaaS/publicación externa | Facilita compartir, pero introduce secretos, red, lock-in y riesgo de publicar información de Hospeda | Opcional y posterior |

## Arquitectura recomendada

Construir una capa genérica, separada del modelo y del agente:

1. **Contrato de datos** versionado (JSON o YAML) con `schemaVersion`, `id`, `title`, `asOf`, `audience`, `status`, `sections`, `sources`, `decisions`, `risks`, `nextSteps` y `lineage`. El agente redacta datos; el renderer no inventa estado.
2. **Renderer HTML auto-contenido** (CSS inline, JavaScript pequeño y SVG inline cuando corresponda), con tema claro/oscuro, navegación por tabs, tablas scrolleables, filtros, búsqueda, copiar, impresión y exportación.
3. **Command/tool de OpenCode** `artifact-render` que recibe un archivo de datos validado y produce una página en una ruta indicada. Debe rechazar rutas fuera del worktree salvo autorización explícita.
4. **Skill `visual-report`** para decidir cuándo vale la pena generar HTML y para completar el contrato sin duplicar reglas del proyecto.
5. **Snapshot y refresh**: cada render conserva `artifact.json`, HTML y un hash de fuentes. Un refresh compara estado anterior y muestra delta. Git versiona el contrato y las plantillas; los HTML grandes generados pueden quedar fuera del commit si se reconstruyen determinísticamente.
6. **Preview local opt-in**: `hops artifact preview <path>` levanta un servidor local de solo lectura y devuelve URL/puerto; nunca abre red pública automáticamente.
7. **Publicación futura desacoplada**: adaptador separado para GitHub Pages, servidor interno o almacenamiento privado. No debe ser requisito del renderer ni de OpenCode.

La implementación genérica debería vivir en un repositorio/tooling común; Hospeda solo debe versionar sus schemas, fuentes, tema y adaptadores que son 100% propios. Un adaptador Linear debe producir datos, nunca HTML directamente.

## Seguridad y mantenimiento

- Sanitizar/escapar todo texto proveniente de Linear, Git, Engram o archivos.
- No incluir `.env`, tokens, URLs con credenciales, SQL con passwords ni datos de clientes en el HTML.
- Rechazar `<script>`/iframes externos por defecto; permitirlos solo con una política explícita. Preferir un archivo autocontenido.
- Registrar `asOf`, fuentes y hash de entrada para que el reporte no parezca evidencia fresca cuando la consulta falló.
- El HTML no debe mutar Linear, Git, Engram ni la base de datos. La edición es local y explícita; el “refresh” vuelve a generar desde fuentes.
- Validar tamaño, links, overflow y ausencia de secretos en CI/pre-commit.

## Decisión provisional

Usar **OpenCode + Gentle-AI como autores/orquestadores**, y un **renderer propio genérico** como capa visual. Mantener Markdown/JSON como fuente de verdad y HTML como representación derivada. No adoptar OpenChamber, browser o PTY como “sistema de artifacts”: pueden ayudar a visualizar o ejecutar el preview, pero no reemplazan el contrato, el historial ni la seguridad.

La decisión de publicar fuera de la máquina y la elección de framework de renderer quedan para una etapa posterior, después de probar un único report piloto con datos no sensibles.
