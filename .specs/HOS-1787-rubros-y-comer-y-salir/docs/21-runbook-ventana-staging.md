# HOS-1826 · 1.B8 · Runbook de la ventana de staging y marcha atrás (AC:1:11)

> Entregable de la hoja 1.B8. Lo ejecuta 1.B9 (HOS-1801): este documento no corrió nada, ni un `hops` remoto,
> ni Coolify, ni Cloudflare, ni PostHog, ni MercadoPago. Lo que no se pudo cerrar con el código queda marcado
> **[ABIERTO n]** y está en §6 con la opción recomendada y el paso en que se cierra.
>
> Fuentes: sub-spec 1 § «Partición y despliegue (DEC-FAC-030)» y § «Mecánica» punto 7
> (`../sub-specs/1-renombrado.md`), DEC-FAC-029, DEC-FAC-030, DEC-FAC-032 y DEC-FAC-061
> (`01-decision-log.md`), el corte V6 (`.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/30-el-corte.md`,
> pasos 2b y 3, la rama de aborto y sus riesgos), el ensayo real del paso 3 de HOS-1825 (1.B7) y los comandos de
> `hops`: el del VPS en `scripts/server-tools/src/index.ts` + `src/commands/` + `src/lib/`, el local en
> `scripts/client-tools/`. Todo leído en la umbrella `epic/HOS-1801-renombrado-fisico` en `abe861e88f`.

## 0. Reglas duras de esta ventana

1. **Nunca un redeploy sin que el owner lo confirme en el momento.** Un redeploy reconstruye la rama
   entera y publica todo lo acumulado, no sólo el cambio que se busca. Cada deploy de este runbook es un
   punto **«pausa: owner confirma»**.
2. **El rollout de Coolify sirve dos versiones a la vez durante unos 5 minutos**: viejo y nuevo conviven y
   el tráfico alterna (200/500/200/500). Ninguna verificación vale hasta que el contenedor viejo se fue; se
   comprueba repitiendo la misma petición varias veces y mirando que **todas** respondan igual.
3. **`app-restart` NO toma una variable de entorno nueva** (hace `docker restart`): después de un
   `env-set` va **`redeploy`**, nunca `app-restart`.
4. **`hops --target=staging health` smokea PRODUCCIÓN**: `health` tiene `targetPolicy: 'none'`, descarta
   `--target` y su entorno es posicional con default `prod`. Para staging es **`hops health staging`**.
5. `hops psql` con salida **vacía** es un error tragado, no «cero filas»; y una consulta que contiene la
   palabra `slug` puede tragarse entera. Toda consulta de verificación lleva un `select count(*)` que
   tiene que imprimir un número.
6. Nada se pushea a `staging`: la única vía es el PR de la umbrella (y, para volver atrás, un PR de
   revert). CI completo en verde antes de mergear.
7. Los pasos de Cloudflare los hace **el agente desde Chrome, con el owner ya autenticado**: son
   **«pausa: owner autentica»**. El agente no guarda ni pide credenciales.
8. **Nunca «Purge Everything» en Cloudflare**: `staging.hospeda.com.ar` y `hospeda.com.ar` son **una sola
   zona** (`packages/cache-tags/src/namespace.ts`), así que vaciar la zona vacía también producción. Se purga
   por tag con el prefijo de entorno de staging o por prefijo de URL completo, con su host.
9. `hops` del VPS se corre **por ssh y con login shell**, porque sin login shell no está en el PATH:
   `ssh -p 2222 qazuor@216.238.103.219 'bash -lc "hops …"'`. Lo mismo para los `docker …` de este
   documento. El `hops` local no tiene `redeploy`, `psql`, `exec`, `db-migrate --target`, etc. En este
   documento los comandos del VPS se escriben sin el envoltorio de ssh para que se lean.
10. **Antes de confiar en un `hops --target=staging`, comprobar en su salida que el recurso resuelto es de
    staging.** Si la línea `Resolved <kind> → container <nombre>` (la imprimen `redeploy` y `app-restart`) o la
    salida de `hops --target=staging find <kind> --verbose` (`Strategy:` y `coolify.resourceName=`) no nombra un
    contenedor `hospeda-<app>-staging`, **se corta ahí**. La trampa, medida en el código:
    - `findContainer` (`scripts/server-tools/src/lib/container-lookup.ts:247-275`) busca primero por la etiqueta
      `coolify.resourceName=hospeda-<app>-staging` (`lib/target.ts:71-75`). Si el contenedor de staging **no
      está corriendo**, cae a la imagen y después al **puerto expuesto** (3001 api, 4321 web, 3000 admin:
      `container-lookup.ts:141-148`), que es el mismo en los dos entornos. Con un solo contenedor que lo expone,
      el de prod, **lo elige sin avisar**.
    - Por eso, con la app de staging parada (de V2/V3 a V5/V6), `hops --target=staging redeploy|find|exec|logs|
      env-list|env-set|app-restart` sobre api, web o admin **apunta a PROD**. Hay dos observaciones reales de eso:
      `redeploy` y `env-set` matchearon prod con la api parada (21/10), y `env-list api` devolvió la lista de
      prod (28/10).
    - `env-list` (`commands/env-list.ts:88-89`) resuelve la app con ese mismo `findContainer` y después el UUID
      de Coolify desde las etiquetas del contenedor encontrado. Respeta `--target` **sólo si el contenedor de
      staging corre**, y su salida no nombra el contenedor (`env-list.ts:119-122`), así que no hay cómo verlo.
      **No se usa en esta ventana.**
    - `cron-list` no pasa por `findContainer`: le pega por HTTP a `HOSPEDA_API_URL`, con default
      `https://api.hospeda.com.ar` (`lib/api-client.ts:72`), así que **ignora `--target`**. **No se usa.**
    - `exec <kind> --env <prefijo>` siempre tapa los valores (`commands/container-exec.ts:91`): sirve para ver
      qué claves existen, nunca su valor.

