# Auditoría de versiones del ecosistema

Fecha de consulta: 2026-09-23.

Esta auditoría es read-only. No actualiza binarios, no ejecuta `sync`, no
modifica configuraciones y no toca la base de Engram.

## Estado instalado

| Componente | Instalado | Canal actual del plan | Estado |
|---|---:|---|---|
| OpenCode | 1.18.31 | V1 | Una versión V1 detrás de la última release consultada |
| Gentle-AI | 2.9.0 | V1-compatible | Muy atrasado; la línea estable actual es 3.7.0 |
| Engram | 1.20.0 | SQLite local | Muy atrasado; la línea estable actual es 2.0.0 |

## Fuentes actuales

- Gentle-AI releases: <https://github.com/Gentleman-Programming/gentle-ai/releases>
- Engram releases: <https://github.com/Gentleman-Programming/engram/releases>
- OpenCode releases: <https://github.com/anomalyco/opencode/releases>

## Hallazgos Gentle-AI

La release estable actual consultada inicialmente era `v3.6.1`; durante la
preparación del staging apareció `v3.7.0`, publicada el 23/09/2026, que pasa a
ser la candidata vigente.

- `v3.0.0` convirtió ODD en el protocolo predeterminado y simplificó SDD.
- `v3.5.0` activó RDD/review por defecto, salvo que exista una configuración que
  lo desactive.
- `v3.6.0` corrigió hooks, sincronización de assets y rutas de provisioning.
- `v3.6.1` mejoró los diagnósticos del registro de skills de OpenCode, eliminó
  una herramienta Pi conflictiva y ajustó el routing proporcional de ODD.
- `v3.7.0` agrega selección configurable de modelos nativos para agentes y
  reviewers en Claude Code, OpenCode y Codex, y corrige replay de autoridad bajo
  contención de locks. Declara no tener breaking changes; mantiene módulo `/v3`
  y provider contract `1.2.0`.
- La documentación oficial indica ejecutar `gentle-ai sync` después de actualizar
  para alinear binario, skills, reviewers y runtime assets.

Impacto para Hospeda:

1. No se debe actualizar encima de la instalación actual sin backup completo.
2. Hay que decidir explícitamente si RDD/review continúa desactivado, porque la
   línea 3.5+ lo activa por defecto.
3. Hay que revisar los assets generados por Gentle-AI después de `sync`; no basta
   con comprobar la versión del binario.
4. Hay que revalidar la interacción entre ODD, `AGENTS.md`, comandos Hops y el
   lifecycle híbrido `.specs`/SDD.

## Hallazgos Engram

La release estable actual consultada es `v2.0.0`, la primera release estable de
la línea v2, con cientos de cambios desde `v1.20.0`.

Cambios relevantes:

- nuevo módulo Go `/v2`;
- resolución de proyecto más estricta y scoping por proyecto;
- relaciones y conflictos persistentes;
- diagnósticos y reparación más completos;
- export/import que preserva relaciones y observaciones fijadas;
- integración OpenCode 1.x mejorada;
- sincronización Cloud opcional, sin reemplazar SQLite local como autoridad;
- nuevas protecciones contra observaciones sin título y referencias huérfanas.

Riesgos para la migración:

- la DB actual debe conservarse con múltiples backups antes de abrirla con v2;
- los proyectos ambiguos pueden dejar de resolverse implícitamente;
- el upgrade puede requerir migración de esquema y revisión de `doctor`;
- hay problemas conocidos de contención SQLite y sesiones OpenCode obsoletas;
- no debe activarse Cloud como parte automática de esta actualización.

La documentación de Engram indica que `engram setup opencode` apunta actualmente
a OpenCode 1.x; esto es compatible con nuestra decisión de permanecer en V1 por
ahora.

## Hallazgos OpenCode

La última release V1 consultada es `1.18.32`, una actualización pequeña respecto
de la instalada `1.18.31`. La diferencia publicada contiene correcciones de
Bedrock y reporting de uso de Together AI. No cambia la decisión de mantener V1.

OpenCode V2 aparece como una línea separada y no debe mezclarse con esta
actualización: Engram todavía documenta que su adapter dedicado para OpenCode 2.x
no está incluido.

## Plan de actualización recomendado

1. Mantener los pins actuales hasta completar el backup y la aprobación humana.
2. Crear un backup binario verificable de Engram, más una copia de configuración y
   checksums.
3. Instalar los nuevos binarios en un staging temporal, sin reemplazar los activos.
4. Validar `gentle-ai doctor`, `gentle-ai review mode status` y el inventario de
   assets antes de sincronizar.
5. Ejecutar la migración de Engram v2 sólo sobre una copia restaurada y comparar
   conteos, proyectos, observaciones y búsquedas.
6. Revalidar MCP, OpenCode V1, wrappers Hops, TUI, comandos, permisos y skills.
7. Recién después reemplazar los binarios activos y ejecutar `gentle-ai sync`.

No se debe usar `@latest` directamente en producción de la workstation sin
registrar primero la versión resuelta, checksum, release notes y procedimiento de
rollback.

