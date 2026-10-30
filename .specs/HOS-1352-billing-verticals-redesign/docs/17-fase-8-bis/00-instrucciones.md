---
title: "FASE 8-bis · las instrucciones, comunes a los ocho vectores"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis — instrucciones

`DEC-METH-006` manda volver a correr la FASE 8 **sobre el diseño que la FASE 9 produjo**, y
repetir el ciclo **hasta que una pasada no produzca ningún `CRITICA` nuevo**. Esto es esa pasada.

**Corre ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que **las
contradicciones viven ENTRE capítulos**: atacar sólo los textos corregidos la volvería ciega a
justamente lo que este ciclo busca.

---

## 1. Por qué existe esta pasada, y qué tiene que encontrar

**La FASE 9 ya demostró que puede introducir defectos nuevos**, y ése es el blanco principal:

- **`D-01`** existe porque el arreglo de `R2` —agregar `ADDON` a las fuentes de cobertura— **abría
  un fail-open que el diseño original no tenía**: un suspendido quedaba cubierto por su propio
  addon.
- **`D-20`** existe porque la resolución de `R3` le daba **un segundo significado** a un campo del
  contrato (`hasta: sin fecha`), y un consumidor que asumiera el primero **regalaba cobertura
  perpetua**.

**Los dos se cazaron de casualidad**, mientras se resolvía otra cosa. Una pasada sistemática los
habría encontrado. Así que la pregunta que ordena esta fase no es *«¿el diseño tiene defectos?»*
sino:

> **¿Qué rompió el arreglo?**

Y su gemela, porque los arreglos se aplicaron **por racimo** y las contradicciones viven entre
capítulos:

> **¿Qué regla corregida en un capítulo contradice ahora a otro capítulo que nadie volvió a leer?**

---

## 2. Qué cambió, y es dónde hay que mirar primero

Veintisiete decisiones aplicadas en siete commits (`4f34afa1a` → `8bf004a6d`). Los cambios **de
forma**, no de redacción:

| # | qué cambió | dónde |
|---|---|---|
| 1 | el contrato tiene **tres clases de fuente y seis tipos**; `cubierto` cuenta **sólo `TÍTULO`**; `BASE` y `ADDON` no | `12-contrato-de-cobertura.md` §2.4, §2.5 |
| 2 | **el paso 5 dejó de ser `cubierto`** y ya no rechaza a nadie: toda la defensa se apoya en el paso 6 | `V/17` §1.2, precisión 5 |
| 3 | `hasta` pasó de dos valores a **cuatro** (`fecha`, `NO_VENCE`, `SIN_FECHA_CONOCIDA`, `SIN_EMPEZAR`) | contrato §2.6 |
| 4 | la **referencia no es anulable**, y por eso `courtesy_grant` y `permanent_grant` ganaron columna | contrato §2.3, `B/02` §2.4 |
| 5 | el grant se ancla al **plan**, lee su **versión vigente** y lleva **trinquete** | contrato §2.8, `B/02` §2.4, `V/15` §2.5 |
| 6 | la **dirección inversa** del contrato, con seis campos y dos columnas nuevas en `vertical` | contrato §4.1 |
| 7 | el candado del §11 son **dos claves** partidas por `sucede_a`: un origen y su única sucesora | `B/02` §2.2 |
| 8 | `RECONCILIATION_REQUIRED` **dejó de ser un estado**: es la marca `requiere_conciliación` | `B/02` §2.2, `B/03` §3.1 |
| 9 | entró **`CHARGE_DECLINED`** con su transición `S16`; siguen siendo nueve estados | `B/03` §3.1, §3.2 |
| 10 | **toda sucesora nace con fecha de primer cobro a un día como mínimo**, y esa fecha se guarda | `B/12` §5.2, `NUCLEO/04` §3 (`D8` sube a base) |
| 11 | addons y contador de promos **se re-apuntan a la sucesora** en vez de cancelarse | `B/16` §4.2, `B/14` §2.2 |
| 12 | el cambio de plan **no se ofrece** desde `PENDING_AUTHORIZATION` ni desde `PAUSED` | `B/03` §3.3.1 |
| 13 | **`T1` crea la fila** y perdió su condición vieja; `PRE_TRIAL` no tiene fila | `V/03` §2 |
| 14 | la **versión de pre-trial** y la **versión de piso**, no vendibles, con entitlements guardados | `V/02` §2.1 |
| 15 | `vertical` gana tres columnas: `evento_de_activacion`, `admite_altas`, `fin_de_servicio` | `V/02` §2.1 |
| 16 | `UNIQUE(hash_del_correo, vertical)` en `trial` | `V/02` §2.2 |
| 17 | el **reloj** es una segunda clase de actor; los pasos 5-7 se evalúan sobre el **actor** | `V/17` §3.4 |
| 18 | el **criterio** de qué operación pasa por el paso 5, con guard; la enumeración queda para la implementación | `V/17` §3.5 |
| 19 | `addon_product` **se parte por campo**: `addon_version` y sus dos tablas van a verticales | `V/02` §2.1, `B/02` §2.4 |
| 20 | el plan de trial **declara** `hereda Turista VIP`, y el valor es **no** | `V/02` §2.1 |
| 21 | **NO se migra**: ninguna fila se transcribe al sistema nuevo | los dos `21-migracion.md` |
| 22 | cuatro guards nuevos: `G-R1-A`, `G-R1-B`, `G-R3-B`, `G-R3-C`; `G-R3` ampliado | `B/20` §2, `V/20` §2 |
| 23 | la **FASE 7 del paraguas** existe como documento propio, con el rollback adentro | `16-fase-7-del-paraguas.md` |

