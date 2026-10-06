---
title: "FASE 8 vuelta 3 · las decisiones del owner"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 8 vuelta 3 — las decisiones del owner

La vuelta 3 es la excepción declarada de `DEC-METH-016` al tope de `DEC-METH-013`. Dejó una
crítica levantada (`F-8V3A1-001`, racimo R1 de [`00-hallazgos.md`](./00-hallazgos.md)), que la
atribución ([`01-atribucion.md`](./01-atribucion.md)) dictaminó **preexistente**, y que el
consolidador propuso bajar a ALTA. Por las cláusulas 3 y 4 de `DEC-METH-013`, el owner elige su
destino y la lee antes. Las preguntas salen del §6 del consolidado y se contestan en lotes con
letras. Cada fila nombra la opción elegida.

| lote | racimo | qué pregunta | elige | ¿la recomendada? |
|---|---|---|---|---|
| A | R1 (`F-8V3A1-001`) | qué se hace con la única crítica: el reclamo de Partner verifica la cuenta del ocupante y el ocupante sigue adentro | **1**: baja a ALTA y se arregla en el diseño; reclamar verifica la cuenta y cierra todas sus sesiones y credenciales previas, y el link de reclamo se consume una sola vez | sí |
| B | R1 (`F-8V3A2-002`) | si una cuenta puede ser dueña de más de un Partner | **1**: una cuenta, un Partner; la base lo impide y el reclamo de un segundo deriva a soporte (el segundo negocio se reclama con otra cuenta) | sí |
| C | R2 | cómo se ordena la prueba gratis del corte respecto del catálogo que la define | **1**: el catálogo se carga en el paso 3, antes de las pruebas, como ya se hizo con los plazos; sin paso nuevo | sí |
| D | R4 | cuándo se puede dar de baja una cuenta con suscripción (`puedeCobrarle` en la ventana de reintento de la cancelación) | **1**: `puedeCobrarle` contesta sobre la cancelación confirmada por Mercado Pago; mientras no la confirme, contesta «sí» y la baja espera (hasta 3 días) | sí |
| E | R6 | qué hace el reenvío tardío de `A3` sobre una compra de addon mientras `EX-43` siga `UNKNOWN` | **1**: `A3` sólo confirma, nunca crea; sin id de orden abandona sin reenviar; la comprobación de órdenes pagadas busca también por el identificador del pedido (se mide si el proveedor lo permite); una pantalla nueva con una compra del mismo producto sin resolver no deja comprar otra; la misma identidad de compra da el candado del addon recurrente | sí |
| F | R8 (`F-8V3C2-004`) | si las anuales vivas el día del corte vuelven al owner antes del 1b o se sostiene «no se devuelve» | **3**: se sostiene «no se devuelve» para todas y el guion se reescribe sin «la prueba lo compensa». Hecho aportado por el owner: no hay anuales vivas en el sistema viejo ni las va a haber antes del corte | **no** (la recomendada era la 1, que vuelvan al owner con el monto a la vista; el owner aporta el hecho que la vuelve innecesaria) |
| G | R8 (`F-8V3B3-001`) | qué detector tiene el titular que sólo conoce el proveedor, si el `GET` trae el `payer_email` vacío | **1**: se mide en sandbox si otra lectura trae el pagador (búsqueda sin filtro, pago asociado); si ninguna, la declaración dice que no tiene detector | sí |
| H | R10 (`F-8V3A3-006`) | si la baja de cuenta conserva el seudónimo mientras la pregunta 5 al abogado sigue abierta | **1**: se conserva hasta la respuesta; si es en contra, soporte los borra todos con una tarea puntual (se anota quién y cuándo) | sí |
| I | R13 (`F-8V3A1-005`) | si postular un Partner exige cuenta | **2**: se postula sin cuenta, como segunda excepción del guest en el paso 1, con límites contra el abuso (qué límites: lote siguiente) | **no** (la recomendada era la 1, que postular exija cuenta) |
| J | R14 | qué se hace con lo que una restauración del corte no deshace (altas del paso 6, pagos asentados antes de un aborto, la promoción a `main`) | **2**: se declara con su causa en el «NO cierra» del corte; las tres situaciones exigen una falla previa | **no** (la recomendada era la 1, tres reglas en el procedimiento del corte) |
| K | R17 (`F-8V3B3-002`) | si `EX-45` (cancelación del proveedor que se deshace) condiciona la exención del barrido | **1**: el barrido sigue releyendo unos días una suscripción cancelada por rechazo antes de darla por terminada; el plazo entra a la lista cerrada de plazos | sí |
| L | R27 | si la revocación alcanza al addon de única vez comprado en la ventana | **1**: sí; se devuelve por un camino de devolución de órdenes, confirmando en sandbox cómo se devuelve una orden | sí |
| M | R13 (sigue de I) | qué límites tiene la postulación sin cuenta | **1**: captcha (Turnstile, que el sitio ya usa) y una sola postulación abierta por correo, la guarda de `PP1` que ya pasa a restricción de la base | sí |
| N | R3 (`F-8V3A3-002`) | qué pasa con `owner_suspended`, `plan_restricted` y `billing_unpublished_at`, que `U1` borra y la traducción del corte lee | **1**: sobreviven a `U1` como excepción temporal y nombrada que los guards de limpieza admiten hasta el corte; las borra una migración posterior al paso 3, después de la clasificación | sí |
| O | R22 | qué hace `PB13` con el lugar que la moderación cedió | **1**: la ficha que vuelve de la moderación entra a la misma cola ordenada que `PB3`/`PB7`; si le toca, recupera su lugar y la otra vuelve a esperar | sí |
| P | R21 | si el permiso de las acciones «sólo `SUPER_ADMIN`» se puede dar suelto | **1**: no; viene sólo con el rol, y asignar el rol es una acción administrativa nueva (la 26), registrada | sí |
| Q | R24 | cómo se impide que el borrado de una ficha inactiva (`PB9`) se adelante a un aviso atrasado de cobertura | **1**: el borrado exige que su plazo corra desde la última pérdida de cobertura, dato nuevo que devuelve el contrato; mientras no exista, no corre en la misma pasada en que ve la ficha sin cobertura por primera vez | sí |
| R | plazos 16 a 18 | los valores de la ventana de relectura de la cancelación por rechazo, el escalamiento de una marca abierta y la ventana de pagos y órdenes | **1**: 7 días, 7 días y 180 días | sí |
| S | R3 (lote N) | cuándo se borran las tres columnas viejas | **1**: en el mismo despliegue del paso 3, después de la clasificación (lo ya aplicado) | sí |
| T | R30 | qué se hace con lo que el viejo acepta entre el recuento del paso 2 y la migración del paso 3 | **1**: se repiten los recuentos con el viejo apagado, antes de migrar; si no coinciden, aborto (lo ya aplicado) | sí |
| U | R17 (lote K) | qué hace el barrido con una suscripción cancelada por rechazo que el proveedor revive dentro de la ventana | **1**: manda la cancelación que habría mandado, con sus 3 días de reintento y la marca si no se confirma; los cobros entrados quedan propuestos para devolver | sí |
| V | R9 | dónde vive la lista de sondas que el receptor de producción no debe cancelar | **1**: en el código del package del cobro, importada como módulo; si falta, no compila | sí |
| W | R26 | dónde se asienta la transferencia de un pagador manual que no cae en una cuota abierta | **1**: un segundo pago del mismo período, que abre la marca de cobro duplicado con propuesta de devolver (simétrico con la tarjeta) | sí |
| X | `F-8V3B3-004` | con qué fecha entra a la segunda corrida del detector del corte un alta sin `expire_date` | **1**: la fecha de creación más un ciclo, y la segunda corrida lista igual todo registro que siga abierto | sí |
| Y | R6 (lote E) | si dos addons recurrentes iguales sobre el mismo objetivo son una recompra legítima | **1**: no; el candado de la identidad de compra frena también si ya hay uno vivo | sí |
| Z | lote D, K | dónde se guarda que una relectura vio la suscripción cancelada | **1**: una columna con el instante de la primera relectura que la vio `cancelled`, en el vínculo con el proveedor | sí |
| AA | R1 | si el link de reclamo de un Partner lleva un secreto | **1**: sí; un secreto de un solo uso que viaja sólo en el aviso | sí |
| AB | log y matriz | si se aplican las nueve propuestas al log (siete 📌 y `DEC-AUTH-004`/`-005` nuevas) y las tres filas nuevas de la matriz (`EX-57` a `EX-59`) de `14-aplicacion-cierre.md` § «Para el owner», con Q sumado a `DEC-ARCH-006`, Y a `DEC-CONC-001` y los valores de R a `DEC-DATA-008` | **1**: sí, todo como está | sí |
| AC | R21 (lote P) | si quitarle el rol `SUPER_ADMIN` a una cuenta es también la acción 26 | **1**: la acción 26 pasa a «asignar o quitar el rol», con registro en los dos casos | sí |
| AD | log (`DEC-ARCH-006`) | si se corrige el 📌 recién aprobado que dice que el contrato devuelve cuándo perdió cobertura «una ficha» | **1**: se corrige a «la persona en esa vertical» (`coberturaPerdidaEn`) y se nombra `provider_link.cancelado_visto_en` | sí |
| AE | `VC3-cobro-02` | cuándo da por cancelada una suscripción `puedeCobrarle` tras una cancelación del proveedor por rechazo | **1**: contesta «sí» mientras no pase el plazo 16 (7 días) desde la primera relectura `cancelled`; la baja de cuenta espera | sí |
| AF | `VC3-cobro-03` | qué pasa con una transferencia (`MP6`) sobre una suscripción `CANCELLED` con la última cuota `DECLARED_UNPAID` | **1**: el pago va al motivo 2 (`COBRO_POSTERIOR_A_LA_BAJA`) con propuesta de devolver; no escribe cobertura | sí |
| AG | `VC3-VT-01` | qué ve quien abre un link de reclamo ya usado | **1**: «este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»; el hash del secreto se conserva tras el reclamo (sólo sirve con `owner_user_id` nulo) | sí |
| AH | `VC3-VT-02` | lo que el sistema viejo asentó después del backup del 2b y un aborto borra | **1**: se declara en el «NO cierra» del corte junto a las tres de J, con su causa | sí |
| AI | `VC3-VT-08` | quién borra el correo de una postulación hecha sin cuenta | **1**: la acción 24 alcanza también a una postulación sin cuenta: soporte la borra a pedido, con motivo y registro | sí |
| AJ | `VC3-VT-10` | si una cuenta con sesión y sin correo verificado puede postular | **2**: se le pide verificar el correo antes de postular | **no** (la recomendada era la 1, que postule como un visitante sin cuenta) |
| AK | `VC3-cobro-07` (`EX-58`) | qué hace `RF3` sobre una orden cuya relectura no trae el id de la devolución | **1**: la fila toma la devolución de la orden de su mismo monto; con dos del mismo monto, decide una persona; se mide si la relectura trae el monto de cada devolución | sí |
| AL | `VC3-VT-07` | dónde corre la carga del catálogo antes del paso 6 | **1**: en toda base que aplique las migraciones; el seed de demostración no carga catálogo donde ya hay uno | sí |
| AM | `VC3-cobro-03` (sigue de AF) | qué pasa con `MP6` sobre una `ABANDONED` de pagador manual con la primera cuota `DECLARED_UNPAID` | **1**: la misma regla de AF: motivo 2 con propuesta de devolver; no escribe cobertura | sí |
| AN | log y matriz | si se aplican los 📌 de `DEC-ARCH-006` (AE) y `DEC-AUTH-005` (AI, AJ), la corrección del resumen del log (16 de metodología) y lo que condicionan `EX-45` y `EX-58` | **1**: sí, todo | sí |

## Lo que no pidió decisión

El resto de los racimos (R5, R7, R9, R11, R12, R15, R16, R18 a R21, R23 a R26, R28 a R30, y la
parte de aplicación de R1, R3, R6, R13 y R17) es trabajo de escritura sin decisión de producto,
según el §6 del consolidado. Va a la tanda de aplicación.

## Contra la recomendación

Cuatro de cuarenta: F (con un hecho aportado por el owner que la vuelve innecesaria), I, J y AJ. La M
existe por arrastre de I. La J deja declaradas en el «NO cierra» del corte tres
situaciones con daño de clase crítica que exigen una falla previa.