## 1. Antes de la ventana

| # | qué | cómo | verificación |
|---|---|---|---|
| P1 | El PR de la umbrella a `staging` en verde, aprobado, `CLEAN` | `hops ci --wait` desde el worktree de la umbrella; `hops merge` (dictamina, no mergea) | exit 0 en los dos. **Ojo**: `hops ci --wait` justo después de un push mide el commit anterior (18 checks en 1 s = sospecha); `hops ci --wait --pr=N` ignora `--pr=` y mide el PR del cwd |
| P2 | **El ensayo del paso 3 sigue valiendo para el commit que se despliega** | `git diff --stat abe861e88f <SHA de P6> -- packages/db/src/migrations/ packages/seed/src/data-migrations/` | **cualquier** cambio en esas dos carpetas (una migración o data-migration nueva, o una editada, la `0148`, la `0180` y la `0181` incluidas) hace caducar el verde del ensayo (HOS-1825, en `abe861e88f`): se repite con `ensayo-paso3.sh` del kit de HOS-1825 antes de seguir |
| P3 | Ningún agente vivo en un worktree con base local | `git worktree list` + preguntar | el paso V4.1 borra **todas** las bases locales |
| P4 | Backup de la base de staging tomado y anotado | `hops --target=staging db-backup-now` (pausa: owner confirma). Postgres se resuelve por la etiqueta con el UUID de `HOPS_STAGING_POSTGRES_UUID` (`lib/target.ts:183-190`): mirar en la salida que el contenedor sea el de staging (regla 10) | nombre del objeto en R2 `manual/` anotado acá: `________`. **Sale sin cifrar** (ver P7) |
| P5 | Inventarios que se pierden con el reset, guardados **fuera** de la base | (a) preapprovals vivas del sandbox (insumo de V1), ancladas y sueltas; (b) `slug` e `id` de cada ficha de la vertical en staging, para la purga por tag de V6.2: `hops --target=staging psql "select count(*) from gastronomies"` y después la lista | (a) y (b) en un archivo local con fecha |
| P6 | SHA que se va a desplegar: el merge de la umbrella en `staging` | `git rev-parse origin/staging` después del merge | anotado: `________` |
| P7 | **Riesgo anotado: los backups de `hops db-backup-now` suben a R2 sin cifrar** | `db-backup-now.ts:73` cifra con GPG sólo si `BACKUP_PASSPHRASE` está en `scripts/server-tools/.env.local` del VPS, y hoy no está seteada | el owner lo leyó y decide **[ABIERTO 7]**. No bloquea la ventana de staging; pesa más en el 2b de prod (§3.2) |
| P8 | **Checkout del VPS anotado** (se usa en V4.3) | `git -C "$HOPS_REPO_ROOT" status -sb` | rama y SHA anotados: `________` |

**Cuándo se mergea el PR de la umbrella**: al final de la preparación, con la API vieja todavía arriba.
El merge no despliega (el auto-deploy está apagado por política), y V4.3 necesita ese commit en el
checkout del VPS. Que el auto-deploy de las tres apps de staging siga apagado en Coolify el día de la
ventana no se verificó **[ABIERTO 8]**: si estuviera prendido, el merge desplegaría la imagen nueva antes
del reset, sobre una base que la 0180 rechaza.

**No hace falta avisar a clientes por la ventana de staging**: no tiene clientes reales. El aviso en persona
del owner es del corte de prod (§3.2, paso C0).

## 2. La ventana, en su orden fijo (DEC-FAC-030)

### V0 · leer las variables de staging con las apps todavía corriendo

Va primero porque, con las apps paradas, nada de `hops` llega a staging (regla 10). Por ssh, con
`docker inspect` sobre el contenedor filtrado por etiqueta:

```sh
for app in api web; do
  c=$(docker ps -q --filter label=coolify.resourceName=hospeda-$app-staging)
  test -n "$c" || { echo "sin contenedor de $app"; exit 1; }
  docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -E '^(HOSPEDA_DEPLOY_ENV|HOSPEDA_CRON_ADAPTER|HOSPEDA_REDIS_URL)='
done
```

- `HOSPEDA_DEPLOY_ENV` tiene que dar **el mismo valor en api y en web, y ese valor tiene que ser `preview`**.
  Es el `<env>` de la purga por tag de V6.2. Si difieren o no es `preview`, **no se purga por tag**: un `<env>`
  deducido purga otro entorno o no purga nada (`packages/cache-tags/src/namespace.ts`). Alternativa equivalente:
  leerlas en el panel de Coolify.
- `HOSPEDA_CRON_ADAPTER` de la api: anotarlo (se espera `node-cron`).
- `HOSPEDA_REDIS_URL` de la api: anotar **host y número de base** (el path `/<n>`; sin path es la 0). No se
  copia la contraseña al runbook ni a ningún archivo. Es el insumo de V5.5 y de **[ABIERTO 5]**.

### V1 · cancelar las preapprovals huérfanas del sandbox de MercadoPago

**Por qué primero**: el ancla local de cada preapproval es `provider_link.provider_id` (y, para las sueltas
de checkouts abandonados, el `payer_email` que lee el barrido de creaciones). El reset de V4 borra esa
ancla; una preapproval `authorized` en el sandbox que sobreviva no tiene después fila que la explique, y
la siguiente prueba de checkout del smoke la ve como desconocida.

1. Leer las ancladas (sólo lectura):
   `hops --target=staging psql "select count(*) from provider_link where cancelled_seen_at is null"` →
   tiene que imprimir un número; después la lista de `provider_id` de esas filas.
