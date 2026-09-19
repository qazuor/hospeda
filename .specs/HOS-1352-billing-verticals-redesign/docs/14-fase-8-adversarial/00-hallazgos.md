---
title: "FASE 8 · el consolidado de los 141 hallazgos"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 — el consolidado

Ocho agentes adversariales atacaron el diseño el 2026-09-19. Ninguno escribió código y ninguno
tocó un archivo existente. Este documento no repite sus hallazgos: los **agrupa por causa**, para
que la FASE 9 resuelva mecanismos y no síntomas.

> **Lo que este documento NO hace.** No propone soluciones (§65: la FASE 8 encuentra, la 9
> resuelve), no edita el decision log ni la matriz de MP —las correcciones que la fase encontró
> están listadas al final, **sin aplicar**, esperando al owner— y no reordena el trabajo ya
> publicado en Linear.

---

## 1. Los números, recontados

Recontados con script sobre los ocho archivos, no a mano.

| informe | vector | hallazgos | CRÍT | ALTA | MEDIA | BAJA |
|---|---|---|---|---|---|---|
| `A1` | acceso cruzado y autorización | 16 | 4 | 7 | 4 | 1 |
| `A2` | máquinas, carreras y huérfanos | 18 | 4 | 9 | 4 | 1 |
| `A3` | datos, migración y acoplamiento | 17 | 5 | 6 | 4 | 2 |
| `B1` | doble cobro y pérdida de pago | 18 | 8 | 6 | 4 | 0 |
| `B2` | máquinas, idempotencia y carreras | 22 | 9 | 9 | 4 | 0 |
| `B3` | conciliación, datos y migración | 19 | 8 | 8 | 2 | 1 |
| `C1` | la costura | 14 | 3 | 5 | 5 | 1 |
| `C2` | liberación, coexistencia y migración | 17 | 7 | 6 | 3 | 1 |
| | **total** | **141** | **48** | **56** | **30** | **7** |

**52 hallazgos declaran que necesitan una decisión del owner.** Ese número sale de leer la línea
`Necesita decisión del owner` de cada hallazgo con un script; es orientativo y la FASE 9 lo va a
depurar caso por caso.

---

## 2. Los seis racimos

Un racimo es un conjunto de hallazgos con **una sola causa**. Arreglar la causa los cierra todos;
arreglarlos de a uno deja la causa viva. Los racimos 1 a 4 son las convergencias — hallazgos a los
que llegaron agentes **ciegos entre sí**, atacando vectores distintos, que es la señal de severidad
más fuerte que produce este método.

### R1 · El conjunto de estados «vivos» del `UNIQUE` está mal calibrado — 8 CRÍTICOS

El racimo más grande de la fase, y **tres agentes independientes de billing** llegaron al mismo
candado.

| | |
|---|---|
| **el eje** | `F-8B1-001` · `F-8B2-001` · `F-8B3-001` — la restricción hace **inejecutable todo upgrade y todo cambio de ciclo** |
| **por exceso** | `F-8B2-008` — `SUSPENDED` es vivo, y por eso bloquea el reintento que el cap. 12 §4.4 exige |
| **por defecto** | `F-8B1-002` · `F-8B2-002` — `RECONCILIATION_REQUIRED` se excluyó para no bloquear al cliente, y por eso es un estado del que no se sale; con el preapproval vivo, habilita una segunda suscripción: **dos cobros** |
| **la consecuencia** | `F-8B3-002` — el candado contra el único doble cobro real no se puede construir |
| **el síntoma en papel** | `F-8B2-005` — dos capítulos de la misma épica discrepan sobre si un upgrade conserva la suscripción |

**No es un hueco: es un choque entre dos documentos ya aprobados.** El núcleo dice textual que
durante el cambio *«las dos conviven»*; el cap. 03 §3.3 lo prohíbe textual. La restricción incluye
`PENDING_AUTHORIZATION`, y el mecanismo de upgrade que `DEC-SUB-006` ya decidió exige justamente
que la vieja y la nueva convivan.

> **El candado más fuerte del diseño es el que lo rompe** — y el mismo mecanismo falla en las dos
> direcciones a la vez: lo que incluye de más bloquea, lo que excluye de más libera.

### R2 · El contrato de cobertura no puede transportar `grant` ni `addon` — 6 CRÍTICOS