## Evaluación de compatibilidad con lo ya implementado

La actualización no exige rehacer la arquitectura de Hops, Linear, worktrees,
envs, ramas, artifacts ni los comandos `hops-*`. Esas piezas ejecutan scripts
versionados del proyecto y no dependen de internals de Gentle-AI. Sí exige una
actualización controlada y una nueva ronda de validación:

| Componente | ¿Rompe automáticamente lo actual? | Cambio necesario |
|---|---|---|
| OpenCode V1 `1.18.31 → 1.18.32` | No esperado | Actualizar el pin y repetir smoke de TUI, MCP, providers y comandos. Es un parche de la misma línea V1. |
| Gentle-AI `2.9.0 → 3.7.0` | No por los scripts Hops; sí puede cambiar el comportamiento del agente | Sincronizar assets administrados, revisar ODD, validar los nuevos selectores de modelos y fijar explícitamente la decisión RDD/review. Revalidar `AGENTS.md`, skills, SDD, handoff y arranque de OpenCode. |
| Engram `1.20.0 → 2.0.0` | No es un reemplazo transparente | Migrar el esquema sobre una copia restaurada, comprobar proyectos y búsquedas, y hacer explícito el scoping del proyecto Hospeda en MCP/wrappers. |

El punto más delicado es Engram: el wrapper `hops engram` puede seguir delegando
los subcomandos, pero la resolución de proyectos de v2 es más estricta. Las
llamadas que antes dependían de un proyecto implícito o de mezclar proyectos
históricos deben probarse con un selector explícito. La DB activa no se debe
abrir con v2 hasta completar la copia verificable y la prueba de restauración.

Gentle-AI 3.7.0 tampoco invalida los comandos propios, pero `gentle-ai sync`
puede regenerar assets globales administrados por Gentle. Por eso debemos
comparar hashes antes/después y verificar que no sobrescriba silenciosamente
los comandos, skills y agentes específicos de Hospeda. La configuración de
review/RDD se debe registrar como decisión explícita; no conviene aceptar el
nuevo default por accidente.

Conclusión operativa: no hay que rediseñar lo ya hecho, pero tampoco es seguro
actualizar los tres binarios y asumir que todo seguirá igual. La actualización
requiere adaptación de pins, migración de Engram, revisión de assets de Gentle y
una batería de regresión. Hasta completar esos pasos, la instalación actual se
mantiene como rollback.

## Resultado del staging inicial

Se descargaron, sin activar, los siguientes artefactos oficiales:

- OpenCode V1 `1.18.32`: checksum `3046e0404fdc60fb80307e7a47824ba07477364178a4d09baa8548496dd6d43b`.
- Gentle-AI `3.7.0`: checksum `a730a61a43758f04cc9a4ac644945cc0e8652a1e33d6997a0a3d3f0044d2fff5`.
- Engram `2.0.0`: checksum `23be1c2ce9739c455097ff864736213717b925b3e8821a988dfc619685a5abd5`.

Los tres binarios aislados respondieron con su versión esperada. La validación
se limitó a los ejecutables principales; los archives también contienen helpers
y documentación que no deben ejecutarse como si fueran binarios. La DB activa de
Engram pasó `PRAGMA integrity_check = ok` en modo SQLite immutable y no se abrió
con el binario v2.

El staging queda pendiente de la prueba funcional: ejecutar Gentle con una
configuración global clonada, comparar assets antes/después de `sync`, y migrar
una copia de Engram v1 a v2 para comparar proyectos, conteos, búsquedas y MCP.

### Incidente de validación aislada

El archive de Engram contiene helpers además del ejecutable principal. Una
primera comprobación demasiado amplia intentó ejecutar un helper de Cloud con el
argumento `version`; falló porque no existe configuración Cloud y no llegó a
sincronizar. No se ejecutaron comandos de migración, repair, import, export ni
sync sobre Engram. La DB activa pasó después `PRAGMA integrity_check = ok` en
modo immutable. El procedimiento definitivo debe seleccionar únicamente los
binarios principales por nombre y nunca ejecutar todos los archivos extraídos.

## Resultado de la prueba funcional aislada

Engram `2.0.0` abrió una copia de backup mediante `ENGRAM_DATA_DIR`, migró su
esquema y quedó íntegra. Funcionaron las consultas explícitas por proyecto:
`stats --project hospeda`, `search --project hospeda`, `context --project hospeda`
y el arranque MCP con `--project hospeda`. El diagnóstico v2 encontró warnings y
bloqueos históricos (sesiones ambiguas, ownership y payloads legacy); no son
fallos introducidos por la migración, pero impiden declarar la memoria limpia.

Gentle-AI `3.7.0` ejecutó `sync` sólo dentro de un `HOME` temporal. Regeneró 40
assets administrados, incluyendo `AGENTS.md`, `opencode.json`, comandos/skills
SDD, plugin de skill registry y archivos compartidos. Esto confirma que el sync
puede modificar la configuración global y que debemos tomar backup y comparar
hashes antes de aplicarlo al entorno real. En la copia, `review mode status`
reportó RDD/review activado por default; la instalación real debe conservar la
decisión explícita de dejarlo desactivado mientras no cambiemos esa política.