2. Las **sueltas** (checkouts abandonados que crearon una preapproval sin fila en `provider_link`): sacar de
   staging los `payer_email` de los checkouts pendientes, con un `select count(*)` antes que la lista, y buscar en
   el **sandbox** las preapprovals de cada `payer_email` (búsqueda de preapprovals por email del pagador). Las
   que no estén en la lista del punto 1 y no estén `cancelled` entran a la lista.
3. Cancelar cada una en el **sandbox** y releerla por id hasta verla `cancelled`.
4. Guardar la lista con su estado final fuera de la base (P5 a).

- **Herramienta**: **no existe una para staging** **[ABIERTO 1]**. `scripts/cutover/cli.ts` (U3) cancela «todo lo
  que el sistema viejo dejó vivo» leyendo la base vieja de prod por ids conocidos; no está escrito para el
  esquema de staging ni para el sandbox.
- **Si falla**: una preapproval que no queda `cancelled` después de reintentar → **no se sigue** a V4.
  No se puede volver atrás de un reset para buscar el ancla.

### V2 · bajar web y admin

- **Cómo**: «Stop» de `hospeda-web-staging` y `hospeda-admin-staging` en el panel de Coolify
  (`https://coolify.hospeda.com.ar`). `hops` no tiene un comando de stop (`app-restart` y `restart`
  reinician, no paran). Si conviene `docker stop` por ssh es **[ABIERTO 2]**.
- **Verificación del contenedor** (no con `hops … find`, que con la app parada encuentra la de prod):
  `docker ps --filter label=coolify.resourceName=hospeda-web-staging` y lo mismo con `hospeda-admin-staging`
  → **salida vacía** (sólo la cabecera).
- **Verificación desde afuera**, tres veces seguidas, rompiendo el cache con una query distinta cada vez:
  `curl -sS -D - -o /tmp/cuerpo "https://staging.hospeda.com.ar/?nocache=$(date +%s%N)"` (y lo mismo contra
  `https://staging-admin.hospeda.com.ar/`). Tiene que dar 5xx, **`cf-cache-status` distinto de `HIT`** y un
  cuerpo que sea la página de error del proxy, no HTML de la app. Un 5xx con `cf-cache-status: HIT` es una
  respuesta vieja del borde y no prueba nada.

### V3 · apagar la API vieja: contenedor, crons y webhook, verificado (F-V2-019)

**Por qué**: entre el reset y el deploy, la API vieja sirve 500 sobre una base sin la tabla vieja de la
vertical, y sus crons escriben valores viejos (`quota_window`, `domain_event`, `email_outbox`) que el código
nuevo no lee.

1. «Stop» de `hospeda-api-staging` en el panel de Coolify. Con el contenedor parado se van los tres a la vez:
   los crons corren en el mismo proceso cuando `HOSPEDA_CRON_ADAPTER=node-cron` (leído en V0) y el webhook
   (`/api/v1/webhooks/mercadopago`) lo atiende ese mismo proceso.
2. Verificar, los tres:
   - contenedor: `docker ps --filter label=coolify.resourceName=hospeda-api-staging` → **salida vacía**;
   - crons: si V0 dio `node-cron`, el contenedor vacío ya prueba que no hay crons. Si dio otro adapter, se
     frena: los crons viven en otro lado y este runbook no los cubre. **No** usar `hops cron-list` (ignora
     `--target` y le pega a prod) ni `hops --target=staging logs api` (con la api parada lee los logs de prod);
   - webhook: `curl -sS -D - -o /tmp/cuerpo -X POST "https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago?nocache=$(date +%s%N)"`
     → 5xx, sin `cf-cache-status: HIT` y con el cuerpo del proxy, tres veces seguidas (un 401/400 del handler
     = la API sigue viva).
- **Si falla**: cualquiera de los tres responde → no se sigue a V4.

### V4 · resetear: `hospeda_dev` primero, después plantilla, staging y worktrees (F-V2-043)

La `0180_venue_rename` empieza con `RAISE EXCEPTION 'HOS-1787: esta base necesita reset (DEC-FAC-029)'` si
encuentra la fila vieja en `vertical`: una base que se saltee el reset falla con ese mensaje, no a medias.

**V4.1 · `hospeda_dev` (local, máquina del owner)**. Desde el **clone principal** (nunca dentro de un
worktree), con el código del commit de P6: `pnpm db:fresh-dev`. Hace `docker compose down -v` (borra el
**volumen entero**: `hospeda_dev`, la plantilla y **todas** las bases de worktree), migra, aplica extras,
siembra, estampa el ledger del seed y crea los usuarios de prueba. Verificación:
`psql … -c "select count(*) from venues"` imprime un número y
`psql … -c "select count(*) from vertical where id = 'venue'"` da 1.

**V4.2 · `hospeda_template` (local)**: `hops db-update-template build-candidate <nombre>` → revisar con
`hops db-update-template status` → `hops db-update-template promote <nombre> --confirm`. (Alternativa del
skill de worktree: `bash ~/.claude/skills/worktree/scripts/wt-db.sh build-template`.) Nunca borrar el
template a mano.

**V4.3 · base de staging (VPS)**. Se migra **sobre el commit de la imagen nueva**, y la igualdad de commit se
verifica **antes** del reset, porque `hops db-migrate` no tiene guarda de SHA (sí la tiene `cutover-step-3`):

1. `git -C "$HOPS_REPO_ROOT" status -sb`: árbol limpio y la rama anotada en P8. Si hay cambios sin commitear, se
   para. Que esa rama sea `staging` es **[ABIERTO 3]**.
2. `git -C "$HOPS_REPO_ROOT" pull --ff-only` (si la rama no es `staging`, hacer antes
   `git -C "$HOPS_REPO_ROOT" checkout staging`).
