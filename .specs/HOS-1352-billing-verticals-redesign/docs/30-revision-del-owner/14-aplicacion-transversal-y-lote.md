---
title: "Revisión del owner · aplicación, tanda 4: lo transversal, y el lote del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación, tanda 4: lo transversal, y el lote del log y la matriz

C3 con `L2-a` a `L2-d` (el agrupamiento viejo de Gastronomía y Experiencia desaparece por completo),
N1 con `L1-e` y `L1-f` (la configuración de planes vive 100 % en la base, con cinco acciones
administrativas nuevas) y C9 con C11, `L2-g` y `L2-h` (los plazos configurables), de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `f08bb14b28`, sin commits, con el mapa de
[`01-impacto-producto.md`](./01-impacto-producto.md) § C3, § C9 y C11 y § N1. Leídos antes, enteros,
los registros de las tres tandas anteriores
([`11-`](./11-aplicacion-simplificacion.md), [`12-`](./12-aplicacion-verticales-y-contrato.md),
[`13-`](./13-aplicacion-cobro.md)). Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`,
`D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y `$B/` la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, 2026-09-28, <punto>)`. **Los números nuevos no
reusan ninguno retirado**: las acciones nuevas son de la **decimoctava a la vigesimosegunda** (la
16 sigue retirada y la 17 es la migración de la tanda 3), y el paso nuevo del corte es el **6**.
**`G-R3` y `G-R5-B` no se retiran con su número: pasan a ser validaciones del panel y conservan su
nombre**, porque las citan unos treinta lugares del diseño que siguen diciendo la verdad (*«la vigila
`G-R3`»* sigue siendo cierto, ahora de una validación); su fila en `V/20` §2 lo dice y no se cuentan
entre los guards. **En el texto nuevo no escribí la palabra**: el diseño dice *«el agrupamiento viejo
de Gastronomía y Experiencia»*, como pidió el owner para la presentación (`L2-d`). Los tachados
conservan la palabra vieja, y eso es un caso vecino (§3, punto 4-b).

## 1. Qué se aplicó

### C3, `L2-a`, `L2-b`, `L2-c` · el agrupamiento viejo desaparece, ni como histórico

- El guard, en todo el repositorio y con el PDR como única exención por nombre:
  `V/20:56` «en cualquier archivo versionado del repositorio»
- `V/20:56` «Una sola exención, por nombre: el PDR de HOS-1352 (`00-PDR.md`)»
- `V/20:56` «El guard arma el patrón sin escribir la palabra, para no fallar sobre su propio texto.»
- Lo que el guard no puede resolver solo, dicho en su fila:
  `V/20:56` «cómo corre el guard mientras tanto no está decidido»
- Su espejo: `$V/spec.md:403` «con el PDR como única exención por nombre»
- El invariante 32, que miraba sólo las fuentes activas:
  `nucleo/04:78` «el agrupamiento viejo de Gastronomía y Experiencia no existe, ni como histórico»
- `nucleo/04:78` «el único archivo exento es el PDR, por nombre y con la causa escrita»
- Las dos menciones que la trataban como histórica, reescritas:
  `V/21:518` «desaparece por completo, ni como histórico»
- La limpieza del producto es de verticales, con migración de datos, y el tipo de partner se
  renombra: `V/21:523` «el tipo de partner se renombra a lo que es»
- `B/21:431` «De este lado lo nombran el dominio de producto»
- La foto de la base, paso nuevo del corte, después del 5b:
  `D/16:142` «reemplazar la historia de migraciones de la base por una foto de la base tal como queda después del corte»
- `D/16:142` «Ensayado antes en `staging`»
- `D/16:142` «Va después del 5b»
- `D/16:142` «El commit del repositorio y la reescritura de las dos tablas van juntos»
- La herramienta, de V6: `D/16:310` «La foto de la base y el reemplazo de las dos historias»
- El fin del corte y las escrituras a mano: `D/16:140` «y la foto del paso 6»
- `D/16:196` «El paso 4, el 5b y el 6 son las tres escrituras a mano del corte»
- Las unidades: `$V/descomposicion.md:482` «la limpieza del agrupamiento viejo de Gastronomía y Experiencia en el producto»
- `$V/descomposicion.md:483` «la foto de la base y el reemplazo de la historia de migraciones y del ledger del seed»
- El criterio de `V1`: `$V/descomposicion.md:558` «en cualquier archivo que no sea el PDR falla»

### N1, `L1-e`, `L1-f` · la configuración de planes vive 100 % en la base

- El § nuevo del núcleo: `nucleo/02:82` «Los valores nacen una vez y después sólo los cambia el panel»
- El archivo se borra: `nucleo/02:87` «No existe archivo de valores, ni como punto de partida del seed.»
- La migración única (`L1-e`): `nucleo/02:91` «El catálogo de producción nace el día del corte con una migración de datos única»
- Las cinco acciones (`L1-f`): `nucleo/02:94` «Después, los valores sólo cambian por cinco acciones administrativas»
- El catálogo de claves sigue en código: `nucleo/02:99` «El catálogo de claves sigue en código»
- Lo que CI miraba y ahora mira el panel o la base:
  `nucleo/02:102` «Lo que antes miraba un guard de CI y ahora lo rechaza el panel o la base.»
- `G3` pierde una dirección, que pasa a la base:
  `nucleo/02:64` «la segunda es una»
- `V/20:52` «La otra dirección, una clave de la base que no está en el catálogo, deja de ser del guard»
- `G-R3` pasa a validación del panel, con su nombre:
  `V/20:62` «Deja de ser un guard de CI y pasa a ser una validación del panel, con el mismo nombre»
- `V/20:279` «lo que sigue vale para ella»
- Las cinco acciones, de la decimoctava a la vigesimosegunda:
  `nucleo/08:174` «Es la decimoctava»
- `nucleo/08:175` «Es la decimonovena»
- `nucleo/08:176` «Es la vigésima»
- `nucleo/08:177` «Es la vigesimoprimera»
- `nucleo/08:178` «Es la vigesimosegunda»
- `nucleo/08:182` «La tabla tiene VEINTIUNA filas vivas»
- `nucleo/08:192` «dicen veintiuna desde la misma revisión»
- `nucleo/08:196` «las cinco del catálogo también lo son»
- Sus espejos: `V/17:338` «veintiuna acciones del capítulo 08 §3 llevan permiso propio»
- `V/17:369` «veinte acciones del capítulo 08 §3, las catorce primeras y de la decimoséptima a la vigesimosegunda,»
- `V/17:449` «Las cinco del catálogo, de la decimoctava»
- `V/17:476` «veinte acciones administrativas»
- `V/17:369` «y de la decimoséptima a la vigesimosegunda»
- `$V/spec.md:213` «y de la decimoctava a la vigesimosegunda, las cinco del catálogo»
- `B/19:206` «de la decimoctava a la vigesimosegunda, las cinco del catálogo»
- `B/03:2070` «dicen veintiuna, y por»
- El paso 3a del corte: `D/16:135` «la migración de datos única del catálogo»
- `D/16:135` «y las demás validaciones del panel sobre el catálogo y los plazos»
- Lo que se borra, medido: `B/21:437` «El archivo de configuración de planes se borra entero»
- `B/21:443` «Las 11 migraciones de datos del seed que importan»
- Los editores: `V/19:88` «el editor del catálogo de planes y claves, y el de los plazos de verticales»
- `B/19:218` «el editor de precios, complementos, códigos promocionales y plazos de cobro»
- `B/19:209` «Cuatro cosas»
- Los días de prueba de 0 a más son una validación de publicar (cierra el caso vecino 10 de la
  tanda 2): `V/11:392` «es una validación de»
- `$V/descomposicion.md:478` «los días de prueba cuelgan de la versión»
- Las unidades: `$V/descomposicion.md:484` «la migración de datos única del catálogo»
- `$B/descomposicion.md:623` «Lo que la revisión del owner agregó en la tanda 4, y qué unidad lo construye»
- `$B/descomposicion.md:627` «Ninguna dependencia nueva entre épicas»
- El índice del núcleo: `nucleo/00:109` «cómo nacen los valores y quién los cambia, y los plazos configurables»

### C9, C11, `L2-g`, `L2-h` · los plazos configurables

- El § nuevo: `nucleo/02:121` «Los plazos que deciden cuándo pasa algo»
- `nucleo/02:125` «Los números del diseño pasan a ser valores iniciales»
- La lista cerrada, quince plazos: `nucleo/02:129` «La lista, cerrada.»
- Lo que queda afuera, con `L2-g`: `nucleo/02:151` «Ningún plazo técnico»
- `nucleo/02:154` «Los que fija Mercado Pago o la ley»
- Cada reloj guarda la versión (`L2-h`): `nucleo/02:161` «Cada reloj guarda la versión de plazos con la que arrancó»
- El registro de cada cambio: `nucleo/02:160` «ese registro es el de cada cambio»
- Lo que el panel rechaza: `nucleo/02:167` «archivar antes que borrar»
- `nucleo/02:170` «cada aviso antes del hecho que anuncia»
- Se cierra el ítem del espacio entre archivado y borrado:
  `nucleo/02:176` «Y el espacio entre el archivado y el borrado queda garantizado»
- `V/03:485` «con la versión de plazos que guarda la ficha»
- `V/03:485` «Y escribe la fecha de borrado que anuncia»
- `V/03:490` «el más tardío de dos días»
- `V/03:781` «Un archivado que corrió tarde anuncia una fecha más tarde»
- Las columnas de la ficha: `V/02:413` «Y guarda dos columnas más»
- `G-R5-B` pasa a validación de la acción de cambiar un plazo, con la cota atada al plazo de borrado:
  `V/20:68` «Rechaza un `N` de `PB5` que, en su peor caso en días (meses de 31), no quede por debajo del plazo de borrado»
- `V/20:230` «el ⚠️ de»
- `PB5` deja de validar contra 6 meses literales:
  `V/03:486` «validada por el panel contra el plazo de borrado de la misma versión»
- Los correos: `nucleo/07:224` «Y son plazos de la lista cerrada»
- `nucleo/07:248` «el previo al borrado cuenta sobre la fecha que anunció el archivado»
- La migración de la tanda 3: `B/10:158` «es el plazo 12 de»
- Las unidades: `$V/descomposicion.md:485` «los plazos de verticales»
- `$B/descomposicion.md:636` «los plazos de billing»

### Los guards y sus recuentos

- `B/20:384` «pasan a ser validaciones del panel»
- `B/20:385` «sin `G-R3` ni `G-R5-B`, que pasan al panel»
- `B/20:386` «salen `G-R3`, de `V2`, y `G-R5-B`, de `V6`»
- `$V/spec.md:66` «pasan a ser validaciones del panel, por N1 y C9, y conservan su fila sin contarse»
- `$V/spec.md:389` «y `G-R3` y `G-R5-B` pasan a ser validaciones del panel»
- `$V/spec.md:391` «son los `G-R*`»
- Las columnas de guards de `V2` y `V6`:
  `$V/descomposicion.md:55` «que V2 construye igual»
- `$V/descomposicion.md:59` «y no un guard)»
- Los totales: `$V/descomposicion.md:522` «y `G-R3`, de `V2`, y `G-R5-B`, de `V6`, pasan a ser validaciones del panel»
- `$B/descomposicion.md:726` «y `G-R3`, de `V2`, y `G-R5-B`, de `V6`, pasan a ser validaciones del panel»

**Lo que no toqué**: la presentación, engram y las memorias (`L2-d`: el owner las limpia a mano);
el `CLAUDE.md` raíz y el guard `check-seed-dual-write.sh`, que no son del diseño (§3); los informes
históricos, el log y la matriz (§4).

## 2. Conteos que cambiaron

Recontados con script sobre la tabla o el bloque, no restados.

| qué | antes | ahora | espejos corregidos |
|---|---|---|---|
| acciones administrativas vivas | 16 | 21 (22 filas, la 16 tachada) | `nucleo/08` (tres), `V/17` (nueve), `B/03` (siete), `B/19` §6, `$V/spec.md` |
| acciones que son capacidad del actor | 15 | 20 (todas menos la decimoquinta) | `V/17` (tres), `nucleo/08` |
| filas de `V/20` §2 contadas como guards | 21 | 19 (`G-R3` y `G-R5-B` pasan al panel, conservan su fila) | `B/20` (tabla de recuento), `$V/spec.md` (índice y §5) |
| `G-R*` fuera de la tabla del §5 de `$V/spec.md` | 12 | 10 | `$V/spec.md` |
| guards distintos del programa | 35 | 33 | `B/20`, `$B/descomposicion.md` §4, `$V/descomposicion.md` §4 |
| guards con unidad | 35 | 33 | `B/20` |
| guards por épica | 20 verticales · 15 billing | 18 · 15 | `$V/descomposicion.md` §4, `$B/descomposicion.md` §4 |
| pasos del corte | 16 filas (0 a 5b) | 17 (entra el 6) | `D/16` (el fin del corte, las escrituras a mano, las herramientas) |
| escrituras a mano del corte | 2 | 3 | `D/16` |
| herramientas del corte | 5 | 6 | `D/16` |
| plazos configurables | 0 | 15, en lista cerrada | `nucleo/02` §1.5 |
| columnas de `listing` que nacen | 0 | 2 (`plazos_version`, `borrado_anunciado`) | `V/02` §2.5, `V/03` §9 |
| filas del panel en `B/19` §6 | 3 | 4 | `B/19` |
| filas del panel en `V/19` §6 | 3 | 4 | sin espejo con cifra |
| ítems declarados abiertos en `V/03` §9, ⚠️ | punto 7 abierto | punto 7 cerrado | `nucleo/02` §1.5 |

**Lo que no se movió**: los 52 invariantes (el 32 cambia de alcance, no de número); los cinco hechos
del reloj (`plazos_version` se escribe con ellos, no es un hecho); las once dependencias entre épicas
(cada mitad construye sus acciones y sus plazos); los 24 motivos; las 33 transiciones vivas de la
Suscripción; las filas de la matriz (esta tanda no propone ninguna).

## 3. Casos vecinos de las cuatro tandas

Juntados sin duplicar; cada uno con su recomendación. Entre corchetes, la tanda y el número en su
registro. **Cerrado por una tanda posterior** y que no se repite: el 10 de la tanda 2 (quién
construye el rechazo de los días de prueba: `V2`, tanda 4).

### El corte y su proceso

1. **El correo de baja del sistema viejo en el paso 1b choca con C12** [T1-1]. Recomiendo no tocar
   el código viejo y que el owner lo anticipe en su aviso en persona, como ya dice el guion.
2. **La constancia de que la pérdida se avisó** [T1-2]. Recomiendo que el owner anote a quién llamó
   y cuándo en la misma lista que arma el script del corte.
3. **Dónde vive el script del corte y qué es archivarlo** [T1-3]. Recomiendo versionarlo en el repo
   (`scripts/cutover/`) y archivarlo borrándolo en un commit posterior al corte.
4. **Si el §4.4 de `D/16` cierra `rollout`** [T1-4]. Recomiendo darlo por cerrado en lo que hace a
   ramas; el orden de despliegue ya es el §4.2.
5. **El paso 4c puede quedar sin sujeto** [T2-7]. Recomiendo medir en el paso 0 si el viejo servía
   alguna `L5`/`L7` o `PURGED`.
6. **Gate o recuento de un dueño con varias fichas a la vista** [T2-8]. Recomiendo un recuento en el
   paso 0 que vuelve al owner si da más de cero, sin ser gate.
7. **La lista de pasos de la baja de cuenta manual** [T2-9]. Recomiendo escribirla antes del corte,
   con el orden: primero la baja del cobro, después `PB12` por ficha, después la cuenta.
8. **`G8` antes del corte** [T4]. Hasta el paso 6 la historia de migraciones y el ledger del seed
   nombran la palabra, así que un `G8` que falla en todo el repo nace rojo y `V1` no se puede
   terminar. Recomiendo que `V1` lo construya con una lista de pendientes cerrada (las dos
   historias) que el paso 6 vacía, y que un build destinado a producción después del corte falle si
   la lista no está vacía.
9. **Las once migraciones de datos del seed que importan la configuración** [T4]. Dejan de compilar
   cuando el archivo se borra en la rama, antes del paso 6. Recomiendo congelarlas con sus valores
   adentro hasta que el paso 6 las saque.

### Verticales

10. **Qué `desde` ancla con más de un título vivo** [T2-1]. Recomiendo el del título que da la
    cuota; con dos, el que arrancó primero.
11. **El `desde` del título `BASE` es el alta de la cuenta** [T2-2]. Recomiendo confirmarlo el día
    que la versión de piso otorgue un entitlement medido.
12. **Una pausa que termina sin volver** [T2-3]. Recomiendo que todo fin de pausa, por cualquier
    camino, reinicie el reloj de retención: si no, `PB9` corre al día siguiente sobre fichas con
    más de 180 días.
13. **Una ficha moderada desde `ARCHIVED`** [T2-4]. Recomiendo lo escrito: vuelve por el origen de
    su archivado.
14. **Si los dos niveles de moderación valen para la presencia de Partner** [T2-5]. Recomiendo
    sólo fichas.
15. **El correo de confirmación del borrado en todo `PB12`** [T2-6]. Recomiendo que salga en todo
    `PB12`, no sólo sobre una moderada.
16. **Un guard para `retenciónDetenida`** [T2-11]. Recomiendo agregarlo como una mitad más de
    `G-R6-B`, barata y con el mismo recorrido.
17. **La prueba del corte en una vertical con días en cero** [T2-12]. Sin población; recomiendo
    nada.
18. **La numeración de los hechos del reloj** [T1-5]. Recomiendo no renumerar.
19. **El nombre del tipo de partner** [T4]. Lo define el owner (`L2-c`); sin él la migración de
    datos de `V1` no se puede escribir.

### Cobro

20. **Los siete días de `S37`** [T3-1]. `nucleo/02` §1.5 ya los lista entre los técnicos, no
    configurables. Recomiendo confirmar los siete días.
21. **«A 30 y a 7 días» de la fecha de cada cliente** [T3-2]. Recomiendo confirmar la lectura.
22. **La migración como fila propia** [T3-3]. Con la tanda 4 *«publicar una versión de plan»* es la
    decimoctava; recomiendo que la migración siga siendo la decimoséptima, aparte.
23. **`S37` la corre el sistema** [T3-4]. Recomiendo confirmar que es una transición que aplica lo
    que la persona firmó.
24. **Una cohorte que incluye la cuenta del propio `SUPER_ADMIN`** [T3-5]. Recomiendo excluir su
    fila, no rechazar el acto.
25. **Cancelar durante los siete días** [T3-6]. Recomiendo no deshacer la mutación y mandar un
    correo que lo explique.
26. **`PARA_RESOLVER` sin plazo** [T3-7]. Recomiendo sin plazo, con la antigüedad visible en el
    listado del panel.
27. **Una cortesía temporal el día de la migración** [T3-8]. Recomiendo que espere, como está.
28. **Lo que queda afuera de las dos listas del falso** [T3-9]. Recomiendo sumarlo a la segunda
    lista como comportamiento medido.
29. **Tres cifras de la presentación que el repo no sostiene** [T3-10]. Recomiendo corregir la
    presentación.
30. **`G16` no mira las dependencias hacia otros packages compartidos** [T3-11]. Recomiendo que el
    package del cobro sólo dependa del package del contrato y de packages npm.
31. **Dónde vive el reloj adelantable** [T3-12]. Recomiendo un package de pruebas compartido que
    importen las dos mitades.
32. **La regla de smoke del `CLAUDE.md`** [T3-13]. Recomiendo actualizarla cuando exista el E2E de
    cada sección.
33. **La autorización del owner para la batería mensual en producción** [T3-14]. Recomiendo que la
    custodie el owner y la renueve cada mes.
34. **Qué correo manda Mercado Pago cuando la migración sube el monto** [T3-15]. Recomiendo una fila
    nueva de la matriz.
35. **`G17` no verifica que la lectura sea del mismo acto** [T3-16]. Recomiendo no agregarlo ahora.
36. **La fila 6 de dependencias creció** [T3-17]. Recomiendo dejarla así.
37. **La cola de `B/12` §2 no tiene transición** para el descenso de un downgrade [T3-18].
    Recomiendo nombrarla.
38. **Una fila de `B12` de la discontinuación sin tachar en `$B/descomposicion.md` §2.3** [T3-19].
    Recomiendo tacharla.
39. **El receptor nuevo y el descarte de IPN** [T3-20]. Recomiendo que registre los IPN sin actuar
    hasta que `WH-6` esté medido.
40. **`M-SUB-03` en el frontmatter de `B/10`** [T1-6]. Recomiendo dejarlo como *«cierra»* (fuera de
    esta versión).

### Lo transversal (tanda 4)

41. **El corpus del diseño y el resto del repo nombran la palabra** [T4]. `G8` falla en todo el
    repositorio con el PDR como única exención, y la nombran también el log, la matriz, los
    informes históricos (el `08-phase-1b-code-discovery.md` sólo, 66 veces), otras specs, el
    `CLAUDE.md` raíz y 21 archivos de i18n; y los tachados de este diseño la conservan. Los informes
    y el log no se editan. Recomiendo que, al cerrar HOS-1352, el corpus histórico salga del repo
    (a Linear o a un artifact) y quede en el repo sólo el diseño vigente, reescrito en una pasada
    mecánica que también limpie los tachados.
42. **Los datos de planes de desarrollo y de las pruebas** [T4]. Recomiendo tratarlos como datos de
    demostración, fuera del dual-write, y sacar de `check-seed-dual-write.sh` y de la regla del
    `CLAUDE.md` la rama de configuración de billing.
43. **Cinco plazos sin valor inicial escrito** (el `N` de `PB5`, los avisos previos de retención, el
    techo de días de prueba, la postulación atrasada y la espera tras un rechazo) [T4]. Los fija el
    owner antes del corte, en la migración única del catálogo.
44. **El piso de 60 días de `DEC-MP-002`** [T4]. La decisión dice *«al menos 60 días»*, así que con
    la regla 4 de `nucleo/02` §1.5 el aviso de un aumento o de una migración sólo se puede alargar.
    C9 dice que todo plazo es configurable y el 60 no es de la ley (`B/22`). Recomiendo dejar el piso
    en 60 hasta que el owner diga otra cosa: bajarlo empeora el aviso al cliente.
45. **Si alargar un plazo alcanza a los relojes ya arrancados** [T4]. Con `L2-h` cada reloj cuenta
    con su versión, así que alargar tampoco los mueve. Recomiendo dejarlo así: es lo más previsible,
    y alargar una migración ya anunciada movería una fecha avisada.
46. **Si configurar el 90 y el 180 es un apartamiento del §25 del PDR**, que los fija [T4].
    Recomiendo declararlo: sería el décimo.
47. **Una pantalla o dos para los plazos** [T4]. Recomiendo una sola, compuesta en la app del panel,
    que es la raíz de composición que `G14` ya exceptúa.
48. **`plazos_version` no está bajo ningún guard de escritores** [T4]. Recomiendo extender la mitad
    *(a)* de `G-R6-B` a esa columna.
49. **El catálogo de claves sigue en código** [T4]. Lo apliqué como el diseño ya decía (`nucleo/02`
    §1.2); el owner no lo decidió explícitamente. Recomiendo confirmarlo.
50. **La cota de `G-R5-B` cambia** [T4]. El owner la había fijado en 6 meses literales el
    2026-09-25; con el 180 configurable, la tanda la ata al plazo de borrado. Recomiendo confirmarlo
    (va en `DEC-DATA-008`, abajo).

## 4. Lote para el log y la matriz (pide OK del owner)

Consolida lo propuesto por las cuatro tandas. Cada ID está grepeado en `01-decision-log.md` o en la
matriz el 2026-09-28: **no existen** `DEC-MIG-006`, `DEC-DATA-006`, `DEC-DATA-007`, `DEC-DATA-008`,
`DEC-SUB-023`, `DEC-TEST-003`, `DEC-ARCH-012` ni `DEC-ARCH-013` (los últimos de cada prefijo son
`DEC-MIG-005`, `DEC-DATA-005`, `DEC-SUB-022`, `DEC-TEST-002` y `DEC-ARCH-011`), ni `EX-51`, `EX-52`,
`EX-53` ni `WH-6` (la última `EX` es `EX-50`). **Propuestas que se pisaban, resueltas**: el 📌 de
`DEC-ARCH-006` de la tanda 1 lo reemplaza el de la tanda 2; el 📌 de `DEC-RF-008` de la tanda 1
(quince acciones) lo reemplaza uno solo con la cifra de las cuatro tandas; `DEC-DATA-002` recibe el
📌 de la tanda 1 y el de la tanda 4 juntos, y el SUPERSEDED EN PARTE de la tanda 2; el 📌 de
`DEC-MP-002` junta el de la tanda 3 y el de la tanda 4; el 📌 condicional de la tanda 1 sobre
`DEC-DATA-004` **se cae**: grepeada, no nombra la lista de hechos.

### 4.1 Decisiones nuevas (ocho)

1. **`DEC-MIG-006` (tanda 2; C12, `L1-a`, `L1-b`)**. *«El día del corte, las fichas que estaban a la
   vista (`L8`) nacen `PUBLISHED`, como recién creadas, y la migración estructural le escribe a cada
   `(dueño, vertical)` con una de ellas una fila de `trial` en `TRIAL_ACTIVE` que arranca en el
   instante del corte, con el seudónimo de la función de `T1` y la campaña previa. Las que el sistema
   viejo tenía bajadas por falta de pago (`L5`, `L7`) nacen en `DRAFT`, y cae entera la regla `R15`.
   Gates del corte: la lista de proveedores del seudónimo cerrada y medida antes del corte, y el
   recuento de cuentas de la cartera que comparten seudónimo en la misma vertical en cero. Un dueño
   con más de una ficha a la vista no se diseña: hoy no hay ninguno. Las dos cuentas del owner
   reciben la prueba y el grant del 3b; `T2` la consume. SUPERSEDE a `G1-1` (R1, FASE 9 vuelta 1) en
   lo que decía de la cartera, y precisa `DEC-MIG-005` punto 3: el corte sigue sin sembrar trials
   consumidos y siembra uno activo.»*
2. **`DEC-DATA-006` (tanda 2; C14, `L1-c`)**. *«La pausa pedida por el dueño detiene el reloj de
   retención de sus fichas en esa vertical: mientras dure no se archivan, no se borran y no reciben
   avisos de retención; al volver, el reloj se reinicia (hecho 2). Cruza como una pregunta de ida
   del contrato, `retenciónDetenida(user, vertical)`, que contesta billing (sí sólo con una `PAUSED`
   por `CUSTOMER_REQUEST`) y que leen SÓLO `PB4`, `PB5`, `PB9` y los avisos de retención, al
   ejecutar. No va en `fuentes` ni en `cubierto`. Salen `D16` y `G-R5`. SUPERSEDE a `DEC-DATA-002`
   en lo que decía de que el reloj corre durante la pausa y en la desigualdad que la protegía.»*
3. **`DEC-DATA-007` (tanda 2; C10, `L2-i`, `g3`)**. *«Moderación en dos niveles, a elección del
   admin y cambiable en las dos direcciones: pedir un arreglo sin bajar la ficha (una marca,
   `pedido_de_arreglo`, no un estado) o bajarla (`MODERATED`). Al levantar la baja, o al pasarla a
   sólo pedido, la ficha vuelve a donde estaba: `DRAFT` si era borrador (`PB11`), y si estaba
   publicada o bajada por billing, `UNPUBLISHED_BY_BILLING` con `PB3` en el mismo acto (`PB13`).
   Sobre una `MODERATED` el dueño puede verla, exportarla, editarla y borrarla (`PB12`, con correo de
   confirmación), no publicarla. Avisos al pedir, al cambiar de nivel y al levantar; listado de
   arreglos pendientes en el panel. Sigue siendo una acción administrativa con un permiso.»*
4. **`DEC-SUB-023` (tanda 3, con el agregado de la tanda 4; C15, `L1-g`, `L1-h`, C9)**. *«Migrar a
   los clientes de un plan retirado a una versión vigente y vendible de la misma vertical es un acto
   aparte del `SUPER_ADMIN` (la acción administrativa 17), con aviso previo de 60 días por defecto,
   configurable como el plazo 12 de `NUCLEO/02` §1.5 y nunca menor que el mínimo de `DEC-MP-002`, y
   tres correos (al anunciar, a 30 y a 7 días de la fecha de cada cliente). La migración guarda la
   versión de plazos con que se anunció. Se aplica a cada cliente en su renovación, la primera
   posterior a cumplirse el aviso, también en el anual. Si el destino ofrece su ciclo, `S37` muta el
   monto sobre la misma autorización siete días antes, sin re-autorizar, y el cambio de versión entra
   en la renovación por la cola de `B/12` §2; si no lo ofrece, queda para resolver a mano. El
   excedente tiene la fecha de aplicación; pausados y en grace esperan a volver; quien cambia de plan
   o se da de baja durante el aviso sale; el `SUPER_ADMIN` puede cancelar la migración para los que
   no se aplicaron, con el correo "ya no cambia nada". No es el upgrade de `DEC-SUB-007` ni el
   downgrade de `DEC-SUB-008`: es un tercer camino.»*
5. **`DEC-TEST-003` (tanda 3; C13, `L3-c`, `L3-d`, N3, `L3-e`, N4, `L3-f`)**. El texto exacto de
   `13-aplicacion-cobro.md` §3 punto 5, sin cambios: las dos listas cerradas del falso (trece
   mentiras medidas y seis reglas propias), la batería semanal, mensual y a mano, el falso como
   servidor, el reloj adelantable, el recorte del smoke manual y los guards `G15`, `G16` y `G17`.
6. **`DEC-ARCH-012` (tanda 4; C3, `L2-a` a `L2-d`)**. *«El agrupamiento viejo de Gastronomía y
   Experiencia desaparece por completo, ni como histórico: se deja la excepción del §55.1 del PDR
   (auditoría, historia de migraciones, datos legacy). `G8` falla si su nombre aparece, sin
   distinguir mayúsculas, en cualquier archivo versionado del repositorio, con una sola exención por
   nombre, el PDR, que no se edita (la causa va escrita en el guard). El día del corte, después del
   5b, la historia de migraciones de la base se reemplaza por una foto de la base tal como queda, y
   en producción se anota como aplicada; lo mismo con las migraciones de datos del seed; ensayado
   antes en staging, con backup (`16-fase-7…` §4.2, paso 6, de V6). El rol de dueño de comercio, sus
   siete permisos, la tabla de contactos de alta y el tipo de partner que lo nombra entran en la
   limpieza como trabajo de verticales, con su migración de datos (de V1), y el tipo de partner se
   renombra a lo que es, con un nombre a definir con el owner. Los datos que lo nombren se reescriben
   o se borran. La presentación se reescribe como "el agrupamiento viejo de Gastronomía y
   Experiencia", y engram y las memorias se limpian a mano. Es un apartamiento declarado del §55.1
   del PDR.»*
7. **`DEC-ARCH-013` (tanda 4; N1, `L1-e`, `L1-f`)**. *«La configuración de planes vive 100 % en la
   base. El archivo de configuración de planes de hoy (`packages/billing/src/config/`, 11 archivos y
   3378 líneas) se borra entero, con lo que lo lee sólo para eso, y no queda archivo de valores ni
   como punto de partida del seed. El catálogo de producción nace el día del corte con una migración
   de datos única, que corre una vez en el paso 3a y nunca más es fuente de nada. Después, los
   valores sólo cambian por cinco acciones administrativas nuevas, de la 18 a la 22, sólo
   `SUPER_ADMIN`, auditadas y con una confirmación que dice qué cambia: publicar una versión de
   plan, fijar el precio de un ciclo, publicar una versión de complemento, crear o cerrar un código
   promocional y cambiar un plazo. Lo que antes miraban guards de CI sobre la configuración lo
   rechaza el panel o la base: la segunda dirección de `G3` es una FK a la tabla de claves; `G-R3`
   es una validación de publicar una versión de plan, con su nombre; el `rank` único por vertical y
   una sola versión vigente por plan son restricciones de la base que el panel chequea antes; los
   días de prueba no pasan de 0 a más ni al revés; la gracia es menor que el ciclo más corto. Las
   mismas validaciones corren en el paso 3a sobre la base de producción. El catálogo de claves sigue
   en código. El editor del catálogo lo construyen V8 (planes y claves) y B13 (precios, complementos
   y promos).»*
8. **`DEC-DATA-008` (tanda 4; C9, C11, `L2-g`, `L2-h`, N7)**. *«Todo plazo en días o meses que
   decide cuándo pasa algo lo configura el `SUPER_ADMIN` desde el panel, con la acción "cambiar un
   plazo" (la 22); los números del diseño son valores iniciales. La lista es cerrada, quince plazos
   repartidos entre las dos mitades (`NUCLEO/02` §1.5). Ningún plazo técnico es configurable (los 15
   minutos del caché, las 26 horas del vigía, los 3 días de reintento de una mutación, las esperas
   del corte, los 7 días de `S37`), ni los que fijan Mercado Pago o la ley; los días de prueba, la
   gracia y la pausa son del catálogo y cambian publicando una versión de plan. Cambiar un plazo
   publica una versión nueva de los plazos de su mitad, que queda registrada; cada reloj guarda la
   versión con la que arrancó y cuenta con esa, así que un cambio nunca adelanta una fecha ya
   anunciada. El panel rechaza lo que se contradice: archivar antes que borrar; el `N` de `PB5`, en
   su peor caso en días, menor que el plazo de borrado (lo que era `G-R5-B`, que pasa a validación
   con su nombre); cada aviso antes del hecho que anuncia; el aviso de un aumento o de una migración
   nunca menor que el mínimo de `DEC-MP-002`. El archivado escribe la fecha de borrado que anuncia y
   `PB9` no borra antes de esa fecha: se cierra el espacio entre archivado y borrado que estaba
   declarado abierto (`K-5`, `B-2`, `B-3`). SUPERSEDE la cota de 6 meses literales de `G-R5-B` que
   el owner fijó el 2026-09-25 (FASE 8 completa).»*

### 4.2 SUPERSEDED

9. **`DEC-SUB-015`, `DEC-SUB-018`, `DEC-GRANT-010` y `DEC-ARCH-011`, enteras** (tanda 1, C8). *«SUPERSEDED
   (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Discontinuar una vertical
   queda fuera de esta versión; si algún día hace falta, se diseña entonces, y este texto queda como
   punto de partida.»*
10. **`DEC-DATA-002`, EN PARTE, por `DEC-DATA-006`** (tanda 2, C14): se cae que el reloj corre
    durante la pausa y la desigualdad que la protegía; sobrevive el resto. Lleva además su 📌 (§4.3,
    número 21).
11. **Sin `DEC` propio, dicho dentro de la decisión nueva que las supera**: `G1-1` (R1, FASE 9 vuelta
    1), en `DEC-MIG-006`; la cota de 6 meses literales de `G-R5-B` (FASE 8 completa), en
    `DEC-DATA-008`.

### 4.3 📌, uno por decisión, con su línea de Estado

Cada una suma a su *Estado*: *«precisada el 2026-09-28, con OK del owner (revisión del owner,
<puntos>; ver su 📌)»*. El texto del 📌:

12. **`DEC-ARCH-006`** (tanda 2, reemplaza el de la tanda 1; N6, `L1-d`, C4, C14): *«El contrato
    vive en un package compartido del monorepo, único punto de comunicación entre las épicas, con las
    dos interfaces, sus validaciones, los simuladores de cada lado y los dos juegos de casos; `G14`
    prohíbe que una mitad importe a la otra; el nombre es FASE 5. La fuente gana `desde` (C4) y la
    dirección de ida tiene una pregunta, `retenciónDetenida` (C14).»*
13. **`DEC-RF-004` y `DEC-RF-006`** (tanda 1, C8): *«Con C8 el disparador 2 de `S21` ya no se parte y
    el motivo 15 se llama `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`.»*
14. **`DEC-RF-008`** (tandas 1, 3 y 4; C8, C15, N1, C9): *«Las acciones administrativas pasan de
    dieciséis a veintiuna vivas: sale la 16, discontinuar una vertical, con su número sin reusar (C8);
    entra la 17, migrar a los clientes de un plan retirado (C15); y entran de la 18 a la 22, las cinco
    del catálogo (N1, C9, `L1-f`).»*
15. **`DEC-ADDON-004` y `DEC-SUB-013`** (tanda 1, C8): de texto, porque nombran `S26` y `S28` en
    enumeraciones: *«`S25` a `S28` salieron con la revisión del owner (C8).»*
16. **`DEC-OBS-001`** (tanda 1, C8): *«Su resumen ya no lleva la acción 16 (`V2-s`).»*
17. **`DEC-ARCH-007`** (tanda 1, C2, `L3-b`): *«Cómo se integra sin activar: no se activa nada; la
    épica vive en la rama del paraguas y entra a `staging` al final, con `staging` congelado para
    `main` hasta el corte (`D/16` §4.4).»*
18. **`DEC-MIG-001`, punto 5** (tanda 1, C2): *«No se convive.»* (Ya está SUPERSEDED EN PARTE: no
    mueve la cifra de precisadas.)
19. **`DEC-MIG-005`, punto 3** (tanda 2, C12): *«Precisado por `DEC-MIG-006`: no se siembran trials
    consumidos; se siembra uno activo a cada dueño con una ficha a la vista.»*
20. **`DEC-TRIAL-008`** (tanda 2, C14): *«La frontera se abrió lo mínimo por otro caso
    (`DEC-DATA-006`): la pausa del dueño cruza como `retenciónDetenida`, con lectores cerrados de
    retención. La máquina de trial no la lee, y lo que esta decisión protegía queda intacto.»*
21. **`DEC-DATA-002`** (tandas 1 y 4; C8, C9, N7): *«El hecho del fin de servicio de una vertical
    sale de la lista del reloj: quedan cinco, con el número 4 vacío (C8). Y los 90 y 180 días son
    los valores iniciales de dos plazos configurables: la ficha guarda la versión de plazos con la
    que arrancó su reloj, el archivado escribe la fecha de borrado que anuncia y `PB9` no borra antes
    (`DEC-DATA-008`).»* Su *Estado* suma también el SUPERSEDED EN PARTE del número 10.
22. **`DEC-ENT-002`, implicación 2** (tanda 2, C4): el texto exacto de `12-` §3 punto 6 (la cuota
    corre por la fecha del ciclo de cada persona, `V/15` §7).
23. **`DEC-ENT-001`** (tanda 2, `L2-f1`): *«La cuota de trial también se renueva cada mes, desde el
    día en que arrancó la prueba (contra la recomendación). `V/11` §4.3.»*
24. **`DEC-TRIAL-003` y `DEC-TRIAL-006`** (tandas 2 y 4; N7, N1): *«Encender o apagar la prueba de
    una vertical queda fuera de esta versión: al publicar una versión de plan, el panel no deja pasar
    los días de prueba de 0 a más de 0 ni al revés (`NUCLEO/02` §1.4), y `T7` salió. Partner queda en
    cero.»*
25. **`DEC-TRIAL-004`, implicación 2** (tanda 2, `g2`): *«Teléfono, identificador fiscal y
    dispositivo no se guardan; la consulta legal queda sólo por el seudónimo (seguimiento
    HOS-1394).»*
26. **`DEC-DATA-005`** (tanda 2, `g1`): *«La baja de cuenta pedida por el usuario queda fuera de esta
    épica: soporte a mano con una lista de pasos, y se corrige la FAQ (HOS-1393).»*
27. **`DEC-AUTH-003`** (tanda 2, C7): el texto exacto de `12-` §3 punto 12 (*«entrar como»* se
    agrega después, registrado como hecho por el admin en nombre del cliente).
28. **`DEC-ARCH-004`, definición 2 e implicación 5** (tanda 3, N2): el texto exacto de `13-` §3
    punto 1 (`qzpay` se saca; el cobro nuevo en un package compartido publicable; la implicación 5
    queda superada).
29. **`DEC-SUB-007` y `DEC-SUB-008`** (tanda 3, C15): *«La migración de un plan retirado
    (`DEC-SUB-023`) es un tercer camino: muta el monto como un aumento y baja o sube capacidades en la
    renovación.»*
30. **`DEC-MP-002`** (tandas 3 y 4; C15, C9): *«La migración de un plan retirado usa la regla de esta
    decisión para su fecha (primer cobro estrictamente posterior, empate a favor del cliente) y su
    mínimo como piso del plazo (`DEC-SUB-023`). Y los 60 días y los contactos a 30 y a 7 son el valor
    inicial del plazo 11 de `NUCLEO/02` §1.5, que el `SUPER_ADMIN` cambia sin bajar de ese mínimo;
    el aumento anunciado guarda la versión de plazos con que se anunció (`DEC-DATA-008`).»*
31. **`DEC-MP-008` y `DEC-SUB-009`** (tanda 3, N8): el texto exacto de `13-` §3 punto 6 (una pausa o
    una cancelación del pagador desde Mercado Pago no se distingue hoy; pendiente de medición).
32. **`DEC-DATA-001`** (tanda 4, C9, C11): *«El día 90 y el día 180 son los valores iniciales de los
    plazos 1 y 2 de `NUCLEO/02` §1.5, y cuántos días antes salen los dos avisos es el plazo 4; los
    cambia el `SUPER_ADMIN` sin adelantar ninguna fecha ya anunciada (`DEC-DATA-008`).»*
33. **`DEC-TRIAL-007`** (tanda 4, C9): *«Los N meses son el plazo 3 de `NUCLEO/02` §1.5, validado
    contra el plazo de borrado (`DEC-DATA-008`).»*
34. **`DEC-SUB-016`** (tanda 4, C9): *«Las 72 horas con tarjeta y los siete días con pago manual son
    el valor inicial del plazo 10 de `NUCLEO/02` §1.5.»*
35. **`DEC-SUB-002`** (tanda 4, N1): *«La gracia sigue colgando de la versión de plan; al publicar una
    versión el panel rechaza una gracia que no sea menor que el ciclo más corto que ofrece
    (`DEC-ARCH-013`).»*
36. **`DEC-TEST-001`** (tanda 4, N1, C9): *«`G-R3` y `G-R5-B` dejan de ser guards y pasan a ser
    validaciones del panel con su nombre, y `G3` conserva sólo la dirección código → catálogo (la
    otra es una FK de la base); el catálogo queda en 33 guards distintos, 18 de verticales y 15 de
    billing (`DEC-ARCH-013`, `DEC-DATA-008`).»*

### 4.4 Notas de caducidad al pie de los registros históricos

Los registros no se editan: se les suma una nota al pie, *«Caducada en todo o en parte por la
revisión del owner, 2026-09-28 (ver `30-revision-del-owner/14-` §4)»*.

37. **`29-fase-8-vuelta-2/24-decisiones-del-owner-verificacion.md`** (tanda 1): enteras `V2-g`,
    `V2-h`, `V2-i`, `V2-n`, `V2-s` y `V2-z1`; a medias `V2-d` (la mitad de `S26`; la selección de
    `S32` en `S11` sigue) y `V2-x` (`PB9` esperando el hecho 4).
38. **FASE 9 vuelta 1** (tanda 2): `G1-1` y R1 en lo que decían de la cartera.
39. **FASE 9 vuelta 2** (tanda 2): `R15` entera, `N-B-01` (su arreglo era dentro de `R15`), `G2-4`
    (el ⚠️ de `T7`) y `F-8CA2-012` en lo que pedía del encendido de Partner.
40. **FASE 8 completa** (tanda 4): `F-8CA2-014` en la cota de 6 meses literales.
41. **FASE 9 completa** (tanda 4): `K-5`, `B-2` y `B-3` (el espacio entre archivado y borrado), y
    `B-4` (los avisos previos sobre una ficha moderada, que cerró la tanda 2).

### 4.5 La matriz

42. **Fila nueva `EX-51`** (tanda 3; `VERIFIED`, 2026-09-24, producción): *«¿A qué hora cobra el
    proveedor un registro de cobro con fecha dada?»*, con la evidencia de `13-` §3 punto 7.
43. **Fila nueva `EX-52`** (tanda 3; `UNKNOWN`): la cancelación del pagador desde su cuenta, texto de
    `13-` §3 punto 8.
44. **Fila nueva `EX-53`** (tanda 3; `UNKNOWN`): la pausa del pagador desde su cuenta, texto de `13-`
    §3 punto 9.
45. **Fila nueva `WH-6`** (tanda 3; `UNKNOWN`): qué entrega cada canal y cuántos duplicados, texto de
    `13-` §3 punto 10.
46. **Reabrir `WH-5`** (tanda 3): de `VERIFIED` a `PARTIALLY_SUPPORTED` (el alcance de producción se
    leyó detrás del descarte de IPN).
47. **Reabrir `EX-15`** (tanda 3): de `VERIFIED` a `PARTIALLY_SUPPORTED` (Webhooks medido, IPN sin
    medir) hasta `WH-6`.
48. **Reformular `EX-42`** (tanda 1, L3-a): *«¿La llamada del script del corte, directa a la API
    (`expiration_date_to` = ahora), vence una `Preference` de Checkout Pro, y la relectura lo
    confirma?»*. No cambia su estado.

### 4.6 Las cifras, recontadas con los scripts

Simulado sobre copias del log y de la matriz con todo el lote aplicado (en el scratchpad de la
sesión) y contado con `contar-precisadas.py` y `contar-filas-de-la-matriz.py`, el mismo criterio que
el `## Resumen` del log:

| | hoy | con el lote |
|---|---|---|
| decisiones | 126 | **134** (las ocho nuevas) |
| funcionales · de metodología | 111 · 15 | **119** · 15 |
| precisadas sin `SUPERSEDED` | 47 | **58**: suman trece que tenían el *Estado* en `ACCEPTED` a secas (`DEC-TRIAL-003`, `-006`, `-007`, `-008`, `DEC-ENT-001`, `-002`, `DEC-SUB-002`, `-007`, `-008`, `-016`, `DEC-MP-002`, `DEC-ARCH-004`, `-007`) y salen dos que pasan a llevar `SUPERSEDED` (`DEC-DATA-002` y `DEC-ARCH-011`) |
| con `SUPERSEDED` en su *Estado* | 6 | **11**: las cuatro enteras de C8 y `DEC-DATA-002` en parte |
| apartamientos declarados del PDR | 8 | **9** (`DEC-ARCH-012`, del §55.1); 10 si el owner declara el del §25 (§3, punto 46) |
| filas de la matriz | 107 | **111** |
| `VERIFIED` · `PARTIALLY_SUPPORTED` · `NOT_SUPPORTED` · `UNKNOWN` | 56 · 15 · 23 · 13 | **55 · 17 · 23 · 16** |

Las `UNKNOWN` quedarían en `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42` a `EX-50`, `EX-52`, `EX-53` y
`WH-6`.

## Key Learnings

1. Un guard que pasa a validar datos que viven en la base no se retira con su número: si se lo
   renombra, treinta citas cambian de sujeto; si se lo reclasifica con el mismo nombre, siguen
   diciendo la verdad y sólo cambia el conteo.
2. Una regla de «nunca menos que» dentro de una decisión vieja convierte un plazo configurable en
   uno que sólo sube: hay que leer las decisiones que el plazo toca antes de escribir el ejemplo.
3. Reemplazar la historia de migraciones tiene un solo lugar posible en el corte, después de que la
   rama de aborto deja de cubrir, porque el backup del aborto trae la historia vieja.
4. Un guard sobre todo el repositorio choca con las reglas del propio programa (el log y los informes
   no se editan): la exención por nombre alcanza para el PDR y no para el corpus entero.
5. Simular el lote sobre copias y contar con los scripts deja ver lo que una suma a mano no ve: dos
   decisiones que hoy cuentan como precisadas salen de la cifra al recibir su SUPERSEDED.