**Tres agentes, las dos épicas.** Es la única convergencia que cruza la frontera, y por eso es la
que más peso tiene: los dos lados la descubrieron por separado mirando datos distintos, que es la
prueba de que el defecto es del contrato y no de la lectura que hace cada épica.

| | |
|---|---|
| **el eje** | `F-8A1-004` (autorización) · `F-8A3-001` (datos, verticales) · `F-8B3-007` (datos, billing) — el contrato declara **cuatro** `tipo` de fuente y transporta un solo campo de contenido, `versiónDePlan`; **dos de esas cuatro no tienen plan al cual apuntar** |
| **el scope** | `F-8A1-003` — una fuente de scope `LISTING` se agrega en un conjunto por `user + vertical`: el addon comprado para **una** ficha habilita la capacidad en **todas** |
| **el valor** | `F-8A3-002` — ningún lugar guarda el valor de un addon, así que *«plan 20 fotos + addon 30 = 50»*, el ejemplo con el que el PDR define la agregación, no se puede almacenar |
| **la fila** | `F-8B3-003` — el cobro de única vez de un addon no tiene fila posible |
| **el dueño** | `F-8C1-003` — las tres defensas del contrato son «ninguna opcional» y ninguna tiene dueño de este lado |

Y la mitad que faltaba, de `F-8B3-009`: **el contrato está escrito en una sola dirección.** Enumera
con cuidado lo que billing *empuja* y nunca declara lo que billing *lee* de verticales
(`plan_version`, `vertical`) — que resultó ser el acoplamiento real, y **dos de esas columnas no
existen**.

### R3 · El trial no puede nacer — 3 CRÍTICOS

`F-8A1-002` (autorización) · `F-8A2-001` y `F-8A2-002` (máquinas). El paso 5 no tiene título para
`PRE_TRIAL`; `T1` exige el título que `T1` crea; y la fila que guardaría `PRE_TRIAL` niega su
propio `T1`.

**No es un borde: es el camino feliz de cada alta.** Y `A1` anticipó cómo se arregla mal — una
exención por ruta, que es exactamente el fail-open que el cap. 17 §1.3 viene a impedir.

### R4 · Lo terminal se define sobre el estado local, y el riesgo vive en el vínculo — 5 CRÍTICOS

`F-8B1-006` · `F-8B2-007` · `F-8B3-008` — el preapproval huérfano sigue cobrando justo donde el
barrido no mira. El cap. 09 §3 exime los terminales del barrido; el cap. 16 §4.3 **cuenta con que
sí los mira**. Suman `F-8B2-006` (un doble clic en «contratar addon» crea dos autorizaciones
recurrentes) y `F-8B2-004` (el barrido fabrica un `RECONCILIATION_REQUIRED` por cada baja).

Falta la distinción entre **«la fila terminó»** y **«la autorización terminó»**.

### R5 · La migración no tiene dueño, ni orden, ni vuelta atrás — 5 CRÍTICOS

`F-8A3-004` (deja afuera las tres relaciones con trial y transcribe dos que no lo tienen) ·
`F-8B3-006` (transcribe el trial y deja **los tres compromisos de cobro sin vínculo**) ·
`F-8C2-001` (hay un punto de no retorno y **nadie eligió de qué lado empieza**) · `F-8C2-002`
(`DEC-MIG-001` y el §2.3 describen **dos operaciones distintas sobre las mismas cinco filas**) ·
`F-8C2-005` (**no hay rollback, y la palabra no aparece en ningún documento de diseño**).

Y `F-8A3-009`, ALTA pero estructural: **nadie la ejecuta.** No es una unidad de trabajo en ninguna
de las 22, y cada mitad delega en la otra.

### R6 · El programa, como programa, no puede empezar todavía — 4 CRÍTICOS

Éste no es un defecto del diseño del sistema sino del andamiaje que lo construye, y es el único
racimo con arreglos baratos **hoy**.