3. `git -C "$HOPS_REPO_ROOT" rev-parse HEAD` = **el SHA de P6**. Si no coincide, **se para acá, antes de
   tocar la base**.
4. `hops --target=staging db-migrate --reset --no-pull --yes` → backup previo a R2 (salvo `--no-backup`,
   que no se usa), reset del schema, `drizzle-kit migrate`, `db:apply-extras`, desde el checkout ya verificado.
   **Pausa: owner confirma**: es destructivo. Mirar en la salida que el contenedor de Postgres sea el de
   staging (regla 10).
5. Sembrar: `hops --target=staging db-seed --no-pull` (los defaults ya son reset + required + example; el
   comando sólo acepta `--no-reset`, `--no-required` y `--no-example`) y
   `hops --target=staging db-seed-test-users --no-pull`.
6. Ledger del seed: una base recién sembrada no tiene filas en `seed_migrations`; `db:fresh` lo resuelve
   con `seed --data-migrate --baseline-stamp`, y **`hops db-seed` no lo hace** (no hay `--baseline-stamp` en
   `scripts/server-tools/src/commands/db-seed.ts`). Sin ese paso, el próximo
   `hops --target=staging db-seed-migrate` corre todas las data-migrations sobre datos nuevos.
   Cómo se estampa en el VPS es **[ABIERTO 4]**.
7. Verificar: `hops --target=staging psql "select count(*) from venues"`,
   `… "select count(*) from vertical where id = 'venue'"` (= 1),
   `… "select count(*) from drizzle.__drizzle_migrations"` (= 182 en `abe861e88f`; si P2 sumó migraciones,
   las entradas del journal del commit de P6). Y `hops --target=staging db-seed-migrate --status`, sabiendo que
   **`--status` nunca hace pull** (`commands/db-seed-migrate.ts:237-247`: sale antes del paso de pull, con o
   sin `--pull`) y lee el checkout tal como está. Vale porque los pasos 1 a 3 ya lo dejaron en el SHA de P6;
   sobre un checkout viejo dice «0 pending».
8. **Devolver el checkout a la rama anotada en P8** (`git -C "$HOPS_REPO_ROOT" checkout <rama de P8>`) si no
   era `staging`. **Advertencia**: mientras ese checkout esté en el commit de la umbrella, un
   `hops --target=prod db-migrate --no-pull` corrido sobre él le aplicaría a **prod** las migraciones del
   renombrado fuera del corte. Nadie corre nada contra prod desde ese checkout hasta que vuelva a su rama.

**V4.4 · bases de worktree**: quedaron borradas por el `down -v` de V4.1; cada worktree se re-clona de la
plantilla nueva con `hops servers-up` (auto-heal de la base). Avisar en cada sesión viva.

### V5 · desplegar la API (crons y webhook vuelven con ella)

1. Deploy de `hospeda-api-staging` **desde el panel de Coolify** («Deploy»/«Redeploy» de esa aplicación),
   **pausa: owner confirma**. **No** con `hops --target=staging redeploy api`: con la api parada, `findContainer`
   resuelve la de prod y redesplegaría prod (regla 10).
2. Esperar a que el rollout termine (regla 2): repetir
   `curl -sS "https://staging-api.hospeda.com.ar/health?nocache=$(date +%s%N)"` hasta que **todas** las
   respuestas sean iguales durante un minuto.
3. `hops health staging` (nunca `--target=staging health`).
4. Crons de vuelta: con la api corriendo, `docker ps --filter label=coolify.resourceName=hospeda-api-staging`
   da un contenedor; el adapter se lee como en V0 (`docker inspect`, `HOSPEDA_CRON_ADAPTER=node-cron`) y los
   registros con
   `docker logs --since 5m $(docker ps -q --filter label=coolify.resourceName=hospeda-api-staging) 2>&1 | grep -i cron`.
   `hops --target=staging env-list api --reveal --match '^HOSPEDA_CRON_ADAPTER$'` y
   `hops --target=staging logs api --since 5m -g cron` sirven ahora que la api de staging corre, pero sólo si
   `hops --target=staging find api --verbose`, en el mismo momento, muestra la estrategia por etiqueta y
   `hospeda-api-staging` (regla 10). `cron-list` no se usa.
5. Invalidar la generación global del cache del conjunto efectivo (Mecánica 7). Es lo mismo que hace
   `invalidateAll()` (`packages/verticals/src/effective-set-cache/cache.ts:173-179`): `INCR` de
   `vset:v1:gen:all` y `PEXPIRE` de 30 min (`GENERATION_TTL_MS`, `cache.ts:5`). El campo de la vertical vieja de
   los hashes queda huérfano. Con la base anotada en V0:

   ```sh
   hops --target=staging exec redis -- redis-cli -n <base de V0> INCR vset:v1:gen:all
   hops --target=staging exec redis -- redis-cli -n <base de V0> PEXPIRE vset:v1:gen:all 1800000
   ```

   (`-n` es el `SELECT` de la base.) Redis se resuelve por la etiqueta con el UUID de `HOPS_STAGING_REDIS_UUID`;
   mirar en la salida que el contenedor sea el de staging (regla 10). La autenticación de `redis-cli` y si
   staging comparte instancia con prod son **[ABIERTO 5]**.

### V6 · desplegar web y admin; purgar cache y actualizar Cloudflare y PostHog (Mecánica 7)

1. Deploy de `hospeda-web-staging` y `hospeda-admin-staging` **desde el panel de Coolify**, **pausa: owner
   confirma**, cada uno. No con `hops … redeploy`, por la misma razón que V5.1. Misma espera de rollout.
