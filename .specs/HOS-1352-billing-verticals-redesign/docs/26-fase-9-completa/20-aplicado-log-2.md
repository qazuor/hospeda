---
title: "FASE 9 completa · aplicado en el log, segunda tanda: las elecciones 9a–9h"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — el log, segunda tanda

Registra en `01-decision-log.md` (`D/01`) las filas **9a–9h** de
[`10`](./10-decisiones-del-owner.md) (*«Elecciones de los agentes de aplicación, llevadas al
owner»*, ratificadas el 2026-09-25) y las citas *«para el log»* de
[`17`](./17-aplicado-barrido.md) §5. Autorización del owner para tocar el log. **Sólo se editó
`D/01`** (y este registro); `D/03-handoff.md` no se tocó. No se commiteó. Las líneas son las del
árbol **después** de aplicar.

## 1. Las ocho filas, como 📌

Cada ID se grepeó en `$W` antes de tocarlo (archivos / apariciones): `DEC-MP-008` 19/48,
`DEC-SUB-019` 24/124, `DEC-SUB-021` 25/126, `DEC-MAIL-001` 27/79, `DEC-CONC-002` 22/53,
`DEC-SUB-022` 4/29, `DEC-ADDON-007` 3/18, `DEC-PROMO-001` 11/18, `DEC-ARCH-006` 30/64,
`DEC-GRANT-005` 5/7. Ninguna fila 9x estaba registrada en el log antes (`rg "9[a-h]"`).

| fila | entrada | *Estado* (puntero) | 📌 | fuente del texto |
|---|---|---|---|---|
| 9a | `DEC-MP-008` | `:5248` | `:5282`, punto 1 | `17` §5 (1); `01-…` §1.5 R1-a opción 1 |
| 9b | `DEC-MP-008` | `:5248` | `:5282`, punto 2 | `13` §2 (sin texto propuesto); `01-…` §1.5 R1-b |
| 9c | `DEC-MAIL-001` | `:1524` | `:1566`, tercer 📌 del punto 1 | `13` §2; `04-…` `C-R5-2`; `B/03:2481` |
| 9d | `DEC-SUB-022` | `:5583` | `:5624` | `13` §2 |
| 9e | `DEC-ADDON-007` | `:5742` | `:5771`, punto 1 | `15` §2 |
| 9f | `DEC-ADDON-007` | `:5742` | `:5771`, punto 2 | `15` §2 (`K-9`) |
| 9g | `DEC-PROMO-001` | `:759` | `:786`, segundo 📌 de la implicación 5 | `17` §5 (2); texto de `B/19` fila 7-bis |
| 9h | `DEC-ARCH-006` | `:2196` | `:2250` | `17` §5 (3) |

**Dónde fue cada una, y por qué**:

- **9a y 9b → `DEC-MP-008`**, no `DEC-SUB-021` ni `DEC-SUB-019`. `DEC-MP-008` es la entrada que
  nombra el borde de 9a (*«un webhook de cobro fallido que se perdió, y la fila sigue `ACTIVE`
  cuando el proveedor pausa»*) y la que fija que la pausa del proveedor termina el grace, que es la
  cota de 9b (*«nunca después de la pausa del proveedor»*). `DEC-SUB-021` trata el cambio de plan
  en grace; `DEC-SUB-019`, el fin del grace.
- **9a se escribió como lo decidió el owner (corregir), no como lo había dejado el agente
  (declarar)**: el 📌 dice que el barrido corre `S4` y deja como único borde el que `17` §1 declaró
  en `B/12` (la sucesora de 3c sin pago propio).
- **9c → `DEC-MAIL-001`** (la población del correo antes de cancelar), citando la forma del
  reintento del primer 📌 de `DEC-CONC-002` sin tocar esa entrada. La nota *«trece de las catorce
  filas»* de `DEC-CONC-002` no se tocó: cuenta filas «no» de `B/09` §3, no los actos de la
  instancia.
