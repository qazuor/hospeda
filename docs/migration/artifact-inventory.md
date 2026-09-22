# Inventario de artifacts de Claude

Fecha: 2026-09-15. Relevamiento de nombres, tamaños, hashes y metadatos HTML; no se copiaron archivos ni se mostró contenido sensible.

## Hallazgo principal

Se encontraron **271 archivos HTML** bajo los `tool-results` de proyectos de Claude, con aproximadamente **50.3 MiB**. Por hash SHA-256 hay **232 grupos de contenido exacto**; 39 archivos son duplicados exactos. Por eso la cifra “aproximadamente 50 artifacts” subestima el material local: puede referirse a artifacts conceptuales o publicados, mientras que el cache local contiene múltiples renders y revisiones. El inventario publicado en claude.ai no pudo verificarse desde este entorno sin URLs/permisos, por lo que queda como **no verificado**.

Distribución de grupos de contenido por título normalizado (solo conteo):

| Familia | Grupos |
|---|---:|
| Issues / triage | 65 |
| Producto / paridad | 46 |
| Smoke / calidad | 35 |
| Análisis / planificación | 18 |
| Release / infraestructura | 17 |
| Presentaciones | 9 |
| Workflow / coordinación | 6 |
| Otros | 36 |
| **Total** | **232** |

Ubicación agregada:

| Proyecto de Claude | Archivos |
|---|---:|
| `hospeda2` | 224 |
| `HOS-1257 paridad billing verticales` | 38 |
| `HOS-978 presentaciones comerciales web` | 6 |
| `HOS-1207 callback URL` | 2 |
| `HOS-974 parity matrix` | 1 |

El formato capturado contiene un runtime/frame de Claude y referencias a capacidades del visor; por lo tanto **no conviene copiar esos HTML como si fueran documentos portables**. Hay que extraer el contenido de usuario, el estado, las fuentes y la intención, y regenerar una versión limpia.

## Priorización para revisión humana

Cada grupo debe recibir una ficha antes de migrarse, con:

- título y propósito;
- última fecha útil y fuente de datos;
- issue/spec/PR relacionado, si existe;
- audiencia y si se volvió a consultar;
- estado: conservar, regenerar, archivar o descartar;
- riesgo de contener datos sensibles;
- si necesita interactividad o basta Markdown.

### Candidatos iniciales a conservar o regenerar

- reportes de smoke y calidad que sirven para decisiones repetidas;
- planes de release/staging y tableros de worktrees si se actualizan desde fuentes vivas;
- matrices de paridad y estado de producto que tengan uso operativo;
- reportes de issues solo si expresan una decisión o backlog vigente, no si son fotos históricas del mismo conteo.

### Candidatos a archivar, no migrar automáticamente

- duplicados exactos o revisiones intermedias;
- “qué hacer con N issues” cuando existe una versión posterior o el backlog ya cambió;
- presentaciones únicas que no son documentación técnica viva;
- reportes cuyo contenido depende de una rama, base o staging ya inexistente;
- artifacts con datos sensibles hasta que se haga revisión y redacción manual.

## Procedimiento seguro de migración futura

1. Crear un manifiesto de solo lectura con hash, título, tamaño, timestamps, proyecto de Claude y relaciones detectadas; mantenerlo fuera del repo si contiene rutas personales.
2. Deduplicar por hash y elegir el render más reciente por grupo.
3. Revisar manualmente cada candidato; nunca dar por válido un artifact solo porque tiene un HTML bonito.
4. Extraer contenido y fuentes a un contrato `artifact.json` limpio; no conservar el wrapper/runtime de Claude.
5. Regenerar HTML con el renderer propio y comparar visualmente/contenido.
6. Versionar solo los artifacts aprobados y sus fuentes reproducibles.
7. Mantener los originales en el backup de Claude hasta completar la revisión y el rollback de la migración.

No se debe abrir una URL publicada, llamar a un endpoint de Claude ni importar en OpenCode sin una decisión explícita sobre privacidad y almacenamiento.