2. **Cloudflare (pausa: owner autentica; lo hace el agente en Chrome)**, **en el mismo momento**, no después.
   `<env>` es el valor de `HOSPEDA_DEPLOY_ENV` leído en V0, que tiene que ser `preview` en api y en web. **Nunca
   se escribe un `<env>` deducido**: sin esa lectura, no se purga por tag, sólo por prefijo.
   - **Purga por tag**, todos con el prefijo `<env>:`. Los nombres salen de
     `packages/cache-tags/src/vocabulary.ts`. Los viejos los emitía `origin/staging` hasta el merge, y los
     nuevos son los de la umbrella:

     | qué | tag viejo (antes del merge) | tag nuevo |
     |---|---|---|
     | listados de la vertical | `<env>:list-gastro` | `<env>:list-venue` |
     | cada ficha, por slug **y** por id (`buildEntityCacheTags` emite los dos) | `<env>:gastro-<slug>`, `<env>:gastro-<id>` (con la lista de P5 b) | `<env>:venue-<slug>`, `<env>:venue-<id>` |
     | home (lista fichas destacadas) | `<env>:home` | igual |
     | todo staging | `<env>:all` | igual |

     El de `<env>:all` es el que más cubre y el único que alcanza una respuesta vieja aunque falte un slug
     en P5 b, porque toda respuesta cacheable lo lleva además de sus tags. Los demás van igual, por si quedó
     alguna respuesta anterior a ese tag. Cloudflare compara tags sin distinguir mayúsculas.
   - **Purga por prefijo de URL completo** (host + ruta), para `es`, `en` y `pt`. Host
     `staging.hospeda.com.ar`; rutas `/<lang>/gastronomia/`, `/<lang>/comer-y-salir/`,
     `/<lang>/planes/gastronomia/`, `/<lang>/planes/comer-y-salir/`, `/<lang>/presentacion/gastronomia/`,
     `/<lang>/presentacion/comer-y-salir/`, `/<lang>/publicar/gastronomia/`, `/<lang>/publicar/comer-y-salir/`,
     `/<lang>/publicar-restaurante/`. Por ejemplo, `staging.hospeda.com.ar/es/comer-y-salir/`. Cubre lo que se
     cacheó sin tag, como los redirects.
   - **Reglas**: aplicar a mano las de `infra/cloudflare/rules/cache-rules.md` y
     `infra/cloudflare/rules/redirect-rules.md` tal como queden en el commit de P6 (las expresiones de
     `cache-rules.md:110-115` y `:513-518` ya listan los dos prefijos). **Antes** de tocar nada, copiar las
     reglas del panel tal como están: la vuelta de §3.1 las necesita.
3. **PostHog (H5)**: la propiedad de persona nueva `is_venue_owner` (`packages/analytics/src/shared.ts:61`)
   **parte de cero**. Toda persona identificada antes conserva sólo la vieja `is_gastronomy_owner`, y la
   conserva hasta que vuelva a iniciar sesión. Así, un dashboard, insight o cohorte que filtra por la vieja
   se vacía de a poco y uno que filtra sólo por la nueva arranca vacío.
   - **Cómo**: listar los insights, dashboards, cohortes y feature flags que nombran `is_gastronomy_owner`.
     En cada filtro, poner `is_venue_owner = true` **OR** `is_gastronomy_owner = true`, y no un reemplazo:
     es la segmentación por las dos de DEC-FAC-032 (e). El OR es además lo único seguro si staging y prod
     comparten proyecto de PostHog, porque prod sigue emitiendo la vieja hasta el corte.
   - **Quién**: **[ABIERTO 6]**.
4. Smoke de la ventana (AC:1:13, etiqueta `status-needs-smoke-staging`, lo firma 1.B9): redirects **302**
   (incluido `/carta/` y un `/qr/<slug>/` de un salto), alta y edición de un local, checkout de un plan de la
   vertical con «Comer y salir Básico» en el resumen de MP, fotos de ejemplo bajo `venues/` en Cloudinary,
   cache. Se firma con `/smoke HOS-N` o la skill `smoke-tanda`.

## 3. Marcha atrás (DEC-FAC-061)

**No hay migración inversa** y no se escribe una: no puede deshacer un catálogo que nació `venue`
(triggers de `extras/041`, G18, FK compuestas con la vertical) y Drizzle sólo va hacia adelante.

### 3.1 En staging: revert + otro reset

1. Rama nueva desde `origin/staging`, `git revert -m 1 <merge-de-la-umbrella>`, PR a `staging`, CI completo
   verde, merge. El revert deshace también las cinco migraciones editadas (0129/0132/0139/0144/0176), la 0180,
   la 0181 y los extras, así que el catálogo vuelve a nacer con el nombre viejo. La 0181 no tiene que ver con el
   renombrado (recrea un CHECK con la definición de la 0009), así que revertirla no cambia nada en una base
   reseteada.
   - **Título del PR**: un `[HOS-1801]` en el título dispara la automatización de Linear (mueve el issue al
     abrir y al mergear, sin magic word). Usar `[NOSPEC:revert-venue-rename] revert(…)`, o, si se pone el tag,
     revisar el estado de HOS-1801 al abrir y al mergear y corregirlo a mano.
   - **Volver a intentar después**: con el revert mergeado, git considera que los commits de la umbrella ya
     están en `staging`; volver a mergear la umbrella no trae nada. El reintento es **revertir el revert** (otro
     PR), más los arreglos.
2. **La misma ventana, en sentido inverso**, con el mismo orden: V0, V1 (cancelar ahora las preapprovals del
   soak, que el sandbox muestra con títulos «Comer y salir …»), V2, V3, V4 con el código revertido (incluido
   `hospeda_dev`, plantilla y worktrees), V5 (con el `INCR` + `PEXPIRE`), V6: purga con los tags nuevos
   (`<env>:list-venue`, `<env>:venue-<slug>`/`<id>`, `<env>:all`), los mismos prefijos y las reglas de
   Cloudflare devueltas a la copia guardada en V6.2. En PostHog no hay nada que deshacer: el OR sirve igual.

