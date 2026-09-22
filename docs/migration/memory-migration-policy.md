# Política de migración de memorias Claude → OpenCode/Gentle/Engram

Fecha: 2026-09-15.

## Inventario observado

- Hay `MEMORY.md` de Hospeda, Hospeda2, Hospeda3, portfolio y `tmp` dentro de
  `~/.claude/projects/`.
- Hospeda2 tiene además un índice de feedback separado.
- Existen memorias por worktree/área y documentación del plugin Engram.
- No se debe tratar cada `MEMORY.md` como memoria global ni importar todos sus
  contenidos a Engram.

La inspección estructural del árbol Claude encontró 566 archivos que coinciden
con `MEMORY.md` o notas bajo `memory/`. La mayor concentración es Hospeda2,
con 490 archivos y aproximadamente 1,4 MB, seguida por Hospeda con 59 archivos
y aproximadamente 186 KB. El inventario también incluye skills del plugin
Engram y un archivo `RETIRED.md`; esos artefactos no son candidatos automáticos
a memoria de proyecto.

El volumen confirma que una revisión completa debe hacerse por lotes pequeños,
pero la admisión seguirá siendo entrada por entrada. El tamaño o la fecha no
son criterios de importación.

La DB Engram cambió desde el inventario anterior: hay 149 observaciones menos,
todas asociadas al proyecto `hospeda`, y 5 observaciones nuevas. Antes de
reutilizar cualquier export previo hay que generar un inventario nuevo y tratar
esas 149 entradas como eliminadas, no como candidatas a restaurar. La auditoría
estructural sigue pasando, pero existen 97 referencias huérfanas
observación→sesión preexistentes que deben permanecer documentadas hasta una
reparación explícitamente aprobada.

Por familia nominal, el inventario contiene aproximadamente 297 `feedback`,
192 `project`, 29 `spec`, 8 `issue`, 7 `gotcha`, 5 `MEMORY.md` y un archivo
`RETIRED.md`, además de notas aisladas. Esto no determina la validez, pero sí
permite ordenar la revisión: primero `gotcha`/`issue` vigentes, luego decisiones
de `spec` y `project`, y por último `feedback` masivo. `feedback` no debe entrar
automáticamente porque suele describir correcciones puntuales ya incorporadas
en guards, tests o documentación.

Un filtro conservador por nombre detectó 68 archivos con términos que pueden
indicar secretos, autenticación, OAuth, cookies, SSH, API o credenciales. El
nombre no demuestra que contengan un secreto, pero esos archivos quedan fuera
de cualquier lote automático y requieren revisión manual sanitizada; nunca se
debe copiar su contenido al repositorio ni a Engram sin comprobarlo.

## Destino por tipo de conocimiento

| Contenido | Destino |
|---|---|
| reglas universales de trabajo | `AGENTS.md` breve |
| arquitectura y convenciones estables | skills project-locales |
| decisiones duraderas y gotchas verificados | Engram curado, con `topic_key` |
| procedimientos repetibles | `hops`, commands o documentación |
| estado de una issue/spec | Linear + `.specs` |
| handoff temporal | archivo/Engram con expiración o revisión |
| contexto histórico o contradicho | archivo histórico fuera del contexto automático |
| preferencias personales | perfil/memoria global sólo si siguen vigentes |

## Regla de admisión a Engram

Una observación sólo entra si es durable, verificable, accionable y tiene un
proyecto/topic claro. Se rechazan transcripciones, logs repetidos, comandos
efímeros, estados ya representados por Linear/Git y duplicados de skills.

## Validación individual obligatoria

Toda entrada candidata debe pasar una revisión uno por uno antes de moverse:

1. identificar origen, proyecto, fecha y topic;
2. leer la entrada completa en una copia de trabajo;
3. comprobarla contra código, configuración, `.specs`, Linear o documentación
   vigente según corresponda;
4. clasificarla como `vigente`, `vigente-con-ajuste`, `histórica`,
   `contradicha`, `duplicada`, `ruidosa` o `secreta`;
5. registrar la evidencia y el destino propuesto;
6. pedir revisión humana para `vigente-con-ajuste` y cualquier entrada que
   pueda cambiar comportamiento;
7. importar sólo las entradas aprobadas, con sus títulos/topics saneados;
8. volver a probar la búsqueda y el comportamiento después de la importación.

Una memoria no se mueve porque tenga un título útil, una fecha reciente o un
tipo `decision`. La evidencia actual y la aprobación de la clasificación son
obligatorias. Las entradas `contradicha`, `ruidosa` o `secreta` no se importan.

## Procedimiento seguro

1. Exportar/capturar los `MEMORY.md` sin modificar los originales.
2. Clasificar cada entrada por destino y vigencia.
3. Deduplicar contra `.specs`, docs y la copia auditada de Engram.
4. Convertir primero reglas estables a skills/AGENTS; no guardarlas también como
   memoria narrativa salvo que aporten una decisión histórica.
5. Importar a Engram sólo entradas aprobadas sobre una copia de trabajo.
6. Probar búsqueda por proyecto y topic antes de activar el MCP.
7. Mantener los originales Claude como rollback hasta validar varias sesiones.

## Recomendación

Conservar los `MEMORY.md` intactos durante la transición. Usarlos como fuente
de extracción, no como mecanismo runtime de OpenCode. Engram debe recibir una
selección curada y deduplicada; `AGENTS.md` y skills deben contener el
conocimiento operativo estable.

No se importó ni se modificó ninguna memoria en esta etapa.
