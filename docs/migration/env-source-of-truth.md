# Fuente de entorno local y sincronización de variables

Fecha: 2026-09-18.

## Hallazgos

- `hospeda-staging` es el checkout que `scripts/client-tools/install.sh`
  selecciona por defecto para ejecutar `hops`.
- El checkout local `hospeda-staging` está en la rama `staging`, pero quedó
  1.589 commits detrás de `origin/staging` al momento de esta inspección.
- `hospeda2` está detached en una revisión anterior y contiene los archivos
  locales ignorados del operador. `hospeda-staging` no contiene actualmente
  esos archivos, salvo los `.env.test`.
- Por lo tanto, hoy no es correcto afirmar que `hospeda-staging` sea una
  fuente completa de entorno: es la fuente de tooling, pero no de los valores
  locales.
- Los templates versionados (`.env.example`) y `ENV_REGISTRY` sí están
  preparados para detectar variables faltantes en CI. Los valores de secretos
  nunca deben entrar en Git ni sincronizarse automáticamente desde GitHub.

## Decisión adoptada

Separar tres responsabilidades:

1. **Código y tooling:** `hospeda-staging`, actualizado explícitamente desde
   `origin/staging`. `hops` debe ejecutarse desde esta copia estable.
2. **Contrato de entorno:** `ENV_REGISTRY`, schemas y `.env.example`, todos
   versionados. Este contrato determina nombres, pertenencia a cada app y
   variables obligatorias.
3. **Valores locales:** quedan en el checkout dedicado
   `hospeda-staging`. Se actualizó ese checkout con fast-forward hasta
   `origin/staging` y se reconciliaron sus archivos ignorados usando los
   valores actuales de `hospeda2` como entrada de esta única migración.
   `hospeda2` no queda como dependencia operativa.

La reconciliación conserva valores para claves vigentes, agrega claves nuevas
desde los templates, conserva las opcionales no configuradas como comentarios y
elimina claves que ya no existen en el contrato actual. La variable cruzada de
revalidación quedó alineada entre API y Web tomando API como fuente. No se
mostraron valores durante el proceso.

## Qué debe ocurrir al aparecer una nueva variable

### Guard remoto (obligatorio)

En cada PR, mantener los guards existentes:

- uso de `process.env` registrado en `ENV_REGISTRY`;
- schemas de API, web y admin alineados con el registro;
- `.env.example` regenerado y sin drift;
- reglas de nombres y prefijos;
- validación de Docker build args.

Esto evita que una variable nueva llegue a una rama sin contrato documentado.

### Preparación local (automática y segura)

Después de actualizar `hospeda-staging` y al crear/subir un worktree:

- ejecutar `wt-env-prepare.sh`;
- crear o completar cada archivo local desde `.env.example`;
- conservar cualquier valor existente;
- informar únicamente qué claves faltan o se agregaron, nunca sus valores.

La preparación no debe sobrescribir secretos existentes ni hacer pull de
credenciales desde un remoto.

### Sincronización de valores reales (explícita)

Cuando una variable nueva requiere un valor real, `hops env` debe ofrecer un
modo `plan` que compare sólo nombres y un modo `apply` explícito que copie el
valor desde la fuente local aprobada. El modo automático puede agregar
placeholders, pero no puede inventar ni propagar secretos.

## Propuesta de flujo operativo

1. `hops update` actualiza el checkout de tooling `hospeda-staging` y ejecuta
   los guards de contrato. El checkout es dedicado a tooling y sus archivos
   ignorados no se pierden con el reset de la rama.
2. `hops wt-create` usa `hospeda-staging` como fuente predeterminada de valores;
   `HOPS_ENV_SOURCE_ROOT` queda como override explícito para una recuperación o
   una máquina nueva.
3. `hops env` verifica las seis capas (`doctor`, local, rules, usage, registry,
   examples) y devuelve JSON consumible por OpenCode.
4. Antes de levantar servidores, `hops env` debe fallar si faltan variables
   obligatorias o si las variables cruzadas no coinciden.
5. Un merge que agrega una variable queda bloqueado por CI hasta actualizar el
   registro y los ejemplos. No se debe intentar resolverlo haciendo pull de
   archivos secretos.

## Política para mantener `hospeda-staging` actualizado

`hops update` ya hace `fetch origin/staging`, compara el commit remoto y aplica
un `reset --hard` sólo sobre el checkout dedicado de tooling. Como no se
autoran cambios de código allí, esto es seguro y preserva los archivos
ignorados de entorno. Debe ejecutarse al iniciar una sesión de trabajo, antes
de `start-issue`, `close-issue` y `wt-create` cuando el checkout esté obsoleto,
y después de un merge importante en `staging`.

La automatización no debe sobrescribir valores locales ni hacer pull de secretos
desde GitHub. Para una máquina nueva, el bootstrap debe crear el checkout,
ejecutar `hops update` y luego restaurar los archivos locales desde el backup
protegido.

## Pendiente antes de declarar el flujo completo

- `copy-env-to-worktree.sh` ya resuelve `hospeda-staging` por defecto; queda
  probarlo como parte del `wt-create` completo.
- Añadir un preflight de frescura a `start-issue`, `close-issue` y `wt-create`;
  por ahora el agente consulta el drift y `hops update` sigue siendo el paso
  explícito para actualizar el checkout remoto.
- Probar `wt-create`, `db-start` y `servers-up` desde esa fuente y verificar
  health checks de API, web y admin.
- El guard versionado de drift ya existe; falta conectarlo al preflight de
  frescura y validar el flujo completo sobre un worktree descartable.