### 3.2 En prod: restaurar el backup del paso 2b

Prod no recibe el renombrado por separado: viaja en la ventana del corte V6, que ya es sin convivencia, y lo
ejecuta el paso 3. Este runbook no ejecuta el corte; deja escrito lo que el corte necesita saber del renombrado.

**Lo medido el 2026-10-28 (HOS-1825, ensayo real sobre un dump de prod)**:

- Prod corre **PostgreSQL 17.10**.
- Migraciones pendientes en prod: **0125…0181**, 57 en una transacción (ledger 125 → 182). La
  `0181_hos1825_moderation_kind_check` es nueva del corte: corrige una deriva previa de prod en
  `ck_content_moderation_terms_kind`.
- Ledger del seed de prod: **16 data-migrations pendientes**, la `0107-hos-1034-backfill-content-media-again`
  incluida (está en `main` y faltaba en prod).
- El ensayo dio **verde en `abe861e88f`**. Cualquier cambio en `packages/db/src/migrations/` o en
  `packages/seed/src/data-migrations/` después de ese commit hace caducar el verde, y se repite
  (`ensayo-paso3.sh` del kit de HOS-1825; ver P2).
- Sigue abierto, del ensayo: no corre `db:seed:migrate` con `NODE_ENV=production`.

**Pasos que el corte tiene que traer por el renombrado**:

| # | qué | quién |
|---|---|---|
| C0 | **Avisar en persona a los clientes** (las cinco cuentas) **antes** del corte. Es un paso explícito, no un correo ni un banner | owner |
| C1 | El backup del 2b. Si se toma con `hops --target=prod db-backup-now`, **sube a R2 sin cifrar** mientras `BACKUP_PASSPHRASE` no esté seteada (P7, **[ABIERTO 7]**). Anotar el **nombre exacto** del objeto (`manual/hospeda-postgres-<TS>.dump`). Antes, `hops --target=prod r2-lifecycle show`: la regla por defecto borra `manual/*` a los 30 días (`commands/r2-lifecycle.ts:28`), y el 2b tiene que sobrevivir hasta el reintento | owner confirma |
| C2 | Después del deploy: el `INCR` + `PEXPIRE` de V5.5 en el Redis de prod; la purga de V6.2 con el `<env>` leído de las apps de prod (tiene que ser `prod`) y los prefijos de URL completos con los dos hosts, `hospeda.com.ar` y `www.hospeda.com.ar`; y las reglas de Cloudflare | agente (Chrome, owner autenticado) |
| C3 | PostHog: si el proyecto es otro que el de staging, el mismo OR de V6.3 | **[ABIERTO 6]** |

**Volver atrás** es la **rama de aborto del corte**: restaurar el backup del paso 2b, volver a la imagen vieja,
reencender su webhook y sus crons (lo inverso de `DB-5`) y correr los inversos (b) y (c) de U3
(`scripts/cutover/cli.ts --abort-inverse <manifest.json> --confirm-abort-inverse`). La regla del 0b (sólo
lectura) queda puesta hasta el reintento, y el owner les avisa a las cinco cuentas.

- Restauración: `hops --target=prod db-restore` **eligiendo en el picker el objeto por el nombre anotado en
  C1**, no por índice: el índice `N` sale de la lista ordenada del bucket en ese momento, y un backup nuevo (el
  cron diario, o el snapshot que el propio `db-restore` saca a `manual/pre-restore-<TS>.dump`) lo corre. Si el
  objeto termina en `.dump.gpg`, lo descifra. Es destructivo y lo hace el **owner**. La imagen vieja vuelve con
  «Redeploy» de la entrada previa en Coolify → Deployments (`docs/runbooks/rollback.md`), **owner confirma**.
- **Riesgo del corte que aplica acá, `F-8V3C2-003`** (`30-el-corte.md:408-412`): después de un aborto, `main`
  sigue con el sistema nuevo, porque la promoción `staging → main` es parte del paso 3 y la rama de aborto
  redespliega la imagen vieja sin revertirla. El primer despliegue de `main` después del aborto (un hotfix, o
  una variable de entorno que pide redesplegar) sube el sistema nuevo, renombrado incluido, sobre la base vieja
  restaurada y corre sus migraciones. Mientras no se revierta esa promoción, **nada se redespliega en prod**.
- **El límite que DEC-FAC-061 no dice y el corte sí**: la rama de aborto cubre **hasta que termina el paso 3**
  (despliegue sano, cinco pruebas escritas, 3b verificado, sonda del 4b cancelada). **Pasado el paso 3,
  sólo hacia adelante** (owner 2026-09-25, `30-el-corte.md` § «El rollback del programa»). Un defecto del
  renombrado que aparezca después se arregla sobre el sistema nuevo; no hay backup del 2b que restaurar
  sin perder lo que el sistema nuevo ya escribió.
- Después de restaurar: purga de Cloudflare con los tags nuevos y `prod:all`, y el `INCR` + `PEXPIRE` de Redis.
  Los dos viven fuera de Postgres (§4).

## 4. Lo que NO vuelve solo

Ni el revert + reset de staging ni la restauración del 2b en prod tocan lo que vive fuera de la base o
del repo. La lista de la sub-spec es el piso (correos, buscadores, redirects cacheados y cache de
Cloudflare); el resto sale del código y de la spec:

