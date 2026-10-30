---
title: "FASE 5 · aplicación — log de decisiones y matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación del log de decisiones y de la matriz

Aplica al log y a la matriz las decisiones del owner de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) (lotes 1 a 6 y el lote de
simplificación del corte) y el §11 y el §12 de
[`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md). El OK del owner para los dos
archivos ya existe: el lote E de la simplificación del corte y cada letra de los lotes 1 a 6. No se
creó ninguna decisión nueva.

## 1. Archivos tocados

- `$D/01-decision-log.md`
- `$D/06-mp-validation-matrix.md`
- este registro

## 2. Qué se aplicó

Las líneas son del worktree del programa al terminar esta aplicación. Cada 📌 nuevo lleva
*«Precisada el 2026-09-30, con OK del owner (FASE 5, …)»* y la decisión suma la marca a su *Estado*.

### 2.1 Log — lote E de la simplificación del corte (§11), con las letras A a D

- `DEC-MIG-004`, **SUPERSEDED por `DEC-MIG-007`** (S-56, S-77):
  `01-decision-log.md:3314` «**SUPERSEDED por `DEC-MIG-007`** (2026-09-30».
- `DEC-MIG-002`, precisada con A1 y el lote B (S-03, S-25, S-26, S-72):
  `01-decision-log.md:2693` «hasta el corte **no se conserva**»;
  `01-decision-log.md:2698` «**una sola regla que bloquea toda escritura**».
- `DEC-MIG-003`, precisada (S-02, S-04, S-07, S-15, S-16, S-24, S-40, S-45, S-56):
  `01-decision-log.md:3073` «el corte ya no escribe»;
  `01-decision-log.md:3078` «fichas de Gastronomía y de Experiencia del 📌 del 2026-09-27 (S-07)»;
  `01-decision-log.md:3080` «restaurar el backup y volver a la imagen vieja, sin reactivar los planes».
- `DEC-MIG-005`, precisada: siguen los puntos 1 y 3 y el hecho del lote F; quedan `SUPERSEDED` los
  📌 del 27/09, de `V2-a`/`V2-m`/`V2-r`, del 29/09 y el del 30/09 en su parte del lote G; el punto
  2 queda sin sujeto con D1; *«sus fichas»* se acota a las cinco (J del lote 1) (S-15, S-37, S-38,
  S-41, S-42, S-57, S-58):
  `01-decision-log.md:6368` «Quedan **`SUPERSEDED`**: el 📌 del 2026-09-27»;
  `01-decision-log.md:6376` «**El punto 2 queda sin sujeto**»;
  `01-decision-log.md:6378` «se acota a las cinco cuentas de la».
- `DEC-MIG-006`, precisada: las cinco de la lista en vez de las `L8`, la prueba la escribe el
  script del corte (lote 2 D), sale el gate de seudónimos compartidos y su 📌 del 29/09 (S-01,
  S-02, S-08, S-12, S-13, S-28, S-35, S-36):
  `01-decision-log.md:6787` «pasa a **las cinco de la lista** cerrada»;
  `01-decision-log.md:6793` «Sale el gate de seudónimos compartidos (S-36)».
- `DEC-CONC-002`, precisada con C1: la salvedad 4 cuenta una sola lápida (S-40, S-46, S-49):
  `01-decision-log.md:1618` «**una sola lápida, la de recepción**».
- `DEC-ARCH-014`, precisada con C1: el 📌 del lote P pierde el Worker y el detector; el package
  del contrato sigue (S-40, S-42, S-45):
  `01-decision-log.md:7342` «lote P pierde el Worker del borde (P-A)».

### 2.2 Log — lotes 1 a 6

| letra | decisión que la recibe | cita |
|---|---|---|
| 1 A, B, D a I; 2 E | `DEC-ARCH-014` (lo que suma `U1`, con el package de `DEC-ARCH-015`) | `01-decision-log.md:7317` «**`U1` crece**, sin código nuevo del diseño» |
| 2 A y B | `DEC-ARCH-014` (23 → 24 unidades) y `DEC-ARCH-005` (el outbox del núcleo común lo construye `U2`) | `01-decision-log.md:7337` «pasa de 23 a 24 unidades»; `01-decision-log.md:2417` «**`U2`, el outbox común**» |
| 1 C | `DEC-ARCH-012` y `DEC-ARCH-013` (las migraciones de datos del seed del cobro viejo no se congelan: las saca `U1`) | `01-decision-log.md:7064` «**no se congelan hasta el paso 6: las saca de la rama `U1`**» |
| 1 H | `DEC-ARCH-012` (la lista de pendientes de `G8` y los extras `032` y `033`) | `01-decision-log.md:7067` «**deja de cubrir `extras/`**» |
| 6 G (`BD-025`) | `DEC-ARCH-012` (la foto del paso 6) | `01-decision-log.md:7070` «la genera Drizzle desde el esquema del repositorio» |
| 2 C y D | `DEC-ARCH-013` (catálogo como SQL generado, bases con `db:migrate`) y `DEC-MIG-006` (la prueba la escribe el script del corte) | `01-decision-log.md:7119` «**SQL generado por un script TypeScript**»; `01-decision-log.md:7123` «se arman con `db:migrate`, como `e2e-pr`» |
| 3 D | `DEC-DATA-008` y `DEC-ARCH-013` (los cinco plazos antes del merge de `V6`) | `01-decision-log.md:7191` «fija el owner **antes del merge de `V6`**»; `01-decision-log.md:7127` «owner **antes del merge de `V6`**, no antes del ensayo del corte» |
| 3 E y F | `DEC-MIG-003` (el paso 3 en tres actos, crons apagados hasta el paso 5) | `01-decision-log.md:3065` «tres actos: apagar el sistema viejo, `hops db-migrate --pull`» |
| 3 C | `DEC-AUTH-003` (salen las puertas de borrado y restauración fuera del diseño) | `01-decision-log.md:6677` «desaparece el borrado» |
| 4 C | `DEC-AUTH-003` (sale la impersonación del código) | `01-decision-log.md:6673` «salen `impersonate` y `set-role` del plugin `admin`» |
| 1 D y 4 B | `DEC-ENT-006` (columnas y crons de partner; el rol de socio, que no se quita) | `01-decision-log.md:6566` «el dueño de un Partner **tiene rol**»; `01-decision-log.md:6569` «**no se quita** cuando el socio pierde su presencia» |
| 4 A | `DEC-AUTH-005` (la postulación de Partner es propia; `alliance_leads` queda para otros tipos) | `01-decision-log.md:6749` «la postulación de Partner es **propia**» |
| 4 D | `DEC-AUTH-001`, punto 4 (el `403` de la ficha ajena `RESTRICTED` pasa a `404`) | `01-decision-log.md:6536` «`RESTRICTED` pasa a `404` en `V5`» |
| 6 G (`AUT-016`) | `DEC-AUTH-001`, punto 3 (se corrige sólo la razón; `banned`, `ban_reason`, `ban_expires` se conservan) | `01-decision-log.md:6534` «se conservan. Se corrige sólo la razón» |
| 4 E | `DEC-DATA-005` (`trial` y las tablas de sólo agregar nacen sin `deleted_at`) | `01-decision-log.md:5994` «**nacen sin» |
| 5 F | `DEC-RF-008` (las devoluciones de una misma orden se serializan) | `01-decision-log.md:6438` «de una misma orden se serializan» |
| 1 J | `DEC-MIG-005` y `DEC-MIG-006` (van con el lote E, arriba) | ver §2.1 |

En esta tabla, «4 A» a «6 G» son las letras de la tabla única de los lotes 4, 5 y 6 de
`10-decisiones-del-owner.md` (A a E del lote 4, F del 5, G del 6); en el log se citan como
*«lotes 4 a 6, letra X»*.

### 2.3 Log — resumen de cabecera, recontado con script

- Decisiones: `01-decision-log.md:7378` «~~**139**~~ **142**» (las tres de la FASE 5 no se habían
  sumado: `DEC-METH-017`, `DEC-MIG-007`, `DEC-ARCH-015`).
- De metodología: `01-decision-log.md:7379` «~~16~~ **17**».
- Funcionales: `01-decision-log.md:7380` «~~**123**~~ **125**».
- Precisadas sin `SUPERSEDED`: `01-decision-log.md:7381` «~~**70**~~ **71**» (suman `DEC-AUTH-001`
  y `DEC-ENT-006`; sale `DEC-MIG-004`, tachada en la lista).
- `SUPERSEDED`: `01-decision-log.md:7383` «~~**11**~~ **12**».
- Apartamientos declarados del PDR: `01-decision-log.md:7390` «~~**10**~~ **11**» (`DEC-METH-017` se
  declara apartamiento de la plantilla de la FASE 5 del PDR y no estaba sumada).
- Fila nueva: `01-decision-log.md:7398` «| FASE 5 | **3 nuevas, 18 📌 sobre 16 decisiones, 1 `SUPERSEDED`**».

### 2.4 Matriz (§12 de la simplificación del corte)

- `EX-42` (S-59), `EX-48` (S-57), `EX-50` (S-58): la marca que reconoce el script, estado `UNKNOWN`
  sin cambio; lo que decía *«se mide en el paso 0»* va tachado.
  `06-mp-validation-matrix.md:399` «S-59): el corte ya no vence por API»;
  `06-mp-validation-matrix.md:405` «S-57): su único sujeto era la ventana del corte»;
  `06-mp-validation-matrix.md:407` «S-58): la segunda corrida del detector sale».
- `EX-44`, `EX-45` (S-60) y `EX-47` (S-61): salen del paso 0, se miden en sandbox antes de `B11`;
  en `EX-44` y `EX-45` se tacha también el sujeto del corte de la columna «para qué».
  `06-mp-validation-matrix.md:401` y `:404` «**Se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5»;
  `06-mp-validation-matrix.md:402` «**se mide en sandbox antes de `B11`, fuera del paso 0**».
- `EX-59` (S-62): nota de sujeto retirado, estado sin cambio:
  `06-mp-validation-matrix.md:416` «**Sujeto retirado el 2026-09-30, con OK del owner**».
- `EX-40` (S-63, D1): sale del 🚧 la parte del plan reactivado:
  `06-mp-validation-matrix.md:397` «lote D y S-63)*».
- «Qué espera cada decisión»: la fila de `Y-1`/`EX-42` va tachada (S-43, S-59):
  `06-mp-validation-matrix.md:555` «**Retirada el 2026-09-30**».
- Conteos de la cabecera y del resumen:
  `06-mp-validation-matrix.md:17` «63 `VERIFIED`, 16 `PARTIALLY_SUPPORTED`, 24 `NOT_SUPPORTED`, 14 `UNKNOWN`, sobre 117.»;
  `06-mp-validation-matrix.md:446` «~~**61**~~ **63**»;
  `06-mp-validation-matrix.md:450` «~~**16**~~ **14**»;
  `06-mp-validation-matrix.md:455` «63 · 16 · 24 · 14; esperan medición 9».

## 3. Lo que no se aplicó y por qué

- **Lote 3 A y B** (el estado nuevo de la ficha reemplaza a `lifecycle_state`, `visibility` y
  `moderation_state`; `V6` retira los lectores de las tres columnas que sobreviven): ninguna
  decisión viva los contradice ni los precisa. `DEC-METH-017` nombra las tres columnas que viven
  *«hasta el paso 3 del corte»*, y eso sigue siendo cierto: la migración que las borra corre en el
  paso 3. No es de alcance del programa sino de `V6`, así que no va a «Vuelve al owner».
- **Lote 1 A, B, E, F, G e I y lote 2 E** no tienen una decisión propia que precisar: son alcance de
  `U1` y van todos en el 📌 de `DEC-ARCH-014`.
- **`DEC-ARCH-015` y `DEC-MIG-007`** no se tocan: el §11 dice *«sin cambio»* para `DEC-MIG-007`, y
  el package con `description` y `README` va en el 📌 de `DEC-ARCH-014`, que es la unidad que lo crea.
- **Las entradas viejas no se editan en su contenido** (regla 1 del log): los 📌 que quedan
  `SUPERSEDED` se nombran en el 📌 nuevo y en el *Estado*, no se tachan. Sí se actualizaron los
  punteros *«ver su último 📌»* del *Estado* que dejaron de serlo (pasan a *penúltimo* o
  *antepenúltimo*).
- **Matriz, historia de la fila `UNKNOWN` del resumen**: las frases viejas (*«se miden en el paso 0
  del corte»*, *«el 1b no arranca sin `EX-48`»*) quedan como historia; la entrada nueva del
  2026-09-30, al principio de la fila, dice lo vigente.

## 4. Para otro dueño

- **Descomposiciones (`V/descomposicion.md` y `B/descomposicion.md`)**: el log dice, en los 📌 de
  `DEC-ARCH-006` (l. 2557) y `DEC-ARCH-014` (O-A y P-C), que las dependencias entre épicas
  *«siguen en once»*; las reglas de esta aplicación hablan de *«las doce de `B/descomposicion.md`
  §2.6»*. No lo verifiqué ni lo cambié: el 📌 nuevo de `DEC-ARCH-014` sólo dice que `U2` no es una
  dependencia entre épicas. Quien tenga las descomposiciones confirma la cifra; si son doce, el
  próximo 📌 del log lo corrige.
- **Dueño de `V5` en su descomposición**: el rol `fullAdminRole` del plugin `admin`
  (`apps/api/src/lib/auth.ts:76-89` en `origin/staging`) lista además `ban`, `delete`,
  `set-password`, `create` y `update`. Hoy todo `/api/auth/admin/*` contesta `403` (el comentario
  de `auth.ts` lo explica), pero `user: delete` es una puerta de borrado físico de cuentas, y el
  lote 3 C dice que ésas desaparecen. Texto propuesto para la fila de `V5`: *«salen del plugin
  `admin` `impersonate` y `set-role` (lotes 4 a 6, C) y toda otra acción que borre una cuenta
  (lote 3 C); `banned`, `ban_reason` y `ban_expires` y el rechazo de sesión del plugin se conservan
  (lotes 4 a 6, G)»*.

## 5. Vuelve al owner

Nada. Ninguna letra dejó una consecuencia sin elegir ni una contradicción con otra decisión viva.

## 6. Conteos

```text
# Log: decisiones, metodología, funcionales, precisadas sin SUPERSEDED, SUPERSEDED
python3 <scratchpad>/countlog.py $D/01-decision-log.md
#   antes:   total 142 · metodología 17 · funcionales 125 · precisadas 70 · SUPERSEDED 11
#   después: total 142 · metodología 17 · funcionales 125 · precisadas 71 · SUPERSEDED 12
# (criterio de la fila del resumen: el campo Estado, hasta «**Decide**», dice precisada,
#  recontada, enmendada o cerrada, y no dice SUPERSEDED; el script da 70 y 11 sobre el log
#  de antes, las cifras que ya tenía el resumen)
rg -o "^### DEC-[A-Z]+-\d+" $D/01-decision-log.md | sort -u | wc -l      # 142 antes y después

# 📌 nuevos de la FASE 5 en el log
#   18 sobre 16 decisiones (17 con la forma «- 📌 **Precisad…» y 1, `DEC-CONC-002`, anidada
#   en su punto 4 con la forma «**📌 Precisado…»)

# Matriz
cd $D && python3 contar-filas-de-la-matriz.py
#   antes:   117 = 63 · 16 · 24 · 14; esperan medición 12; no se miden, por decisión 6
#   después: 117 = 63 · 16 · 24 · 14; esperan medición 9;  no se miden, por decisión 9
#            (EX-42, EX-48, EX-50 suman a WH-2, WH-3, WH-4, EX-13, EX-46, EX-54)

# markdownlint, desde la raíz del worktree
npx markdownlint-cli2 <log> <matriz>      # antes 0 issues (sobre HEAD); después 0 issues
```