| | |
|---|---|
| `F-8C2-003` | **verificado aparte en el repo**: los workflows declaran `main`, `staging` y `develop`, y **ninguno nombra `epic` ni un patrón `**`**. `ci.yml` corre en `pull_request` sólo hacia `main` y `staging`. Un PR de sub-épica → paraguas entra **sin lint, sin typecheck, sin tests y sin los guards**. `DEC-ARCH-007` dice convertir «no lo hagas» en «no se puede»: está escrita cuatro veces en las specs y **cero veces en el repo**, y el único camino con CI completa es el que la decisión prohíbe |
| `F-8C2-004` | el merge periódico de `staging` resuelve conflictos de **texto**, no divergencia semántica: un archivo que la rama larga borró y la corta llama mergea limpio y roto, y sin CI en el destino nadie lo ve hasta el PR final |
| `F-8C2-006` | `V1`, la única unidad sin dependencias, lleva `G8`, que falla si queda `commerce` en fuentes activas. Hacerlo pasar **es ejecutar FASE 5**, cuyo gate `DEC-METH-003` nadie abrió (1B está terminado, así que se puede abrir hoy) |
| `F-8C2-007` | decidir la pasarela **no destraba las nueve unidades bloqueadas: reabre la FASE 1C entera** |

---

## 3. La causa raíz, que ningún agente individual podía ver

Las cuatro convergencias tienen **la misma forma**:

> una regla validada contra el caso que la motivó, y después escrita como **cuantificador
> universal** sobre un dominio que incluye el caso donde es falsa.

Y las cuatro son una contradicción **entre dos capítulos, nunca dentro de uno**: contrato↔glosario,
modelo-billing↔`D7`, autorización↔máquinas, addons↔conciliación. Cuatro de cuatro.

**De ahí sale el quinto defecto, que es el hallazgo del programa y no está en ningún informe
individual**: el método cierra huecos *por capítulo* — «un hueco se cierra cuando un capítulo dice
qué pasa en todos sus casos». Eso comprueba que **un capítulo cubre sus casos**; nunca que **una
regla cubra los suyos**, porque los suyos viven en otros capítulos.

**No existe ningún lugar donde una regla se verifique contra el dominio completo que cuantifica** —
y el único artefacto que podía hacerlo era el documento único que el desarme del 2026-09-18 retiró.

El índice del núcleo ya había escrito ese argumento para el glosario y los invariantes
(*«poder preguntar una vez si están todos»*) y no extrajo la consecuencia general. `F-8C1-001`,
`F-8C1-002` y `F-8C1-005` son tres instancias más del mismo defecto.

---

## 4. Lo que el desarme perdió, medido

El desarme se verificó contando encabezados: **105 de 105**. Esa verificación es estructuralmente
ciega, y `C1` midió qué se escapó reconstruyendo los originales desde git
(`git show <sha>^:<path>` sobre el path retirado).

**Encabezados y filas de tabla sobrevivieron intactos** — 0 perdidos de 105 y de 243. Lo que se
perdió fue de otras tres granularidades:

1. **La completitud de una lista** — `F-8C1-005`: cuatro secciones cuyo valor declarado era estar
   juntas (`19 §4`, `20 §2`, `20 §5`, `22 §4`) se partieron **conservando en cada mitad la frase
   que afirma completitud** (*«la lista que nadie tiene junta»*, *«¿están todos?»*, *«las seis
   preguntas»*). Las dos mitades siguen diciendo que están completas.
2. **La asignación de una celda** — `F-8A3-014`: `Mi Cuenta · Mi Suscripción` era **una celda con
   dos superficies**, y al partirla Mi Cuenta terminó del lado de billing cuando la tabla de
   partición se la había asignado a verticales.
3. **El alcance de una regla** — `F-8A2-013`: el cap. 05 (idempotencia y concurrencia) se fue
   **entero** a billing, y verticales quedó con tres máquinas, tres relojes y un reconciliador
   **sin una sola regla de serialización**.

Y `F-8C1-006`: *«las dos épicas no se referencian entre sí»* **es falso 33 veces**, y lo escribió
el propio desarme.

> **Detector barato para la FASE 9**: listas ordenadas que no arrancan en 1, huecos de numeración,
> y tablas con una sola fila de datos.

---

## 5. Los límites de esta fase, declarados

1. **El capítulo 13 (Pagos) no existe.** `B1`, `B2` y `B3` atacaron 12 de 13 y cada uno dejó una
   sección de lo que **cae en ese hueco**. Arrastra `manual payments`, que no vive en ningún otro
   capítulo — y `F-8B3-015` mide la consecuencia: `manual_payment` no guarda monto, así que el pago
   manual no se puede comprobar ni reembolsar.