| qué | dónde vive | por qué no vuelve | qué hacer |
|---|---|---|---|
| **Correos ya enviados** con «Comer y salir» y enlaces `/comer-y-salir/…` | proveedor de correo, bandejas | un correo no se deshace (`R5-20`); los enlaces quedan 404 tras volver atrás | aceptado; en staging son casillas de prueba |
| **Propiedades y eventos de PostHog**: `is_venue_owner` puesta en cada persona que inició sesión, y eventos con `vertical: 'venue'` | PostHog | las propiedades de persona quedan puestas; los eventos quedan en la historia | aceptado (DEC-FAC-032 (e)); el filtro OR de V6.3 sirve en los dos sentidos |
| **Fotos subidas bajo `venues/`** (las del seed y las que suba alguien en el soak) | Cloudinary | ningún backup de base restaura almacenamiento externo; tras volver atrás el código vuelve a la carpeta vieja y las de `venues/` quedan huérfanas | borrar a mano la carpeta `venues/` de staging si molesta |
| **Preapprovals creadas en el soak**, con título «Comer y salir Básico» y equivalentes (`plan.name`) | MercadoPago (sandbox en staging) | el título en MP no se reescribe; el reset borra el ancla | cancelarlas en el V1 de la vuelta (3.1) |
| **Redirects 301 cacheados por navegadores**: `publicar-restaurante` ya responde 301 directo a `/publicar/comer-y-salir/` (`apps/web/src/pages/[lang]/publicar-restaurante/index.astro`) | navegador de cada visitante | un 301 queda grabado y no se deshace; tras volver atrás esos navegadores van a una ruta que no existe | aceptado; por esto los demás son 302 durante el soak |
| **Redirects 302** de las rutas viejas a `/comer-y-salir/…` (`RETIRED_ROUTE_REDIRECT_STATUS = 302`, `apps/web/src/lib/legacy-redirects.ts:43`) | cache de Cloudflare (si un navegador cachea esos 302 no se midió, **[ABIERTO 9]**) | la regla de cache del borde los guarda | purga por prefijo (V6.2) |
| **Cache de Cloudflare**: páginas bajo `/comer-y-salir/` y tags `<env>:list-venue`, `<env>:venue-<slug>`/`<id>` | borde | no lo toca ni un deploy ni un restore | purga a mano, con `<env>:all` |
| **Reglas de Cloudflare editadas a mano** | panel de Cloudflare | el revert del repo no las cambia | devolverlas a la copia guardada en V6.2 |
| **Índices de buscadores e IndexNow**: URLs `/comer-y-salir/` ya enviadas y rastreadas, sitemap | Google/Bing | lo indexado no se des-indexa por un revert | aceptado; las URLs viejas siguen respondiendo |
| **Generación del cache del conjunto efectivo** (`vset:v1:gen:all`) y los campos por vertical de los hashes | Redis (no es la base) | un restore de Postgres no toca Redis | `INCR` + `PEXPIRE` de `vset:v1:gen:all` también en la vuelta |
| **Ids de What's New y clave del tour** (`web.venue.welcome`) que reescribe la data-migration `0131-hos1822-venue-whats-new-and-tour-ids` | `users.settings.onboarding` | en staging el reset borra todos los usuarios igual (todos vuelven a ver todo: no hay nada que recuperar); en prod **sí vuelven** con el restore del 2b. No vuelven si alguien «vuelve atrás» sólo el código sin la base (no permitido) | ninguno, salvo no separar código y base |
| **`domain_event` con `entity_type` nuevo** escritos en el soak | Postgres, append-only (`extras/056`) | no se pueden actualizar | staging: los borra el reset; prod: los borra el restore |
| **Sesiones abiertas**: cookie cache de Better Auth (`session.user.role`, hasta 5 min) y `sessionStorage.authMeSnapshot` con `roles: ['VENUE_OWNER']` en pestañas abiertas (`apps/web/src/lib/auth-cache.ts:29`) | navegador | sobreviven a un deploy y a un restore | transitorio: 5 min la cookie, y el snapshot vence a los 60 s (`AUTH_ME_CACHE_TTL_MS`, `auth-cache.ts:32`); la ventana dura más |
| **Variables de entorno cambiadas en Coolify** durante la ventana, si hubo | Coolify | el revert del repo no las toca | volver a ponerlas con `env-set` + **redeploy** (no `app-restart`), desde el panel si la app está parada (regla 10) |
| **Backups en R2** tomados en la ventana (P4, el previo de `db-migrate`, el snapshot de `db-restore`) | R2 | quedan, sin cifrar mientras P7 siga abierto | aceptado; se van por el ciclo de vida de `manual/*` |
| **QR impresos** | papel | el sticker codifica `/qr/<slug>/` (inmutable), así que no hay nada impreso que cambie; lo que se reescribe es `qr_codes.target_url`, que sí vuelve con el restore/reset | ninguno |

## 5. Comandos de `hops` citados, verificados contra el código

En `abe861e88f`. Registro del VPS: `scripts/server-tools/src/index.ts`; local: `scripts/client-tools/`.
«Resuelve por `findContainer`» quiere decir que, con la app de staging parada, apunta a prod (regla 10).