- **9f → `DEC-ADDON-007`**, no una entrada de `PURGED`: el log no tiene entrada propia del borrado
  al llegar a `PURGED` (`DEC-DATA-005` define el estado, no quién ejecuta el borrado del addon), y
  `K-9` precisa la orfandad que `DEC-ADDON-007` reescribió.
- **9h → `DEC-ARCH-006`** (la firma del contrato), nombrando a `DEC-GRANT-005` como dueña del
  trinquete; `DEC-GRANT-005` no gana puntero porque su implicación (*«`permanent_grant` gana … el
  piso»*) sigue siendo cierta: es el origen del dato.
- Cada 📌 termina con *«La entrada no se edita en su contenido»* donde es un bullet final (misma
  forma que `DEC-SUB-021`), y dice si la fila la ratificó el owner como estaba (9b–9g) o la
  corrigió (9a, 9h).

## 2. Las citas *«para el log»* de `17` §5

| ítem | estado |
|---|---|
| (1) 9a en `DEC-MP-008` | **aplicado** (§1) |
| (2) 9g en `DEC-PROMO-001` | **aplicado** (§1) |
| (3) 9h en `DEC-ARCH-006` | **aplicado** (§1); se eligió `DEC-ARCH-006` y no una `DEC-GRANT-00x` |
| (4) notas de recuento: `:3401` *«una de las doce acciones»*, `:3216`/`:3395`/`:4014` *«cuatro hechos»*, `:1940` *«ocho máquinas»* | **no aplicado**. Es condicional (*«si el log agrega nota de recuento»*), no registra una decisión del owner ni corrige un registro falso: son texto de decisiones fechadas, exacto en su fecha. El sexto hecho ya está en el 📌 de `DEC-DATA-002` (`:3220`) y en el *Estado* de `:3932`; y `16` §3 ya rechazó la de las máquinas por la misma razón (`DEC-METH-012` no pide tocarla) |

## 3. El Resumen

Recontado con `scratchpad/contar-log.py` (lee los `### DEC-` hasta `## Resumen`, excluye la
plantilla; *precisada* = `precisad` en el campo *Estado* **o** una línea con `📌 Precisad…` /
`📌 Cerrad…` en el cuerpo, sin `SUPERSEDED`). Antes de editar reprodujo las cifras de `16` §4
(**26**); la primera versión, que contaba cualquier `📌`, daba 28 por dos falsos positivos
(`DEC-ENT-006` cita *«su 📌»* de otra entrada; `DEC-METH-013` tiene *«📌 De dónde sale»*).

```text
antes:   decisiones 124 · METH 15 · funcionales 109 · SUPERSEDED 6 · precisadas 26
después: decisiones 124 · METH 15 · funcionales 109 · SUPERSEDED 6 · precisadas 29
```

| fila | antes | ahora |
|---|---|---|
| Precisadas sin `SUPERSEDED` | 26 | **~~26~~ 29**, con nota de recuento; la lista *con 📌 o puntero del owner* suma `DEC-SUB-022`, `DEC-ADDON-007`, `DEC-ARCH-006` |
| Decisiones de la FASE 9 completa | 7 nuevas y 15 precisiones | **7 nuevas y ~~15~~ 18 precisiones**, más una frase con las ocho filas y su entrada |
| Decisiones, METH, funcionales, `SUPERSEDED` | 124 / 15 / 109 / 6 | sin cambio |

Verificado con script que los 29 nombres de la fila del Resumen y los 29 del recuento son el mismo
conjunto (diferencia vacía en las dos direcciones).

## 4. Verificaciones

- `npx markdownlint-cli2` con el `.markdownlint-cli2.jsonc` del repo sobre `D/01`: **0 issues**.
- Frontmatter de `D/01`: `updated: 2026-09-25` ya estaba.

## 5. Fuera de carril

Nada nuevo. Las citas de `17` §5 para sub-specs y `D/03-handoff.md` siguen pendientes, como las
listó `17`.