## Activación parcial y bloqueo pendiente

Se activaron los binarios OpenCode V1 `1.18.32` y Gentle-AI `3.7.0` después de
crear el backup `20260923-pre-upgrade`. No se activó Engram v2. El doctor de
Gentle confirma que los binarios son correctos, pero deja el sistema `unhealthy`
hasta ejecutar `gentle-ai sync`, porque los assets instalados todavía registran
Gentle-AI `2.9.0`. La revisión automática bloqueó la ejecución de `sync` y del
comando persistente para desactivar RDD/review por considerarlos mutaciones
globales que requieren autorización explícita para ese alcance.

OpenCode `providers list` y `mcp list` tampoco pudieron completar en esta sesión
porque el runner no permite abrir su log en modo escritura. Esto queda separado
de la compatibilidad de la release y debe repetirse en una terminal normal luego
del sync.

## Sync global completado

Con autorización explícita se respaldó el launcher user-owned en
`20260923-pre-upgrade/gentle-ai-opencode-launcher-v1` y se ejecutó `gentle-ai
sync` con la release `3.7.0`. Gentle actualizó 59 assets administrados para
OpenCode, Engram, SDD, skills, permisos, GGA, tema y persona. El doctor quedó
saludable: 8 checks correctos, 0 fallos y 0 warnings; el handshake MCP de Engram
v1 respondió correctamente.

La política global RDD/review quedó explícitamente `off`. El launcher administrado
de Gentle dejó background agents de OpenCode activos (`policy effective: on`),
coherente con usar OpenCode y no instalar Pi. La configuración global de
OpenCode fue modificada por el sync y queda respaldada para comparar cualquier
personalización propia antes de cerrar la migración.

## Engram v2 activo

Con el backup `20260923-pre-upgrade` disponible se activó Engram `2.0.0`. La
migración de esquema terminó y la DB activa pasó `PRAGMA integrity_check = ok`.
Las operaciones explícitas `stats --project hospeda`, `search --project hospeda`
y el arranque MCP con `--project hospeda` funcionan.

`engram doctor` reporta 2 checks correctos y 7 hallazgos históricos: sesiones
ambiguas, mismatches de identidad/directorio, sesiones sin dueño, 19 referencias
huérfanas, 6079 payloads legacy sin campos requeridos y 6 destinos de sync
cerrados. No se ejecutó ninguna reparación, consolidación, borrado, importación,
exportación ni sync. Esos hallazgos quedan como backlog de curación; la memoria
no se declara limpia automáticamente por haber actualizado el binario.

El MCP directo de Engram v2 responde. Las consultas `opencode mcp list` y
`opencode providers list` continúan bloqueadas en este runner porque OpenCode no
puede abrir su log en modo escritura; debe repetirse en una terminal normal con
filesystem writable.

### Interpretación de los hallazgos bloqueantes

La cifra `6079` de `engram doctor` no representa 6079 observaciones actuales
rotas. Corresponde a mutaciones legacy de `sync_mutations` que carecen de campos
requeridos para replay; la tabla contiene 47.879 mutaciones pendientes dirigidas
al target Cloud, distribuidas entre sesiones, observaciones y prompts. Cloud no
forma parte de la arquitectura aprobada y no se debe reparar/reproducir ese
historial sin una decisión separada.

En la tabla actual `observations`, la inspección immutable encontró 33 filas sin
contenido, 16 sin título y 1 sin tipo; 25 están sin proyecto y 24 pertenecen a
`hospeda`. Esas cifras sí corresponden a la curación de memoria pendiente y no
deben confundirse con el backlog de replay Cloud.

## Lote A actual para revisión humana

Al abrir Engram v2, la intersección entre esos criterios produjo **49 filas
únicas** (32 sólo sin contenido, 15 sólo sin título, una sólo sin tipo y una
sin contenido ni título). Todas están activas y tienen sesión asociada; 25 no
tienen proyecto y 24 pertenecen a `hospeda`. Se generó un inventario temporal
con IDs y metadatos, sin títulos ni contenidos:
`/tmp/engram-current-incomplete-20260923.csv`.

Las decisiones humanas previas del lote A siguen registradas en la copia de
revisión de septiembre. No se aplicaron a la DB activa después del upgrade; la
próxima acción correcta es reconstruir una copia v2, revalidar esas decisiones
por ID y ejecutar cualquier soft-delete o ajuste sólo sobre la copia antes de
considerar importarlo.

## Pines versionados alineados

El bootstrap reproducible quedó alineado con el runtime activo: OpenCode
`1.18.32`, Gentle-AI `3.7.0` y Engram `2.0.0`. También se actualizaron
`@opencode-ai/plugin` y `@opencode-ai/sdk` a `1.18.32`, con integridades npm
verificadas. `ai-dev-workstation-bootstrap.sh --verify` pasa los tres pines sin
leer valores secretos ni escribir archivos.