| comando | política de `--target` | cómo se usa acá |
|---|---|---|
| `db-backup-now` | `default-ok`; Postgres por etiqueta con UUID | P4, C1 (`--yes` opcional) |
| `psql` | `explicit-required` | consulta posicional |
| `find <kind> [--verbose]` | `default-ok`; resuelve por `findContainer` | sólo para la comprobación de la regla 10, con la app corriendo |
| `cron-list` | `default-ok`, pero **ignora `--target`** (HTTP a `HOSPEDA_API_URL`, default prod: `lib/api-client.ts:72`) | **no usar** |
| `env-list <app> [--reveal] [--match]` | `default-ok`; resuelve por `findContainer` y no imprime el contenedor | **no usar en la ventana**; en su lugar, `docker inspect` (V0) o el panel |
| `logs <kind> [--since] [-g]` | `default-ok`; resuelve por `findContainer` | sólo con la app de staging corriendo y la regla 10 comprobada (V5.4) |
| `db-migrate` | `explicit-required` | `--reset`, `--no-pull`, `--yes` (existe `--no-backup`, no se usa) |
| `db-seed` | `explicit-required` | `--no-pull` (defaults reset + required + example) |
| `db-seed-test-users` | `explicit-required` | `--no-pull` |
| `db-seed-migrate` | `explicit-required` | `--status`, que **nunca hace pull** aunque se le pase `--pull` (`commands/db-seed-migrate.ts:237-247`) |
| `redeploy <kind>` | `explicit-required`; resuelve por `findContainer` | **no en V5/V6**: el deploy va desde el panel de Coolify |
| `exec <kind> [--] <cmd>` | `explicit-required`; app por `findContainer`, redis/postgres por etiqueta con UUID | V5.5 sobre redis. `--env <prefijo>` siempre tapa los valores (`container-exec.ts:91`) |
| `health <env>` | `none` (descarta `--target`) | entorno posicional |
| `db-restore [N]` | `explicit-required` | elegir por nombre en el picker; existen `--no-snapshot-first`, `--yes`, `--target-db` |
| `r2-lifecycle [show\|set]` | `explicit-required` | `show` en C1 |
| `env-set` | `explicit-required`; resuelve por `findContainer` | sólo con la app corriendo y la regla 10 comprobada |
| `db-update-template` (local) | — | `status`, `build-candidate <nombre>`, `promote <nombre> --confirm` |

## 6. Puntos abiertos para el owner

Cada uno con la opción recomendada y el paso en que tiene que quedar cerrado. Ninguno se resuelve en este
documento.

1. **Herramienta para cancelar las preapprovals huérfanas del sandbox (V1).** Opciones: (a) un script chico
   en `scripts/cutover/` que lea `provider_link` y los checkouts pendientes de staging, busque las sueltas por
   `payer_email`, cancele por id en el sandbox y relea hasta ver `cancelled`; (b) a mano desde el panel del
   sandbox; (c) adaptar U3. **Recomendada: (a)**, con PR propio: deja registro, se puede reintentar y no toca U3,
   que está escrito para prod. **Se cierra antes de V1.**
2. **Cómo se baja cada app (V2, V3).** (a) «Stop» de Coolify; (b) `docker stop` por ssh. **Recomendada:
   (a)**: Coolify sabe que la paró y no la relanza. Con (b) no está medido si su política de reinicio la
   vuelve a levantar. **Se cierra antes de V2.**
3. **El checkout del VPS (V4.3).** Qué rama sigue `$HOPS_REPO_ROOT`. **Recomendada**: leerlo en P8 con
   `git -C "$HOPS_REPO_ROOT" status -sb` (sólo lectura) y seguir los pasos 1 a 3 y 8 de V4.3 tal como están.
   **Se cierra antes de V1.**
4. **Estampar el ledger del seed en staging después del reset (V4.3.6).** (a) agregar `--baseline-stamp` a
   `hops db-seed` en un PR chico; (b) correr a mano `pnpm --filter @repo/seed seed --data-migrate
   --baseline-stamp` desde el checkout del VPS con la URL de staging. **Recomendada: (a)**: el comando ya resuelve
   la base por `--target` y no se puede apuntar a prod por error. **Se cierra antes de V1.**
5. **Redis de staging (V5.5).** La autenticación de `redis-cli`, la base (`-n`) y si comparte instancia con
   prod. **Recomendada**: leerlo con el `docker inspect` de V0 (`HOSPEDA_REDIS_URL` de la api de staging, host y
   base, sin copiar la contraseña) o en el panel de Coolify, nunca con `exec --env` (tapa los valores) ni con
   `env-list` (puede leer prod). Si comparten instancia y base, el `INCR` invalida también prod: es inocuo, pero
   hay que saberlo. **Se cierra antes de V1** (la lectura se hace como un ensayo de V0, con la app corriendo).
6. **Quién hace PostHog (V6.3, C3), y si staging y prod comparten proyecto.** (a) el agente con el MCP de
   PostHog, que primero lista lo que nombra la propiedad vieja y edita sólo con la lista aprobada por el owner;
   (b) el owner a mano en el panel. **Recomendada: (a)**, siempre con el filtro OR. **Se cierra antes de V6.**
7. **`BACKUP_PASSPHRASE` sin setear: los dumps suben a R2 sin cifrar (P7, C1).** (a) setearla antes del
   corte en `scripts/server-tools/.env.local` del VPS y guardar la passphrase fuera del VPS, porque sin ella
   `db-restore` no descifra el 2b; (b) aceptar el riesgo y dejarlo anotado. **Recomendada: (a)** para prod,
   con un `db-backup-now` + `db-restore --target-db <scratch>` de prueba antes, para que el 2b no sea el primer
   backup cifrado que se intenta restaurar. **Se cierra antes de C1.**
8. **Auto-deploy de staging apagado (P1).** Es política del repo, pero no se verificó en Coolify para esta
   ventana. **Recomendada**: mirarlo en el panel antes de mergear el PR de la umbrella. **Se cierra antes de V1.**
9. **Cache de los 302 en navegadores.** El middleware no fija `Cache-Control` en esas respuestas (no
   encontrado); no se midió una respuesta real. **Recomendada**: un `curl -sI` a una ruta vieja, anotando
   `Cache-Control`; si no trae `no-store`, se acepta como transitorio. **Se cierra en el smoke de 1.B9 (V6.4).**