2. **«Impossible migration» se atacó a medias.** La FASE 5 (gap contra las 27 tablas) no está
   hecha, así que se atacó contra lo **medido**, no contra el código legacy. Lo que sobreviva se
   re-ataca después de la 5.
3. **Nada de esto se verificó ejecutando.** Es un diseño en papel; los caminos son argumentales y
   están sostenidos en citas textuales, que es lo que los vuelve refutables.

---

## 6. Dos falsos positivos, descartados

No todo sobrevivió a la pasada C, y queda registrado para que nadie los reabra:

- **La lista del cap. 19 §4 no perdió los ítems 3/5/6/7** — están en la otra mitad; la unión es
  1–14.
- **`G7` no falta** — está en billing por reparto. Su defecto es otro, y es `F-8C1-007`: vigila dos
  invariantes que verticales ya incumple.

---

## 7. Correcciones de registro que la fase encontró — NO APLICADAS

Van acá y no en sus archivos porque **el decision log y la matriz no se tocan sin el owner**. Cada
una está verificada.

| # | qué | dónde | verificación |
|---|---|---|---|
| 1 | **Los invariantes son 51, no 49.** El §64 aporta 37 y la tabla de decisiones tiene **14 filas** (`D1`…`D14`). La nota al pie («suma 14 sobre **12**») y el cierre («Cuarenta y nueve») son **anteriores a `D13` y `D14`**, que el propio §4 dice que se agregaron al cerrar el cap. 10 §4 | `nucleo/04-invariantes.md`, dos frases | filas contadas con `rg`; «ocho los sostiene la base» cierra: base 6 + base 2 = 8 |
| 2 | **La fila sin id de la matriz es un duplicado desactualizado**, no una novena `UNKNOWN`. La pregunta que decía no estar medida es `EX-33`: `VERIFIED`, 2026-09-16, producción con tarjeta real, tres de tres | `06-mp-validation-matrix.md`, nota al pie de su tabla | `contar-filas-de-la-matriz.py`: 89 filas / 49 `VERIFIED` / **8** `UNKNOWN` |
| 3 | **`RF-6`, `RF-7` y `RF-8` ya tienen «Para qué»**: las tres sirven a **reembolsar**, la única capacidad que el cap. 06 §10 declara en riesgo de plataforma. Y dos de ellas contienen el dato que invalida el mecanismo que las cita | `06-mp-validation-matrix.md`, celda «Para qué» | `F-8B1-008`, `F-8B1-012`, `F-8B1-013`, `F-8B3-011` |
| 4 | **El catálogo de guards no cierra**: dice once, las descomposiciones dicen trece, la spec dice siete | `F-8C1-010` | — |
| 5 | **Cuántas máquinas de estado hay**: cuatro respuestas vivas, y dos de las «nueve» no son máquinas | `F-8C1-011` | — |
| 6 | **Tres documentos del paraguas dan tres conteos distintos del decision log** | `F-8C2-017` | — |

> **Una regla de método que sale de la #1**: cuando varios agentes discrepan sobre un número,
> **dirime la aritmética del documento, no la mayoría**. Cuatro informes dijeron 49; la suma dice
> 51. Adoptar el consenso habría corregido tres lugares que hoy dicen bien.

---

## 8. Qué necesita la FASE 9 para arrancar

1. **Resolver los racimos, no los 141.** R1 a R6 cubren 31 de los 48 críticos, y cada uno tiene
   **una** causa.
2. **Decidir qué significa «resuelto»** para un hallazgo de FASE 8. Hoy el programa no lo declara
   (`F-8C2-016`), y sin eso la fase no tiene criterio de cierre.
3. **Propagar al trabajo ya publicado.** 22 issues de Linear y 27 fichas salieron el 2026-09-18;
   estos 141 hallazgos son del 2026-09-19, y la FASE 9 sólo manda actualizar decision log, spec,
   handoff y worklog (`F-8C2-011`). Nadie es dueño de propagar el cambio a Linear.
4. **Los arreglos de R6 son baratos hoy y caros después.** Los workflows que no conocen `epic/**`
   se arreglan en un PR; descubrirlo con meses de código adentro, no.