**Mirar primero ahí no es mirar sólo ahí.** Cada uno de esos cambios tiene consumidores en
capítulos que no se tocaron, y ésa es la superficie donde vivió la causa raíz.

---

## 3. Lo que arranca hecho: los 327 casos

[`15-fase-9/00-dominios-de-los-racimos.md`](../15-fase-9/00-dominios-de-los-racimos.md) enumera
**327 casos con fuente por elemento**. La FASE 8 miró 63. **La 8-bis recorre dominios en vez de
descubrirlos**, y eso es lo que la abarata sin recortarle el alcance.

Los cinco informes de resolución dicen, racimo por racimo, **qué dominio se recorrió y con qué
veredicto**: `01-R6` · `02-R2` · `03-R3` · `05-R1` · `06-R5`, todos en `15-fase-9/`.

---

## 4. Qué NO es un hallazgo de esta pasada

| no reportar | por qué |
|---|---|
| **los 141 hallazgos de la FASE 8**, salvo que **sigan llegando sobre el texto nuevo** | ya están registrados en `14-fase-8-adversarial/`. Si uno sigue llegando, **decilo con su ID viejo** y mostrá en qué paso llega ahora |
| **`RES-01`** — la mitad `Guest` de `F-8A1-005` | ya está nombrada en [`15-fase-9/08-residuos-del-paso-1.md`](../15-fase-9/08-residuos-del-paso-1.md), con la decisión del owner de dejarla para esta pasada. **Podés profundizarla; no la cuentes como nueva** |
| **el capítulo 13 (Pagos), que no existe** | es un límite declarado. Lo que sí vale: **qué se rompe cuando se escriba**, si depende de algo que esta fase movió |
| *«esto no está medido»* a secas | las 8 filas `UNKNOWN` ya están contadas. La pregunta útil es **«si esa medición vuelve al revés, qué se rompe»** |
| lo que ya está declarado abierto **con su causa** | `DEC-METH-006` permite cerrar la fase con cosas abiertas si cada una dice de qué depende |

---

## 5. Cómo se escribe un hallazgo

**Cada hallazgo se apoya en una cita textual con archivo y §.** Un hallazgo sin cita no es
refutable, y lo que la FASE 9 puede resolver es sólo lo refutable.

```markdown
### F-8bXN-NNN — <título en una línea, que diga qué se rompe>

**Qué se rompe.** El resultado concreto, en el sistema, para una persona.

**El camino.** Los pasos, numerados, cada uno con su cita:
1. …
2. …

**Dónde lo permite el diseño.** Las citas textuales, con archivo y §.

**Severidad.** `CRITICA` | `ALTA` | `MEDIA` | `BAJA`, con su motivo.

**¿Es nuevo, o es el arreglo?** Una línea: si el defecto **lo introdujo un cambio de la FASE 9**,
decí cuál. Es el dato que esta pasada existe para producir.
```

**IDs**: `F-8b` + tu vector + número. A1 → `F-8bA1-001`. C2 → `F-8bC2-001`.

**Severidad `CRITICA`** es: alguien paga de más o de menos, alguien accede a algo que no le
corresponde, o un dato se pierde sin vuelta. **Lo demás no es `CRITICA`**, y el conteo de críticos
es lo que decide si el ciclo sigue — inflarlo hace otra vuelta entera de trabajo.

**Y una sección obligatoria al final**: `## Ataques que intenté y el diseño resistió`. Sin eso no
se sabe qué se probó, y un informe sin ella no sirve para decidir que la fase cortó.

**Marcá `NUCLEO`** cualquier defecto que sea de `docs/nucleo/`: lo adopta la pasada C. No lo
resuelvas en tu informe.

---

## 6. Reglas duras

- **El PDR (`00-PDR.md`) no se edita NUNCA.** Es material de lectura.
- **No edites ningún capítulo.** Esta fase **encuentra**, no arregla. Escribís **un solo archivo**:
  el tuyo.
- **No toques** el decision log, la matriz ni los informes de la FASE 8 o la 9.
- **Los conteos se cuentan**, no se estiman.
- Todo en **español**, con acentos.

---

## 7. Los ocho vectores

| pasada | agente | vector | material principal |
|---|---|---|---|
| **A** | `A1` | acceso cruzado y autorización | `HOS-1353` |
| **A** | `A2` | máquinas, carreras y huérfanos | `HOS-1353` |
| **A** | `A3` | datos, migración y acoplamiento | `HOS-1353` |
| **B** | `B1` | doble cobro y pérdida de pago | `HOS-1354` |
| **B** | `B2` | máquinas, idempotencia y carreras | `HOS-1354` |
| **B** | `B3` | conciliación, datos y migración | `HOS-1354` |
| **C** | `C1` | la costura: capítulos partidos, el contrato, los invariantes | todo |
| **C** | `C2` | liberación, coexistencia y migración del conjunto | todo |

**El núcleo es de la pasada C.** Es lo único que las dos épicas comparten: si lo atacan las dos,
los hallazgos se duplican y los invariantes no tienen dueño.

**C corre después de A y B**, y lee sus informes.
