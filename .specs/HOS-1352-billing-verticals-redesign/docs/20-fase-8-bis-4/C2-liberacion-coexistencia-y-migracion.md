---
title: "FASE 8-bis-4 · C2 — liberación, coexistencia y migración del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · C2 — liberación, coexistencia y migración del conjunto

Quinta pasada sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco si este programa,
**como programa**, se puede empezar, se puede liberar por partes, puede convivir con el sistema que
reemplaza y tiene vuelta atrás.

**Nueve hallazgos: 0 `CRITICA`, 5 `ALTA`, 3 `MEDIA`, 1 `BAJA`.**

**Digo primero que no tengo ningún `CRITICA`, y por qué importa**: mi único crítico de la vuelta
anterior —`F-8dC2-001`, la firma del contrato copiada en los dos `spec.md`— **está arreglado, lo
verifiqué contra el texto**, y lo que queda vivo en mis seis documentos es **inventario de trabajo y
procedimiento**, que no mueve plata por sí solo. Que mi vector baje a cero críticos es un dato del
veredicto de método, no un informe flojo: la costura del §1 muestra que el generador se mudó de
*«el contrato avanzó y las copias no»* a *«el commit abrió el archivo y no leyó el párrafo de al
lado»*, que es exactamente lo que `DEC-METH-010` obligación 2 manda escribir.

La reejecución de mis 9 hallazgos de la 8-bis-3 está en la **§4** y **no cuenta como hallazgos
nuevos**: **4 cortan, 1 corta a medias, 4 siguen llegando.**

**Límites declarados.**

1. **Mediciones del repo: 2026-09-21**, sobre el worktree
   `hospeda-spec-hos-1352-billing-redesign`, rama `spec/HOS-1352-billing-verticals-redesign`,
   **`HEAD = 635a2699f`**, con los seis informes de A y B ya en el índice y nada más en el árbol.
   **Nunca sobre `/home/qazuor/projects/WEBS/hospeda2/`.**
2. **No vuelvo sobre la población de producción por ningún ángulo.** `DEC-MIG-004` la cerró con
   causa y es la **cuarta** pasada que la redescubre. Leí el §4 de las instrucciones antes de
   escribir una línea sobre migración. **Ninguno de los nueve hallazgos de abajo depende de cuántos
   usuarios hay en producción, de si alguno ya pagó, de si la cohorte crece, ni de qué pasa con
   `PB2` la mañana del corte.** Donde toco el corte, lo que ataco es el **texto del
   procedimiento**, no la población.
3. **No relitigo** las ocho decisiones nuevas del §3 de las instrucciones, ni
   `DEC-ARCH-004/005/006/007`, `DEC-MIG-002/003/004`, `DEC-RF-002`, `D-26` ni `D-28`. Ataco si el
   **mecanismo** elegido cumple, y si los documentos que no las nombran quedaron consistentes.
4. **El núcleo es de `C1`.** Lo marco `NUCLEO` donde aparece.
5. **No cito un número que no medí.** Los seis informes de A y B suman **67 hallazgos**
   (A1 7 · A2 11 · A3 19 · B1 11 · B2 10 · B3 9), contados por mí con `rg -c "^### F-8e"` más los
   dos IDs `F-8dB2-*` que `B2` reejecuta con su número viejo.

---

## 1. La regla de vigilancia del contrato, corrida por mí — que es lo que se me pidió

`c29b318c7` cerró el único crítico de mi vector retirando **cuatro** copias de la firma de
`cobertura()` y dejando en el contrato una regla que trae su propio comando:

> *«**Regla de vigilancia: la firma de `cobertura()` se enuncia acá y en ningún otro documento.**
> Ningún otro capítulo, `spec.md`, `descomposicion.md` ni **documento del paraguas** lleva un bloque
> que enumere sus campos; lo que llevan es un puntero a este §2. Se comprueba con
> `rg -n "cobertura\(user" .specs/` — fuera de este documento y de los informes de fase, toda
> aparición tiene que ser prosa que **cite**, nunca un bloque que **defina**.»*
> (`12-contrato-de-cobertura.md`, encabezado)

**Lo corrí. Devuelve 34 apariciones en 16 archivos.** Descontando el contrato (2) y las cinco
carpetas de informes de fase (`14-`, `17-`, `18-`, `19-`, `20-`), quedan **tres** apariciones en
tres archivos:

| archivo | § | ¿prosa que cita, o bloque que define? |
|---|---|---|
| `V/15` §2.6 | prosa | **cumple** |
| `15-fase-9/02-R2-resuelto.md` §1.1 | **bloque** | **viola** — cinco campos, más la dirección inversa |
| `15-fase-9/00-dominios-de-los-racimos.md` §1 | **bloque** | **viola** — **tres** campos, rotulado *«Cita textual, `12-contrato-de-cobertura.md` §2»* |

**Verifiqué los dos bloques abriendo los archivos, no el informe que los cita.** El de
`00-dominios` dice, textual y en un bloque ` ```text `:

```text
cobertura(user, vertical) → {
    cubierto:  sí | no
    fuentes:   [ { tipo, versiónDePlan, hasta } ]
}
```

Es **la misma firma de tres campos que `F-8dC2-001` reportó en los dos `spec.md`**, con el mismo
`versiónDePlan` que el contrato §2.3 ya no usa, y con la etiqueta *«cita textual»* encima. Los dos
archivos son `status: CURRENT` y viven bajo `HOS-1352-…/docs/`, o sea **son documentos del
paraguas**, que la regla nombra por su nombre. Medí además que **son los únicos tres bloques del
corpus que enumeran los campos**: `rg "^\s*fuentes: *\["` fuera de los informes devuelve
exactamente esos tres archivos, y `rg "cubierto: *sí"` lo mismo.

**Esto ya es `F-8eA3-012` y no lo cuento como hallazgo mío.** Lo verifiqué contra el texto porque
se me pidió correr la regla, porque `A3` y yo somos los dos que la medimos y conviene que quede
dicho que **coincidimos con el mismo comando y el mismo resultado**, y porque el dato que agrego es
el del párrafo de arriba: la copia sobreviviente **no es una firma cualquiera, es la de tres
campos** — o sea que el generador que `c29b318c7` fue a matar tiene hoy una instancia viva con la
carga exacta del crítico que lo originó.

### 1.1 Y el documento del corte sigue fuera del alcance de toda búsqueda por término

Mi vector empieza por la misma medición mecánica que la vuelta anterior, porque es la que decide
dónde mirar. `rg -o` de cada término que la tanda redefine, contra el documento del corte, el de la
partición y los cuatro documentos de implementación:

| término | corte | partición | `V/spec` | `B/spec` | `V/desc` | `B/desc` |
|---|---|---|---|---|---|---|
| `T7` · `MP4` · `MP5` | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| `S18` · `S19` · `S20` · `S21` | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 | 3 · 4 · 4 · 3 |
| `PB7` · `PB8` · `D16` | 0 · 0 · 0 | 0 · 0 · 0 | 0 · **1** · 0 | 0 · 0 · 0 | **1** · **1** · **1** | 0 · 0 · 0 |
| `G-R1-E` · `G-R5` | 0 · 0 | 0 · 0 | 0 · 0 | 0 · 0 | 0 · 0 | 0 · 0 |
| `sucede_a` · `sucedida_por` · `piso_del_trinquete` | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| `permanent_grant` · `addon_product` · `includesAddons` | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · **1** |
| `ARCHIVED` · `DECLARED_UNPAID` · «trinquete» | 0 · 0 · 0 | 0 · 0 · 0 | **1** · 0 · 0 | 0 · 0 · 0 | **2** · 0 · 0 | 0 · 0 · 0 |
| «lápida» · «reembolso» · «cortesía» · «vendible» · `cubierto` | **2** · 0 · 0 · 0 · 0 | 0 · 0 · 5 · 3 · 0 | 0 · 0 · 4 · 2 · **2** | 0 · 0 · 5 · 0 · 0 | 0 · 0 · 0 · 2 · 0 | 10 · 10 · 6 · 0 · 0 |

**Sobre el documento del corte, 25 de 26 términos dan cero**, y el único que no da cero es
*«lápida»*, con dos apariciones, que son las dos de la fila del paso 4. Es `F-8dC2-009` reejecutado
con los términos nuevos y **da peor que la vuelta pasada**: entonces el único no-cero era *«los
tres»*, que `DEC-MIG-004` ya había retirado; ahora el único no-cero es un término que **ningún
arreglo de esta tanda redefinió**. Una regla de resolución por aparición, ejecutada perfectamente
sobre el documento que describe la noche irreversible del programa, **no habría producido ni una
aparición que resolver**.

**Y la novedad de esta vuelta, que va al revés y es la que rinde**: los otros cinco documentos de
mi vector **sí** los tocó la tanda. `11-particion` la tocaron `f4edbdfdf` y `c29b318c7`; `V/spec.md`
la tocaron `c29b318c7` y `621332e7c`; `B/spec.md`, `c29b318c7` y `456563988`; `V/descomposicion`,
`621332e7c`; `B/descomposicion`, cinco commits. **El único que nadie abrió es el corte.** Eso
mueve la pregunta: ya no es *«el grep no llega»*, es *«el commit abrió el archivo y no leyó el
párrafo de al lado»* — que es literalmente la obligación 2 de `DEC-METH-010`, y es el modo de
**cinco** de mis nueve hallazgos.

---

## 2. Hallazgos

## ALTA

### F-8eC2-001 — El único procedimiento del corte cierra su paso 4 con una frase huérfana que fija el orden del acto humano, dice lo contrario del renglón de arriba, y sobrevive porque el commit que la rompió estaba editando ese mismo párrafo

**Qué se rompe.** El operador que ejecuta la noche irreversible del programa lee, en el mismo
párrafo y con seis líneas de distancia, que el aviso a la gente **va antes del paso 1** y que *«las
dos van después de desplegar»*. No hay ninguna *«dos»*: el sujeto al que esa frase se refería fue
retirado del documento y la frase quedó. El paso que ese renglón ordena —cuándo se llama a la
gente— es el único del corte que no tiene vuelta atrás por otro motivo: una ficha que se despublica
sin aviso previo es tiempo abajo que ninguna llamada posterior recupera.

**El camino.**

1. **El texto de hoy**, `16-fase-7-del-paraguas.md` §4.2, últimas seis líneas:

   > *«**Y hay un quinto acto que no es del sistema: las llamadas.** Las fichas publicadas de
   > Alojamiento **se despublican la mañana del corte** —es una consecuencia, no una falla
   > (`V/21` §2.4)— y vuelven solas cuando cada dueño contrata. **El aviso va ANTES del paso 1**,
   > no después: es lo único que acota cuánto tiempo queda abajo cada ficha. Las dos escriben filas
   > del esquema nuevo, así que **las dos van después de desplegar** — y por eso el paso 3 no es el
   > final del corte, aunque lo parezca.»*

2. **El párrafo trata de las llamadas, y las llamadas no escriben filas.** El sujeto gramatical más
   cercano a *«las dos»* es *«las llamadas»*, y el propio § acaba de decir que el aviso va **antes**
   del paso 1, o sea antes de desplegar. La frase afirma lo contrario de la frase anterior sobre el
   mismo sujeto.
3. **De dónde salió, medido con `git log -S "quinto acto"`.** El párrafo entero lo escribió
   `e6f4ff3a7` (*«la poblacion existente se despublica y se la llama, sin siembra»*), y el diff
   muestra que reemplazó a este otro:

   > *«**El paso 4 tiene dos siembras y ninguna es opcional.** Las lápidas … los trials evitan que
   > las fichas publicadas de Alojamiento se despubliquen … y **las dos siembras son a mano** …
   > **Las dos escriben filas del** esquema nuevo, así que las dos van después de desplegar»*

   **Las *«dos»* eran las dos siembras.** `e6f4ff3a7` retiró la siembra de trials —es la
   implementación de `DEC-MIG-004`— y **dejó el último renglón intacto**, pegado a un párrafo nuevo
   cuyo tema es otro.
4. **Y no es un residuo inocuo, porque el renglón sigue haciendo trabajo.** Su cola —*«y por eso el
   paso 3 no es el final del corte, aunque lo parezca»*— es la única frase del documento que le
   dice al operador que después de desplegar todavía hay actos que ejecutar. Hoy esa conclusión
   cuelga de una premisa falsa, y la premisa verdadera que la sostendría —que el paso 4 y la
   escritura de los dos `permanent_grant` van después del 3— **no está escrita en ningún paso**
   (eso es `F-8eA3-004`, ajeno, y no lo duplico).
5. **La tabla del §4.2 quedó coherente y el párrafo no**, que es lo que lo vuelve difícil de ver:
   el mismo commit sí corrigió la fila 4 —de *«las dos filas son del esquema nuevo»* a *«la fila es
   del esquema nuevo»*— y la fila se lee bien. El defecto vive **sólo** en la prosa de abajo.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.2, párrafos *«El paso 4 es la única escritura»* y
  *«Y hay un quinto acto»*.
- `HOS-1353/docs/21-migracion.md` §2.4 (*«se les avisa **antes** del corte»*).
- Medición propia: `git log -p -S "quinto acto" -- 16-fase-7-del-paraguas.md` → un solo commit,
  `e6f4ff3a7`, con el diff citado en el paso 3.

**Severidad.** `ALTA`. No mueve plata y no se pierde un dato: lo que se rompe es que **el único
procedimiento escrito del punto de no retorno del programa se contradice a sí mismo sobre el orden
de su único acto humano**, en el documento que `DEC-ARCH-007` deja como toda la estrategia de
despliegue. No lo marco `CRITICA` porque el desenlace peor —llamar después de desplegar— sigue
teniendo el renglón correcto tres líneas arriba, y porque el daño concreto (fichas abajo) está
declarado como consecuencia aceptada por `DEC-MIG-004`, que no reabro.

**¿Es nuevo, o es el arreglo?** **Es un arreglo, pero NO de los trece de la 9-bis-3: es de
`e6f4ff3a7`, del 2026-09-20**, el commit que implementó `DEC-MIG-004`. Lo digo con esa precisión
porque cambia la atribución: **la tanda de esta vuelta no lo produjo y tampoco lo encontró**, y
ninguno de sus once commits abrió el archivo.

**¿Lo habría encontrado el grep?** **No, y por el modo que la §1.1 mide.** El término que
`e6f4ff3a7` retira es *«sembrar el trial»* / *«las dos siembras»*, y `rg "siembra"` sobre el corte
después del commit devuelve **cero** —justamente porque el commit las borró—. El término que
queda vivo es *«las dos»*, que no es un término: es un pronombre, y ninguna regla de búsqueda por
término nombra pronombres. Es el mismo modo que `F-8dC2-005`: **una afirmación cuantificada sobre
un conjunto cuyos miembros el documento no nombra es invisible a una búsqueda por miembro.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y ésta es la parte que conviene mirar
de frente.** La obligación 2 manda escribir el rastro *«para cada aparición que no se corrige **y
está en un párrafo que el commit no tocó**»*. Este defecto vive **exactamente en el párrafo que el
commit reescribió**, así que cae fuera de lo que la obligación manda registrar — y la obligación 1,
que sí dice *«incluidos los archivos que el commit toca, porque un archivo abierto no es un párrafo
leído»*, **no pide rastro por escrito**. O sea: el único modo de defecto que la enmienda deja sin
registro es el que produce el propio acto de editar, y es éste. **No es «no se ejecutó»: es «la
enmienda no alcanza», y su punto ciego es el párrafo que el arreglo escribe.**

---

### F-8eC2-002 — El capítulo que declara qué NO se puede ejercer sin billing sigue enunciando el disparador retirado de `T2`/`T5`, y `T7` vuelve falsa su primera línea: sin billing un trial no sólo puede vencer, puede consumirse entero

**Qué se rompe.** `11-particion-del-programa.md` §3.2 es la lista de *«lo que queda inactivo,
declarado y no escondido»*, y existe con una razón escrita: *«para que nadie las descubra como un
bug»*. Su primer ítem dice que el trial **nunca convierte** mientras billing no exista. Desde el
arreglo 2 existe `T7`, que convierte el trial de una cohorte entera **sin que billing participe de
nada** y **sin que `cubierto` participe**, y cuyo efecto —*«crea la fila de `trial`, **consumida**»*—
`DEC-TRIAL-009` declara **no reparable**. El implementador que lea la partición para saber qué
puede ejercer en la épica de verticales sola concluye que esa rama no existe, y es la única del
capítulo 03 §2 que se puede disparar sin billing y le quita algo a alguien.

**El camino.**

1. **Lo que la partición declara inactivo**, `11-particion-del-programa.md` §3.2, punto 1, textual:
   *«**El trial nunca convierte.** Las transiciones `T2` y `T5` del capítulo 03 §2 disparan
   **cuando se autoriza una suscripción**. Sin billing, un trial sólo puede vencer.»*
2. **La primera mitad —el disparador— ya era falsa antes de esta tanda.** `V/03` §2 dice hoy que
   `T2` dispara con *«**aparece una fuente viva de clase `TÍTULO` que no es la del trial**»* y `T5`
   con *«**aparece una fuente viva de clase `TÍTULO`**»*, y el mismo capítulo publica la tabla que
   registra el cambio: *«| `T2` | *«se autoriza una suscripción»* | aparece un título que no es el
   trial | ahora alcanza también a quien **recupera** (`S7`), **reanuda** (`S10`) o recibe una
   cortesía o un grant durante el trial |»*. **La frase que la partición cita entre comillas es la
   columna «antes» de esa tabla.** Eso es `F-8dC2-007`, mío, y sigue entero.
3. **La segunda mitad —*«sólo puede vencer»*— la rompió esta tanda.** `V/03` §2, fila nueva de
   `1e3c3fc9e`: *«| `T7` | `PRE_TRIAL` | **el encendido: la vertical pasa los días de trial de su
   plan de trial de 0 a > 0** | `TRIAL_CONVERTED` | la persona **ya ejerció el hecho que la
   vertical declara como evento de activación**, en cualquier momento anterior al encendido —
   **`cubierto` no participa** | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |»*.
4. **Y `T7` no necesita billing por ninguna de sus tres patas.** Su evento es una operación del
   **catálogo de planes** (`V2` de verticales: los días de trial son de la versión de plan, `V/02`
   §2.1); su guarda lee un hecho de dominio de verticales; y su condición **excluye expresamente
   `cubierto`**, que es el único campo que el contrato hace venir de billing. La regla 2 de la
   descomposición de verticales —*«Ninguna unidad pregunta por dinero»*— la cumple entera.
5. **Con lo cual el ítem 1 del §3.2 es falso en sus dos mitades**: ni el disparador que enuncia es
   el que la máquina tiene, ni la conclusión *«sólo puede vencer»* se sostiene. La conclusión que
   sí se sostiene —que `T2` y `T5` no disparan sin billing, porque las demás fuentes `TÍTULO` son
   todas de billing— **queda apoyada en una razón que el contrato §4 prohíbe escribir** (*«una
   regla de verticales que se condicione sobre un estado de suscripción … **es una regla que no se
   puede evaluar**»*), y el guard que vigila eso, `G-R4-B`, mira *«una condición o un evento de una
   máquina»* (`V/20` §2): **el §3.2 no es una máquina, es la descripción de una, y nada lo vigila.**
6. **El efecto sobre la liberación, que es lo que hace esto mío.** El §3 entero es el argumento de
   por qué la épica de verticales puede construirse y probarse sola; `V4` es la unidad que construye
   `03 §2` *«entero»* y su criterio de terminación dice *«un trial vence de verdad, `cobertura()`
   pasa de sí a no por sí sola, y un segundo trial para el mismo `user + vertical` es imposible»* —
   **ninguna conversión**. Entre el capítulo que declara la rama inexistente y el criterio que no la
   nombra, `T7` puede llegar al final sin un solo caso escrito, que es lo que `F-8eA2-003` mide desde
   la máquina (sin idempotencia, sin reanudabilidad, sin detector) y `F-8eA1-004` desde la cohorte.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/11-particion-del-programa.md` §3.2, punto 1.
- `HOS-1353/docs/03-maquinas-de-estado.md` §2 (`T2`, `T5`, `T7`, y la tabla de cambios de
  disparador).
- `HOS-1352/docs/12-contrato-de-cobertura.md` §4 · `HOS-1353/docs/20-testing.md` §2 (`G-R4-B`).
- `HOS-1353/descomposicion.md` §1.1 regla 2, §2 (fila `V4`) y §4 (criterio de `V4`).
- Medición propia: sobre `11-particion-del-programa.md`, `rg -oc` → `T2` **1**, `T5` **1**,
  `T7` **0**, *«se autoriza una suscripción»* **1**, *«trial nunca convierte»* **1**.

**Severidad.** `ALTA`. Hay una pérdida sin vuelta —el trial consumido, que `DEC-TRIAL-009` declara
no reparable— pero **el acto que la produce es una decisión tomada**, y lo que yo reporto es que el
documento que declara qué no puede pasar dice que no puede pasar. **No lo marco `CRITICA`** porque
el daño de `T7` ya está adjudicado a `F-8eA1-004` y `F-8eA2-005`, que lo atacan desde la máquina y
desde la cohorte; lo mío es que **el inventario de lo inactivo esté mal**, que es un defecto de
planificación de la liberación y no de ejecución.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y las dos mitades tienen dueño distinto.** La
mitad del disparador es el arreglo 2 de la **9-bis-2** (`49eb99f34`) y la reporté como
`F-8dC2-007`: **sigue entera**. La mitad de *«sólo puede vencer»* la rompió **el arreglo 2 de esta
tanda** (`1e3c3fc9e`), el que crea `T7`.

**¿Lo habría encontrado el grep?** **Sí por el término viejo, no por el nuevo — y es justo la
distinción que la obligación 3 de `DEC-METH-010` agregó.** El término nuevo es `T7`, y
`rg "T7" 11-particion-del-programa.md` devuelve **0**. Pero la obligación 3 manda grepear **también
el término que se retira**, y lo que `1e3c3fc9e` retira del §2 de `V/03` es la frase *«sólo puede
vencer»* como propiedad de la máquina, más la vecindad de `T2`/`T5`: `rg "T2"` y `rg "T5"` sobre la
partición devuelven **una aparición cada uno**, las dos dentro del ítem que hay que corregir.
**La obligación 3 alcanzaba, y el commit que creó `T7` no abrió la partición.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y de las dos formas.** Para
`1e3c3fc9e` la aparición está en un archivo que ese commit **no** tocó, o sea el caso canónico de
la obligación 2. Y para la tanda entera el caso es peor: **`f4edbdfdf` y `c29b318c7` sí tocaron
`11-particion-del-programa.md`** —medido con `git diff 1e3c3fc9e~1 HEAD` sobre ese archivo: tres
hunks, en las líneas 95-113, 116-124 y 154-160— y **el §3.2 no está en ninguno de los tres**.
`c29b318c7` corrigió el §3.1, que es **el párrafo inmediatamente anterior**. La aparición cae
exactamente en *«no corregida, en un párrafo que ese commit no tocó, dentro de un archivo que sí
tocó»*. **La enmienda alcanzaba y no se ejecutó.**

---

### F-8eC2-003 — El catálogo de correos pasó de once filas a trece y los avisos de retención de dos a tres; ninguna de las 22 unidades cita el capítulo 07, y la regla de reparto de la partición manda a billing los tres avisos que construye una unidad de verticales

**Qué se rompe.** Los tres avisos que le dicen a una persona que su contenido está por borrarse —el
del día 90, el del archivado y el del día 180— **no son trabajo de ninguna de las 22 unidades**, y
la única frase del programa que los repartiría los manda a la épica equivocada. El programa puede
declararse terminado, con el tablero que *«calcula solo cuáles están listas»* en verde, sin que
exista una sola fila del catálogo de correos — trece momentos, entre ellos el que el propio núcleo
llama *«el que menos se puede suprimir de los tres»* porque su destinatario *«puede ser alguien que
está al día y pausado y que no tiene ninguna otra forma de enterarse»*.

**El camino.**

1. **Ninguna unidad cita el capítulo 07.** Recorrí la columna «capítulos» de las 22 filas. Del lado
   verticales se citan `01 §1.2 (núcleo)`, `02`, `03`, `10`, `11`, `15`, `17`, `18`, `19`, `22 §3`
   y el contrato; del lado billing, `02`, `03`, `05`, `06`, `09`, `10`, `12`, `13`, `14`, `16`,
   `19`, `20`, `22 §1` y el contrato. **`NUCLEO/07` no aparece en ninguna.** (Ojo con el falso
   positivo: `B5` cita *«`03` §6, §7»* y `B8` cita *«`12` §2, §3, §6, §7»*, que son secciones de
   los capítulos 03 y 12 de billing, no el capítulo 07 del núcleo.)
2. **Y la partición sí lo había repartido, con una regla que hoy manda mal.**
   `11-particion-del-programa.md` §4, fila 07: *«| 07 | outbox y notificaciones | **PARTIDO** — el
   mecanismo es compartido; del catálogo de correos, **los dos del trial a verticales y el resto a
   billing** |»*. Es una regla de reparto **por exclusión**, así que todo lo que no sea *«del
   trial»* cae del lado de billing.
3. **El catálogo tiene hoy trece filas y al menos cuatro son de verticales.** `NUCLEO/07` §6,
   contado sobre sus filas: *«trial por vencer»*, *«trial vencido — recuperación»*, *«renovación
   por venir»*, *«cobro fallido / grace»*, *«aumento de precio»*, *«antes de cancelar»*,
   **«excedente por downgrade»**, *«reanudación tras pausa»*, *«pausa por cortesía»*, *«pierde la
   cortesía al pausar»*, **«retención»**, *«cambio de plan con una cuota en reintento»* y
   *«reapertura tras un pago manual tardío»*. El **excedente por downgrade** lo produce el
   reconciliador de `V/15` §4, que construye **`V6`**; la **retención** son los tres avisos que
   construye **`V9`** —su propia fila lo dice: *«el reloj de 90 y 180 días **con sus cuatro hechos
   de reinicio**, la anonimización, el hash del correo y los **tres** avisos»*—. **Por la regla del
   §4, los dos van a billing.**
4. **La tanda tocó las dos puntas y no la regla.** `621332e7c` cambió la fila de retención de *«antes
   del día 90 y antes del día 180»* a *«antes del día 90, **al archivar** y antes del día 180»*, y
   en el mismo commit reescribió el párrafo de opt-out de *«los dos avisos de `DEC-DATA-001`»* a
   *«los avisos de retención … **Y el del archivado es el que menos se puede suprimir de los
   tres**»*. `71615bb41` agregó la fila *«reapertura tras un pago manual tardío»*. Y `f4edbdfdf`
   y `c29b318c7` **abrieron `11-particion-del-programa.md`** y corrigieron la fila **02** de esa
   misma tabla —*«y **§2.6** a billing»*— sin mirar la fila 07, que está cinco renglones abajo.
5. **Y `V9` tampoco lo recoge desde su lado.** Su columna de capítulos es *«`02` §4 · `22` §3 ·
   `01` §1.2 (núcleo)»*: `621332e7c` le agregó el `01 §1.2` del núcleo —el glosario, para los cuatro
   hechos de reinicio— y **no le agregó el `07`**, donde están los tres avisos que la misma celda
   promete. Su criterio de terminación del §4 tampoco los nombra: *«la fila de `trial` sobrevive al
   borrado de la cuenta, y su hash **no** se anonimiza»*.
6. **El efecto sobre la liberación.** `descomposicion.md` §5 dice que el estado vivo *«se lleva en
   el tablero, que calcula solo cuáles están listas: una unidad lo está cuando todas sus
   dependencias están hechas»*. **Un inventario que no contiene una pieza no puede reportar que
   falta**, y acá la pieza tiene además una declaración escrita de a quién pertenece que apunta al
   lado que no la construye: los dos mecanismos por los que alguien lo notaría se anulan.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/11-particion-del-programa.md` §4, filas 02 y 07.
- `HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §6 (las trece filas) y §5 (el opt-out y
  *«el del archivado es el que menos se puede suprimir de los tres»*). **`NUCLEO`.**
- `HOS-1353/descomposicion.md` §2 (filas `V6` y `V9`) y §4 (criterio de `V9`) ·
  `HOS-1354/descomposicion.md` §2 (fila `B13`: *«`19` entero · `22` §1»*).
- Medición propia: la columna «capítulos» de las 22 filas, recorrida entera; `rg -oc "catálogo de
  correos" 11-particion…` → **1**; las trece filas de `NUCLEO/07` §6 contadas a mano;
  `git show 621332e7c -- nucleo/07-outbox-y-notificaciones.md` para el 2 → 3.

**Severidad.** `ALTA`. No mueve plata. Lo que rompe es que **el aviso que defiende el hard delete
del día 180 no tiene constructor y tiene un dueño declarado equivocado**, y el desenlace —contenido
borrado sin que nadie haya avisado— es *«un dato se pierde sin vuelta»*. **No lo marco `CRITICA`**
porque para llegar ahí hace falta además que nadie lo note al construir, y porque el daño concreto
del aviso que no sale ya está contado por `F-8eA3-001`, que ataca la clave de deduplicación del
outbox: **son dos causas distintas del mismo silencio y no lo cuento dos veces.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo a medias, y conviene separar.** La ausencia del
capítulo 07 del inventario es **anterior** —es la mitad viva de `F-8dC2-002`, que ya lo reportó—.
**Lo que la tanda agrega es el peso y la caducidad de la regla**: `DEC-DATA-002` (`621332e7c`) metió
el tercer aviso, el que el propio núcleo declara el menos suprimible, y `DEC-SUB-012` (`71615bb41`)
agregó la decimotercera fila, de modo que la frase *«los dos del trial a verticales y el resto a
billing»* reparte hoy **once filas** con un criterio que nunca se revisó.

**¿Lo habría encontrado el grep?** **No con el término de la decisión, sí con el del catálogo.**
El término que `DEC-DATA-002` redefine es `ARCHIVED`/`PB7`/`PB8`, y `rg` sobre
`11-particion-del-programa.md` devuelve **cero** para los tres (tabla del §1.1). El que sí llega es
*«catálogo de correos»*, que es lo que la fila 07 nombra y lo que el commit estaba modificando del
otro lado — **una aparición, exacta**. Es la misma limitación que `F-8dC2-002`: la regla vigila
términos del modelo, y el reparto del trabajo está escrito en castellano.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí para la mitad de la regla, no para la
mitad de la ausencia, y la distinción es la útil.** La fila 07 de la partición es *«una aparición no
corregida, en un párrafo que el commit no tocó»* dentro de un archivo que `f4edbdfdf` y `c29b318c7`
**sí** abrieron —y de una tabla cuya fila 02 uno de ellos editó—: **la enmienda alcanzaba y no se
ejecutó**. La ausencia del capítulo 07 del inventario, en cambio, **no es una aparición**: es una
fila que no existe, y la obligación 2 sólo manda recorrer apariciones. **Es el límite estructural de
la enmienda, y no se arregla ejecutándola mejor.**

---

### F-8eC2-004 — Los guards sin unidad pasaron de 11 de 24 a 12 de 26, y el único de los trece que consiguió dueño lo consiguió en la épica equivocada: `G-R5` vigila un número que declara billing y lo construye una unidad de verticales que corre antes de que ese número exista

**Qué se rompe.** Las dos descomposiciones abren con la misma regla y el mismo argumento: un guard
que llega después **nace roto** — *«se escribe contra código ya escrito, y para entonces hay call
sites que lo violan: nace con una lista de excepciones, que es exactamente cómo un guard deja de
servir»*. La tanda creó dos guards más y **los doce R-guards sin unidad van a llegar al final por
construcción**. Y el único que recibió asignación la recibió de un modo que el propio catálogo de
billing había declarado peligroso doce líneas antes.

**El camino, medido el 2026-09-21.**

1. **La regla, en los dos lados y con el mismo texto.** `HOS-1354/descomposicion.md` §1.3 regla 1 y
   `HOS-1353/descomposicion.md` §1.1 regla 1: *«**Cada guard va con la pieza que protege, nunca al
   final.**»*
2. **El catálogo tiene hoy veintiséis guards.** Contados con
   `rg -o "G-R[0-9]+(-[A-Z])?|G[0-9]+" | sort -u` sobre los dos `20-testing.md`: `V/20` lista
   **quince** —`G1` `G2` `G3` `G4` `G5` `G6` `G8` más `G-R2` `G-R2-B` `G-R3` `G-R3-B` `G-R3-C`
   `G-R4` `G-R4-B` `G-R5`— y `B/20` lista **once** —`G7` `G9` `G10` `G11` más `G-R1-A` `G-R1-B`
   `G-R1-C` `G-R1-D` `G-R1-E` `G-R4` `G-R5`, los dos últimos cruzados—, más `G12` y `G13`, que la
   descomposición de billing numera en su §2.1 *«porque el `20` §2 no los nombra»*. Unión: **26**.
   (`V/spec.md` lo confirma desde el otro lado: `621332e7c` le cambió la celda del capítulo `20` de
   *«**siete guards**»* a *«**quince guards**»*.)
3. **Asignados a una unidad por su nombre, trece**: `G1` `G3` `G8` (`V1`), `G2` `G4` `G6` (`V5`),
   `G5` (`V6`), `G9` `G10` `G11` `G12` (`B1`), `G7` (`B2`), `G13` (`B4`).
4. **Sin dueño, trece — y uno de ellos lo tiene sin nombrarlo.** `rg "G-R"` sobre los cuatro
   documentos de implementación devuelve **cero**: ninguno de los trece R-guards aparece por su
   identificador. La única asignación es la celda de `V9`, que dice *«el de `D16`»* — o sea `G-R5`,
   **nombrado por su invariante y no por su id**. Queda: **12 sin dueño de ninguna forma**
   (`G-R1-A` `G-R1-B` `G-R1-C` `G-R1-D` `G-R1-E` `G-R2` `G-R2-B` `G-R3` `G-R3-B` `G-R3-C` `G-R4`
   `G-R4-B`) y **1 con dueño indirecto**.
5. **Los dos nuevos son de esta tanda.** `G-R1-E` lo crea `f4edbdfdf` (la familia de la sucesión) y
   `G-R5` lo crea `621332e7c` (`DEC-DATA-002`). **Ninguno de los dos commits tocó
   `B/descomposicion.md` en su columna de guards, que sigue vacía en once de trece filas.**
6. **Y la única asignación que existe está del lado que no puede romperla.** `G-R5` vigila *«el
   **tope de una pausa** que declara el catálogo —cap. 03 §5 de **esta** épica—, pasado a días,
   **alcanza el día del hard delete** de la retención»*, y `B/20` §2 escribe su propia advertencia:
   *«**Figura acá porque el número que puede romperlo es de esta épica**: si alguien sube el tope de
   pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace sin verlo»*. El número
   son las *«**4 pausas-mes** por pausa»* de `B/03` §5, que construye **`B8`**. La única unidad que
   lo tiene asignado es **`V9`**, cuyos capítulos son `02 §4`, `22 §3` y `01 §1.2 (núcleo)` — **el
   `B/03` §5 no está entre ellos**.
7. **Y el orden lo empeora, medido sobre los dos grafos del §3.** `V9` corre *«en paralelo … una vez
   que estén `V4` y `V6`»*, o sea temprano y sin esperar a billing; `B8` está en el camino crítico
   `B1 → B3 → B5 → B7 → **B8** → B9 → B10 → B13 → B12`, después de la bisagra y después de todo lo
   que espera a la pasarela. **El guard se construiría antes que el número que compara.** Es la
   regla 1 al revés: no llega tarde, llega tan temprano que no tiene contra qué fallar — y un guard
   que no puede fallar es lo que la propia regla llama *«un comentario con exit code 0»*.

**Dónde lo permite el diseño.**

- `HOS-1353/descomposicion.md` §1.1 regla 1, §2 (columna guards, fila `V9`), §2.3 y §3 ·
  `HOS-1354/descomposicion.md` §1.3 regla 1, §2 (columna guards), §2.1 y §3.
- `HOS-1353/docs/20-testing.md` §2 y `HOS-1354/docs/20-testing.md` §2 (los dos catálogos, y la nota
  de referencia cruzada de `G-R5`).
- `HOS-1354/docs/03-maquinas-de-estado.md` §5 (las 4 pausas-mes) ·
  `HOS-1352/docs/nucleo/04-invariantes.md` `D16`.
- Medición propia: `rg -o "G-R[0-9]+(-[A-Z])?|G[0-9]+" | sort -u` sobre los dos `20-testing.md`
  → 15 y 11; `rg "G-R"` sobre los cuatro documentos de implementación → **0**.

**Severidad.** `ALTA` — los doce guards son casi la mitad de las defensas estructurales del programa
y llegan con la garantía de nacer con excepciones, sobre las reglas más nuevas del diseño. No mueve
plata por sí solo; **quita las defensas que impiden que otras cosas la muevan.** El caso de `G-R5`
agrega algo que no estaba en la vuelta anterior: no es sólo *«sin dueño»*, es **con el dueño
equivocado y en el momento equivocado**, y eso se lee como resuelto.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos distintos**: `f4edbdfdf` (`G-R1-E`) y
`621332e7c` (`G-R5`, más su asignación a `V9`). Los diez R-guards restantes son `F-8dC2-003` y
`F-8bC2-014` intactos. Cada arreglo cerró su defecto **agregando una fila al catálogo de guards**;
`621332e7c` fue el primero de toda la serie que además abrió el documento que reparte el trabajo —
y escribió *«el de `D16`»* en vez del id, del lado que no puede romperlo.

**¿Lo habría encontrado el grep?** **No, y la razón es la misma de siempre con un agravante nuevo.**
El nombre del guard es inútil porque **el guard es nuevo**: no hay apariciones viejas que resolver.
El término que cada arreglo redefine (`sucede_a`, `ARCHIVED`, `D16`) da **cero** sobre los cuatro
documentos de implementación salvo `D16`, que da **1** — y esa 1 es precisamente la celda de `V9`
que `621332e7c` escribió. O sea: **la única aparición grepeable es la que el arreglo creó**, y
grepearla confirma que existe en vez de mostrar que está del lado equivocado.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No para `G-R1-E`, sí para `G-R5`, y son los
dos casos opuestos en el mismo hallazgo.** Para `G-R1-E`: no hay ninguna aparición previa que
resolver en los cuatro documentos, así que cae fuera de la obligación 2 — **la enmienda no
alcanza**. Para `G-R5`: `621332e7c` **sí** abrió `V/descomposicion.md` y escribió la celda, y la
obligación **4** —la condicional— manda que *«el arreglo que crea un consumidor nuevo agrega la fila
antes de declararse aplicado»*; acá el consumidor nuevo es una unidad de la otra épica que el
capítulo `B/20` §2 ya había advertido por escrito que era el lado ciego. **La obligación 4 apunta a
la mitad correcta y no dice nada del lado en que se escribe.**

---

### F-8eC2-005 — `B5` es la única unidad de billing que la tanda no tocó, y es la dueña del `03 §7`, donde nacieron `MP4` y `MP5`: su criterio de terminación no nombra el reloj que crea la cuota, y el de `B7` exige comportamiento de un capítulo que no es suyo

**Qué se rompe.** La unidad que construye la máquina de pago manual puede declararse terminada, por
su propio criterio escrito, **sin que exista el reloj que crea la cuota** — que es la única entrada
de esa máquina y el único mecanismo que impide lo que el capítulo llama, textual, *«servicio gratis
en silencio»*. Y si alguien lo construye igual, lo construye en la unidad **anterior** a la que trae
el estado al que ese reloj empuja, así que el único efecto declarado de `MP5` apunta a una
transición que todavía no existe.

**El camino.**

1. **`MP4` y `MP5` son las dos filas nuevas del `B/03` §7**, las dos de esta tanda: `MP4` de
   `DEC-SUB-012` (`71615bb41`) y `MP5` de `DEC-SUB-013` (`1c17565e1`).
2. **`MP5` no es una transición más: es una pieza de infraestructura.** `B/03` §7, fila `MP5`:
   *«| `MP5` | *(sin fila)* | **un reloj abre el período** de una suscripción de pagador manual:
   llegó el instante en que el proveedor habría cobrado (§7.2) | `AWAITING` | **es la entrada de
   esta máquina, y la crea el sistema, no un admin** … **Idempotente por condición** … |»*. Y el
   §7.2 escribe por qué existe: *«una cuota que nadie crea es **servicio gratis en silencio**»*.
3. **El §7 es de `B5`.** `HOS-1354/descomposicion.md` §2, fila `B5`: *«| **B5** | **El registro del
   dinero** | … | `02` §2.3 · `03` **§6, §7**, §10.2 · `05` C5 | — |»*.
4. **Y `B5` es la única unidad de billing que la tanda no tocó.** Medido con
   `git diff 1e3c3fc9e~1 HEAD -- HOS-1354/descomposicion.md`: la tanda reescribió las filas de
   `B7`, `B8`, `B9`, `B10` y los criterios de `B7`, `B8`, `B10`, `B11`, y agregó el §3.1 entero.
   **La fila de `B5` y el criterio de `B5` no tienen una sola línea de diff.** El criterio sigue
   siendo: *«un reembolso que emite tres notificaciones en dos formatos produce una fila; un período
   con un pago acreditado rechaza el segundo desde la base; y un hecho más viejo que el último
   aplicado se registra y no se aplica»* — **tres aserciones y ninguna nombra una cuota, un reloj ni
   una reapertura.**
5. **Y los dos commits que crearon las filas no abrieron el inventario.** `71615bb41` tocó siete
   archivos —log, `nucleo/07`, `B/03`, `B/05`, `B/12`, `B/19`, `B/20`— y `1c17565e1` tocó seis
   —log, `nucleo/03`, `B/02`, `B/03`, `B/09`, `B/16`—. **Ninguno de los dos tocó
   `B/descomposicion.md`**, que los otros cinco commits de la tanda sí tocaron.
6. **El reparto además quedó cruzado en las dos direcciones.** Hacia abajo: el único efecto de `MP5`
   es *«**en el mismo acto la suscripción entra en `GRACE_PERIOD` por `S4`**»*, y `S4` está en la
   columna de **`B7`** (*«`03` §4, **S4–S7**, `S19`»*), que en el grafo del §3 viene **después** de
   `B5` (`B5 → B7`). Hacia arriba: el criterio de terminación de `B7` que la tanda reescribió
   **exige comportamiento del §7**: *«**un pago registrado A MANO sobre una predecesora en sucesión
   entra por esa misma fila** … con su devolución asentada igual que la de un cobro del proveedor
   (**`03` §7**, `02` §2.3)»* — y `§7` **no está en la columna de capítulos de `B7`**. Una unidad
   exige lo que otra tiene asignado, y la que lo tiene asignado no lo pide.
7. **Y hay un tercer cruce que el propio §2.4 escribe.** *«**Ejecutar** es cómo se mueve: el cargo,
   el reembolso y **cómo se constata un pago manual**. Eso es el 13»* — o sea **`B6`, la única
   unidad bloqueada y sin diseño**. `MP1` y `MP4` son, literalmente, *«el admin registra el pago»*:
   la constatación de esa transferencia es del 13, y las dos filas que la disparan son del §7.
   `B/descomposicion` §3.1 hizo el ejercicio de trazar esa línea **para el reembolso** —cinco filas,
   con veredicto por fila— y **no lo hizo para el pago manual**, que es el otro lado de la misma
   división.

**Dónde lo permite el diseño.**

- `HOS-1354/descomposicion.md` §2 (filas `B5`, `B6`, `B7`), §2.4, §3 y §4 (criterios de `B5` y
  `B7`).
- `HOS-1354/docs/03-maquinas-de-estado.md` §7 (`MP4`, `MP5`) y §7.2 (*«servicio gratis en
  silencio»*, y la tabla de los seis estados).
- Medición propia: `rg -oc "MP4|MP5"` sobre los cuatro documentos de implementación → **0**;
  `git show --name-only` sobre `71615bb41` y `1c17565e1`; `git diff 1e3c3fc9e~1 HEAD --
  HOS-1354/descomposicion.md` para el paso 4.

**Severidad.** `ALTA`. La plata está contada del otro lado y **no la vuelvo a contar**:
`F-8eB1-002` y `F-8eB1-005` atacan que la cuota no se abre nunca y que el §7 tiene población vacía,
y `F-8eB2-008` ataca lo que `MP5` le hace al ciclo. Lo que agrego es **quién lo construye y con qué
criterio se declara hecho** — y la respuesta es una unidad cuyo criterio no menciona la pieza, en un
lugar del grafo anterior al de su único efecto. Es el mismo defecto que `F-8dC2-004` midió para
`B7`, que la tanda arregló para `B7`, **y que no miró en la unidad de al lado**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-012` y `DEC-SUB-013`.** Antes de la tanda
el §7 tenía cuatro filas sin entrada —`F-8B2-018`— y un reparto que no prometía nada; ahora tiene su
entrada, una reapertura, un reloj y una regla de idempotencia, y el inventario de trabajo quedó
idéntico al del 2026-09-19.

**¿Lo habría encontrado el grep?** **No por el término nuevo, sí por el de la sección.**
`rg "MP4"` y `rg "MP5"` sobre los cuatro documentos de implementación devuelven **cero** cada uno.
Lo que sí llega es la referencia de sección: la fila de `B5` cita *«`03` §6, **§7**, §10.2»*, y un
recorrido por *«§7»* —el contenedor de lo que se está modificando— habría dado esa aparición. **La
obligación 3 no cubre este caso**: no hay término viejo que se retire, porque `MP5` no reemplaza
nada, **llena un vacío** — y un vacío no tiene nombre que grepear.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el segundo modo que la enmienda no
alcanza.** `B/descomposicion.md` es un archivo que **esos dos commits no tocaron**, así que la
obligación 2 sí lo pone en alcance — pero lo pone *«por aparición»*, y la aparición que habría que
resolver es una **referencia de sección dentro de una celda de tabla**, no una aparición del término
redefinido. La obligación manda recorrer las apariciones **del término**; nadie grepea *«§7»*.
**La enmienda alcanza al archivo y no al lugar.**

---

## MEDIA

### F-8eC2-006 — El conteo de invariantes vive con tres valores distintos en cuatro documentos —51, 52 y 53— y el que dice 51 es el argumento de por qué el núcleo no se parte; el commit que lo llevó a 53 editó la fila de al lado

**Qué se rompe.** La razón escrita de por qué el núcleo **no se puede partir** —*«un glosario en dos
mitades deja de ser un glosario, y los **51** invariantes numerados de corrido pierden lo único que
los hace útiles: poder preguntar **una vez** si están todos»*— se apoya en un número que hoy es
**53**. Quien quiera *«preguntar una vez si están todos»* no tiene contra qué contrastar: le
contestan 51 dos documentos, 52 uno y 53 el capítulo que los lista.

**El camino.**

1. **El valor verdadero, y lo dice el capítulo que los tiene.** `NUCLEO/04` §5: *«**Cincuenta y tres
   invariantes, y diez los sostiene la base.**»*, con su tabla en `37 + 16 = 53` y la nota de
   recorrido de `621332e7c`: *«El total de la derecha pasa de 15 a 16 y *«cincuenta y dos»* a
   **cincuenta y tres**»*. Lo verifiqué contando las filas del §3 con
   `rg -o "^\| \*?\*?\`?D[0-9]+"` → **16**, de `D1` a `D16`.
2. **Dos documentos dicen 51.** `HOS-1353/spec.md`, tabla de fuentes, fila *«el núcleo»*: *«los **51
   invariantes** numerados de corrido»*. Y `NUCLEO/00-indice.md` §*«Las tres partes»*: *«**No se
   parte**: un glosario en dos mitades deja de ser un glosario, y **51 invariantes** numerados de
   corrido pierden lo único que los hace útiles»*. **Las dos frases son la misma frase**, y es el
   argumento entero de la indivisibilidad del núcleo. **`NUCLEO`.**
3. **Y un tercero dice 52, declarándolo como corrección pendiente.** `03-handoff.md`, tabla *«Tres
   cosas que NO son defecto de diseño y se aplican sin discutir»*: *«| el resumen de invariantes
   quedó en «16 apoyos sobre 14» y «**51**, ocho de base» | `NUCLEO/04` §5. El real es **52 y 10**,
   y hay que **recorrerlo entero**: un apoyo **se mudó**, no se agregó |»*. **La fila que existe
   para corregir el 51 caducó ella misma**, y está en la sección que el handoff titula *«se aplican
   sin discutir»*.
4. **`NUCLEO/04` ya sabe que éste es su modo de falla y lo escribió dos veces.** Su nota de
   `621332e7c`: *«el recorrido encontró algo que las dos notas de arriba no vieron: **las dos
   correcciones anteriores se escribieron en la nota y no en la tabla** … Es el modo que este mismo
   capítulo documenta: **corregir donde se mira y no donde se lee**»*. La tercera instancia del
   mismo modo es ésta, una capa más afuera: se corrigió el capítulo y no los tres documentos que lo
   citan.
5. **El efecto sobre el conjunto, que es lo que lo hace mío.** Las dos épicas se liberan juntas
   (`DEC-ARCH-007`) y el núcleo es lo único que comparten; `11-particion` §4 lo reparte capítulo por
   capítulo y el §4.1 declara `00` *«COMPARTIDO»*. El número no es decorativo: es el único **control
   de completitud** que el programa se dio para el artefacto que no se parte.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/nucleo/00-indice.md`, *«Las tres partes»* · `HOS-1352/docs/nucleo/04-invariantes.md`
  §3 y §5. **`NUCLEO`.**
- `HOS-1353/spec.md` §*«De dónde sale cada cosa»*, fila *«el núcleo»*.
- `HOS-1352/docs/03-handoff.md`, tabla *«Tres cosas que NO son defecto de diseño»*.
- Medición propia: `rg -n "51 invariantes|cincuenta y tres"` sobre el corpus de diseño, excluidas
  las cinco carpetas de informes → tres archivos, los citados; `rg -o "^\| \*?\*?\`?D[0-9]+"` sobre
  `nucleo/04` → 16 filas.

**Severidad.** `MEDIA`. Nadie paga de más por esto. Lo reporto porque **el número es el argumento**,
no un dato de color, y porque su dispersión mide exactamente lo que esta pasada existe para medir:
el mismo commit que produjo el 53 tenía los dos 51 al alcance de la mano.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-DATA-002` (`621332e7c`)**, que agregó `D16` y
llevó el total de 52 a 53. Los valores 51 y 52 son anteriores —la brecha nace cuando `D13`/`D14`
entraron— pero **la tanda la ensanchó y tenía los tres documentos en la mano**: `621332e7c` editó
`nucleo/04` (donde puso el 53) **y** `V/spec.md` (donde está uno de los 51).

**¿Lo habría encontrado el grep?** **Sí, y es el caso más limpio de la obligación 3.** El término
nuevo es `D16`, y `rg "D16"` sobre los documentos que el commit no tocó devuelve poco. Pero la
obligación 3 manda grepear **también el término que se retira**, y lo que `621332e7c` retira es el
literal **«cincuenta y dos»** / **«52»** de `nucleo/04` §5. Grepear el número —`rg "51"` o
`rg "invariantes"`— sobre el corpus devuelve **las dos apariciones de 51 y la de 52**, las tres. **La
obligación que esta enmienda agregó alcanzaba de sobra.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y de la forma más incómoda posible.**
`621332e7c` **abrió `V/spec.md`** y editó, en la **misma tabla**, la fila del capítulo `20` —de
*«siete guards»* a *«quince guards»*, medido en el diff—. La fila *«el núcleo»*, con su 51, está
**dos renglones más abajo y no se tocó**: es literalmente *«una aparición no corregida, en un
párrafo que ese commit no tocó»*, dentro de un archivo que sí tocó y de una tabla que sí editó.
**La enmienda alcanzaba, estaba a dos renglones, y no se ejecutó.** Si hay un solo dato que separa
*«la enmienda no sirve»* de *«no se aplicó»*, es éste.

---

### F-8eC2-007 — Cuarta vuelta sin una línea sobre el documento del corte, con su fecha límite venciendo pasado mañana, y sin que nombre a la pasarela, al capítulo 13 ni a `B6` — que son lo que hoy decide cuándo se libera

**Qué se rompe.** La única estrategia de despliegue del programa se pone a sí misma una fecha
límite —*«**Se escribe ANTES de que nazca la rama del paraguas**»*— que `D-28` fija en el
**2026-09-23**. Hoy es el **2026-09-21**. Los once commits de la tanda no le agregaron una línea,
y los cinco ítems que declara pendientes siguen con **cero apariciones** en todo el corpus de
diseño, cuarta medición consecutiva sin moverse. Y el documento razona sobre un despliegue que
puede ocurrir, cuando lo que hoy lo bloquea —la pasarela sin decidir— no está nombrado en él.

**El camino.**

1. **La fecha, en los dos extremos.** `16-fase-7-del-paraguas.md` §2: *«**Se escribe ANTES de que
   nazca la rama del paraguas.** La rama todavía no existe —`git ls-remote` devuelve cero— y el
   desarrollo arranca en días»*, y §5: *«Ésa es la FASE 7 del paraguas y es trabajo pendiente, con
   fecha límite dada por el §2»*. `D-28` (`15-fase-9/07-decisiones-del-owner.md`): *«Plazo: **hasta
   el 2026-09-23**»*.
2. **Los cinco ítems, recontados hoy.** `rg -oi` sobre todo el corpus de diseño excluyendo el propio
   `16-fase-7` y las cinco carpetas de informes: `rollout` **1** · `coexistence` **1** ·
   `feature flag` **1** · `acceptance gate` **1** — y **la única aparición de cada uno es la lista
   del §65 del PDR**, o sea el enunciado del pedido, no una respuesta. Sobre las dos épicas y el
   núcleo solos: `rollout` **0** · `coexistence` **0** · `feature flag` **0** · `rollback` **0** ·
   `acceptance gate` **0**. **Idéntico a la 8-bis, la 8-bis-2 y la 8-bis-3: cuatro mediciones
   seguidas sin mover un conteo.**
3. **La tanda no lo abrió.** `git show --name-only` sobre los once commits: ninguno toca
   `16-fase-7-del-paraguas.md`. Su último commit sigue siendo `e6f4ff3a7`, del 2026-09-20.
4. **Y lo que sí cambió alrededor le agregó trabajo sin escribirlo.** Dos capítulos ahora delegan
   explícitamente en él una decisión que no tiene: `V/21` §2.4 punto 3 —*«**El orden entre la
   escritura de los dos grants y el paso 4 no está fijado en ningún lado, y hay que fijarlo en el
   procedimiento del corte**»*— y `B/21` §2.4 —*«el orden entre esta escritura y el paso 4, **que
   hay que fijar en el procedimiento**»*. **Es la primera vez que un capítulo le encarga algo por
   escrito al documento del corte**, y el encargo llega a un documento que nadie abre. (La mitad
   *«el corte escribe más filas de las que declara»* es `F-8eA3-004` y no la duplico: lo mío es que
   **el destinatario del encargo tiene fecha límite y está intacto**.)
5. **Y el documento no nombra lo que hoy decide cuándo se libera.** Medido sobre
   `16-fase-7-del-paraguas.md`: `pasarela` **0** · `Mobbex` **0** · `Mercado Pago` **0** ·
   `capítulo 13` **0** · `B6` **0** · `PRUEBA 0` **0**. Mientras tanto la descomposición de billing
   abre con un bloque ⛔ —*«**De las trece unidades, nueve llaman a la pasarela**, y ninguna de esas
   nueve se puede terminar sin saber cuál es»*— y `DEC-ARCH-007` obliga a que *«las dos llegan a
   producción juntas y terminadas»*. La estrategia de despliegue del paraguas razona sobre un
   despliegue cuya condición de existencia no menciona.
6. **El §1 del documento sigue diciendo que la migración quedó *«casi sin sujeto»***, y desde esta
   tanda ese renglón envejeció: `B/21` §2.4 escribe hoy **una fila de `permanent_grant` más una de
   `permanent_grant_vertical` por vertical, con dos referencias no anulables cada una**, y `V/21`
   §2.4 le agregó el orden pendiente del paso 4. El sujeto creció; la tabla del §1 no.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1 (la tabla de los diez ítems), §2 (la fecha), §3, §4.2
  y §5.
- `HOS-1352/docs/15-fase-9/07-decisiones-del-owner.md`, `D-28` · `HOS-1352/docs/01-decision-log.md`,
  `DEC-ARCH-007`.
- `HOS-1353/docs/21-migracion.md` §2.4 punto 3 · `HOS-1354/docs/21-migracion.md` §2.4.
- `HOS-1354/descomposicion.md`, bloque ⛔ del encabezado y §2.3.
- Medición propia: los conteos del paso 2 y del paso 5, con `rg -oi`, y `git show --name-only`
  sobre los once commits.

**Severidad.** `MEDIA` — no rompe nada ejecutando y nadie paga de más: es un documento que no se
escribió. Lo reporto en `MEDIA` y no más arriba porque el desenlace concreto (un corte sin
rollback, sin gates y sin coexistencia escritos) **ya está declarado con causa** en el §3 del propio
documento, que acepta de antemano que la respuesta pueda ser *«no hay vuelta atrás»*. Lo que agrego
es que **la ventana para que esa respuesta sea una decisión y no una descripción se cierra pasado
mañana**, y que el documento ganó un encargo nuevo en el camino.

**¿Es nuevo, o es el arreglo?** **Ni uno ni otro en su mitad principal: es una ausencia, y es mi
`F-8cC2-*` entero reejecutado.** Lo que **sí** es de esta tanda es el paso 4: el encargo explícito
del orden de los grants lo escribieron `1e3c3fc9e` (que reescribió `V/21` §2.4) y su par en
`B/21` §2.4. Antes de la tanda ningún capítulo le pedía nada al documento del corte.

**¿Lo habría encontrado el grep?** **No, y la §1.1 lo mide: 25 de 26 términos dan cero sobre el
corte.** El único no-cero es *«lápida»*, con dos apariciones, y no lo redefinió ningún arreglo de
esta tanda. El término del encargo nuevo sería *«el procedimiento del corte»*, que es una frase en
castellano y no un término del modelo. **Un documento que hace afirmaciones cuantificadas sobre un
conjunto sin nombrar a sus miembros es invisible a una búsqueda por miembro** — es el mismo
enunciado que escribí en `F-8dC2-005` y sigue siendo el resumen del problema.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y esta vez ni siquiera por el alcance.**
La obligación 2 manda escribir el rastro *«por aparición»*; sobre este archivo **no hay apariciones
que resolver**, así que un arreglo puede cumplir las cuatro obligaciones al pie de la letra y dejar
el documento del corte intacto y vencido. Es el límite que `F-8dC2-009` declaró para
`DEC-METH-009` y que `DEC-METH-010` **no cambió**: las dos reglas operan sobre apariciones, y acá
lo que falta es un documento.

---

### F-8eC2-008 — `NUCLEO` · Cuatro capítulos del núcleo siguen sin ser de ninguna de las 22 unidades mientras los once commits escribieron en los seis, y la tanda estrenó la primera fila de reparto cuyo dueño es «el núcleo», que no es una unidad

**Qué se rompe.** El panel administrativo del sistema de cobro —las doce acciones con su permiso
propio, su registro de auditoría y su confirmación explícita— **sigue sin constructor**, y la tanda
escribió la primera fila del programa que lo admite por escrito sin resolverlo: asigna un trabajo a
*«B13 y el núcleo»*, donde **«el núcleo» no es ninguna de las 22 unidades**. Un inventario que no
contiene una pieza no puede reportar que falta; uno que le pone un dueño inexistente **reporta que
la tiene**.

**El camino.**

1. **Las 22 unidades citan el núcleo dos veces**, recorrida la columna «capítulos» entera: `V1` con
   *«`02` §1 (núcleo)»* y `V9` con *«`01` §1.2 (núcleo)»*, esta última agregada por `621332e7c`.
   **`nucleo/03`, `nucleo/04`, `nucleo/07` y `nucleo/08` no aparecen en ninguna de las 22 filas.**
   (Es una mejora sobre la vuelta anterior, donde eran cuatro incluido el `01`; el `02` ya estaba.)
2. **La fila nueva, y es de esta tanda.** `HOS-1354/descomposicion.md` §3.1, tabla *«El bloqueo
   alcanza a la ejecución, no al disparador»*: *«| que el caso aparezca en el listado accionable con
   qué devolver (`NUCLEO/08` §4.3) | **B13 y el núcleo** | sí |»*. Medido con
   `git log -S "B13 y el núcleo"` → **`f4edbdfdf`**. Las otras cuatro filas de esa tabla nombran
   unidades reales (`B7`, `B11`, `B6`); ésta nombra una unidad y un artefacto.
3. **Y lo que cuelga de esos cuatro capítulos creció en esta tanda.** `NUCLEO/08` §3 lleva las doce
   acciones administrativas con su regla —*«Cada acción lleva tres cosas: permiso propio, registro
   de auditoría, y confirmación explícita si es destructiva o mueve dinero»*— y la tanda le agregó
   el acto de **anclarle una vertical nueva a un grant vivo** y reescribió la fila de *«reembolsar»*
   con su desenlace de `DEC-RF-002`; `NUCLEO/04` ganó `D16`; `NUCLEO/07` ganó dos filas de correo y
   el tercer aviso de retención; `NUCLEO/03` recibió reglas de lectura de cuatro commits distintos.
4. **Los once commits escribieron en los seis capítulos del núcleo.** Contado sobre
   `git show --name-only`: `nucleo/01` en siete commits, `nucleo/03` en cinco, `nucleo/04` en
   cuatro, `nucleo/07` en tres, `nucleo/08` en cuatro. **La mayor parte de la escritura de la tanda
   aterrizó en capítulos que ninguna unidad construye.**
5. **Y la partición sí los había repartido**, `11-particion-del-programa.md` §4: `04` **PARTIDO**,
   `07` **PARTIDO**, `08` **PARTIDO**. El reparto existe a nivel de capítulo y **no bajó nunca al
   inventario de unidades**, que es el único lugar donde el tablero del §5 mira.

**Dónde lo permite el diseño.**

- `HOS-1353/descomposicion.md` §2 y `HOS-1354/descomposicion.md` §2 y §3.1 (columna «capítulos» y
  la fila *«B13 y el núcleo»*).
- `HOS-1352/docs/11-particion-del-programa.md` §4 y §4.1.
- `HOS-1352/docs/nucleo/08-auditoria-y-observabilidad.md` §3 y §4.3 ·
  `HOS-1352/docs/nucleo/04-invariantes.md` · `HOS-1352/docs/nucleo/03-maquinas-de-estado.md`.
  **`NUCLEO`.**
- Medición propia: la columna «capítulos» de las 22 filas; `git log -S "B13 y el núcleo"`;
  `git show --name-only` sobre los once commits.

**Severidad.** `MEDIA`, y **la bajo desde la `ALTA` que le puse en la vuelta anterior**
(`F-8dC2-002`), con motivo: dos de los seis capítulos ya entraron al inventario, así que el
mecanismo demostró que funciona y lo que queda es aplicarlo. Lo que **no** bajó es la consecuencia:
las doce acciones administrativas, con *«otorgar o revocar un grant permanente»* clasificada como
*«**sí**, y **la más grave**»*, siguen sin quién las construya y sin quién las exija.

**¿Es nuevo, o es el arreglo?** **La ausencia es anterior** —es `F-8dC2-002`, que sigue llegando—.
**La fila *«B13 y el núcleo»* es el arreglo: `f4edbdfdf`.** Es un dato interesante por sí solo:
es la primera vez que un arreglo **mira** el problema —necesitó nombrar quién construye el listado
accionable— y lo resolvió escribiendo un dueño que no está en la tabla de unidades del mismo
documento, doscientas líneas más arriba.

**¿Lo habría encontrado el grep?** **No.** El término que `DEC-RF-002` y `f4edbdfdf` redefinen es
*«reembolso»*/*«reembolsar»*, y `rg` sobre los cuatro documentos de implementación devuelve **10**
apariciones, todas en `B/descomposicion` y todas dentro de `B5`, `B6`, `B7` y el §3.1 nuevo:
**ninguna sobre el panel de administración**. La regla busca **términos en capítulos**, y la
ausencia de un capítulo entero del inventario de trabajo **no es una aparición que resolver**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el mismo límite estructural que el
`F-8eC2-003`.** La obligación 2 recorre apariciones no corregidas; acá el defecto es que **falta una
fila**, y una fila que falta no tiene aparición. La obligación **4** —el inventario de consumidores—
apunta en la dirección correcta pero está escrita sólo para *«cada término que el núcleo define»*,
no para *«cada capítulo que el núcleo contiene»*. **Extenderla del término al capítulo es barato y
es lo único que cerraría esta familia.**

---

## BAJA

### F-8eC2-009 — Veintiuno de los treinta y tres archivos que la tanda editó declaran un `updated:` anterior al 2026-09-21, y entre ellos están el contrato de la frontera, el decision log, el handoff, la partición y los dos `spec.md`

**Qué se rompe.** El único dato que un agente o una persona que entra al programa tiene para saber
si lo que está leyendo es de antes o de después de la última tanda es el `updated:` del frontmatter,
y en **21 de 33 archivos miente para abajo**. El caso peor es el contrato de cobertura: seis de los
once commits lo editaron y sigue diciendo `updated: 2026-09-20`, sobre el documento del que
`DEC-ARCH-006` dice que *«ninguna de las dos épicas lo puede mutar sola»* — o sea, el único del
programa donde saber si se movió es una obligación y no una comodidad.

**El camino.**

1. **La unión de archivos que los once commits tocan es 33**, contada con
   `git show --name-only` sobre los once y `sort -u`.
2. **Veintiuno llevan un `updated:` anterior a `2026-09-21`.** Recorridos uno por uno con
   `rg -o "^updated: .*"`. Los de mi vector y del paraguas:
   `12-contrato-de-cobertura.md` → **2026-09-20** (seis commits lo editan) ·
   `01-decision-log.md` → **2026-09-20** (seis commits) ·
   `03-handoff.md` → **2026-09-20** · `11-particion-del-programa.md` → **2026-09-18** (dos
   commits) · `HOS-1353/spec.md` → **2026-09-18** (dos) · `HOS-1354/spec.md` → **2026-09-18**
   (dos) · `HOS-1353/descomposicion.md` → **2026-09-18** · `nucleo/04-invariantes.md` →
   **2026-09-20** · `nucleo/08-auditoria-y-observabilidad.md` → **2026-09-19**. Y once capítulos
   más de las dos épicas, el más viejo `V/11-trial.md` en **2026-09-17**, que `1e3c3fc9e` y
   `fe7d14914` editaron los dos.
3. **No es que nadie lo haga: es que se hace a veces.** Doce de los 33 **sí** quedaron en
   `2026-09-21` —entre ellos `nucleo/01`, `nucleo/03`, `nucleo/07`, `B/descomposicion.md` y los dos
   `03-maquinas-de-estado.md` de billing—, así que la convención existe y se aplicó en poco más de
   un tercio de los archivos.
4. **Por qué es mío y no cosmética.** `DEC-ARCH-007` deja que las dos épicas se desarrollen en
   paralelo sobre una rama de integración que *«va a vivir meses»* (`D-28`), con
   *«**staging** se mergea HACIA la rama del paraguas, periódicamente y como obligación»*. En esa
   convivencia el `updated:` es el único marcador por documento de *«¿esto ya incorporó la última
   tanda?»*, y `03-handoff.md` abre diciendo *«Si sos un agente o una persona que acaba de entrar a
   este programa: leé esto entero antes»* — él mismo miente en un día.

**Dónde lo permite el diseño.** El frontmatter de los 21 archivos listados; `HOS-1352/docs/nucleo/
00-indice.md` §*«reglas de escritura»* como el lugar donde la convención tendría que estar
enunciada. Medición propia: el recorrido del paso 2, sobre la unión de `git show --name-only`.

**Severidad.** `BAJA`. Nadie paga de más, ningún dato se pierde y ninguna decisión cambia. Lo
reporto porque es **barato, mecánico y comprobable con una línea**, porque el archivo peor servido
es el que tiene la regla de mutación más estricta del programa, y porque una de las dos formas
conocidas de que una revisión mida contra el árbol equivocado es creerle a una fecha.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son los once.** Cada uno de los 21 archivos lo
dejó viejo un commit de esta tanda.

**¿Lo habría encontrado el grep?** **No aplica por término, y sí por el archivo.** No hay término
del modelo involucrado. Si se grepeara `updated:` sobre los archivos que cada commit toca —que es
una comprobación de una línea— devolvería los 21.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, veintiuna veces, y ése es el dato.**
El frontmatter es, para cada uno de los 21, *«una aparición no corregida en un párrafo que el commit
no tocó»* **dentro de un archivo que el commit sí abrió** — el caso exacto que la obligación 2
existe para registrar, y el que la obligación 1 describe con su propia frase: *«un archivo abierto
no es un párrafo leído»*. **La enmienda alcanzaba en los 21 casos y no se ejecutó en ninguno**, en
las dos tandas que reportaron cifras de apariciones (`1e3c3fc9e`, *«72 apariciones no corregidas
quedaron justificadas una por una»*, y `c29b318c7`, *«90 recorridas, 75 declaradas correctas»*) y
en las nueve que no reportaron ninguna. Es la medición más barata que tiene esta pasada sobre si la
obligación 2 se ejecutó de verdad, y contesta que no.

---

## 3. Dos cosas que verifiqué de otros informes, porque las iba a usar

**`F-8eA3-012` — la regla de vigilancia y sus dos bloques.** La verifiqué **abriendo los dos
archivos**, no el informe. `15-fase-9/00-dominios-de-los-racimos.md` §1 lleva el bloque de **tres**
campos rotulado *«Cita textual, `12-contrato-de-cobertura.md` §2»*, y
`15-fase-9/02-R2-resuelto.md` §1.1 lleva el de cinco más la dirección inversa. **Las dos citas de
A3 son correctas, y su conteo también**: fuera del contrato y de las cinco carpetas de informes
quedan tres apariciones, dos bloques y una prosa (`V/15` §2.6). Agrego un dato propio que A3 no
mide y que refuerza su lectura: `rg "^\s*fuentes: *\["` y `rg "cubierto: *sí"` devuelven
**exactamente esos tres archivos**, así que no hay una cuarta forma de escribir la firma que el
comando de la regla se esté perdiendo. **El comando es suficiente; lo que falló es correrlo.**

**`F-8eA3-004` — el corte escribe cinco clases de fila y declara una.** La recorrí sobre
`16-fase-7` §4.2, `B/21` §2.4 y §2.5 y `V/21` §2.4. **Las citas son correctas y el hallazgo se
sostiene.** `F-8eC2-001` y `F-8eC2-007` **no lo duplican**: el suyo es *qué filas se escriben y con
qué columna imposible*; el mío en 001 es **una frase del mismo § que quedó sin sujeto**, y el mío en
007 es **que el documento al que los dos capítulos le encargan el orden tiene fecha límite y nadie
lo abrió**.

**`F-8eA2-006` y `F-8eA3-003` — `G-R5` y las dos cifras de `D16`.** Las verifiqué contra `B/03` §5,
`V/02` §4.1 y `nucleo/04` `D16`. **Las dos son correctas** y `F-8eC2-004` **no las repite**: ellos
atacan *dónde corre el guard* y *si las cifras tienen columna*; yo ataco *qué unidad lo construye y
en qué orden del grafo*. Los tres miran el mismo guard desde tres lados distintos; **si son uno o
tres defectos lo decide el que deduplica, y no soy yo.**

---

## 4. Mis 9 hallazgos de la 8-bis-3, reejecutados sobre el texto de hoy

**No son hallazgos de esta pasada.** Cada camino se volvió a correr contra el texto, no contra el
mensaje del commit.

| id | veredicto | dónde corta, o dónde llega hoy |
|---|---|---|
| `F-8dC2-001` · la firma copiada en los dos `spec.md` | **CORTA** | verificado: `V/spec.md` §4 y `B/spec.md` §4 ya no llevan bloque, llevan remisión al §2 del contrato; los conteos pasaron a *«dos»*/*«cuatro»* y *«cuatro de las seis fuentes»*. El generador sobrevive en dos documentos de FASE 9 y **eso es `F-8eA3-012`**, no mío |
| `F-8dC2-002` · cuatro capítulos del núcleo sin unidad | **SIGUE, reducido a la mitad** | `nucleo/01` entró por `V9`; `03`, `04`, `07` y `08` siguen sin unidad → `F-8eC2-003` (el 07) y `F-8eC2-008` (los otros tres y la fila *«B13 y el núcleo»*) |
| `F-8dC2-003` · seis guards sin unidad, 11 de 24 | **SIGUE y empeoró** | recontado hoy: **26 guards, 12 sin dueño y 1 con dueño indirecto**. `G-R1-E` nació sin unidad; `G-R5` la recibió en la épica equivocada → `F-8eC2-004` |
| `F-8dC2-004` · la rama 1 aterriza en `B6`, que *«no detiene a ninguna otra»* | **CORTA en su mitad principal** | `B/descomposicion` §3.1 existe ahora, declara *«desde la FASE 9-bis-3 detiene la EJECUCIÓN de un desenlace de B7»*, parte el reembolso en cinco filas con veredicto por fila, y **corrigió el criterio de terminación de `B7`** con el texto que yo pedía. La mitad *«`S14`–`S16` no caen en ningún rango numérico»* sigue, y **no la reporto**: `B3` las toma por sección (`03 §3.1–§3.4`) y eso alcanza |
| `F-8dC2-005` · el paso 4 no es la única escritura | **SIGUE**, y hoy es ajeno | es `F-8eA3-004`, verificado en la §3. Lo que agrego de mío es otra cosa: `F-8eC2-001` |
| `F-8dC2-006` · la lápida fuera del barrido | **CORTA** | verificado en `B/21` §2.5: *«**Y el barrido la recorre de verdad, que es lo que hacía falta decir** … La cubre la **salvedad 4** del cap. 09 §3, porque su preapproval lo canceló una llamada **nuestra, hecha a mano y sin nadie que verifique** … vuelve al barrido hasta que la relectura la vea `cancelled`»*, y la exención de `B/09` §3 pasó de enumeración a **criterio**, que es exactamente lo que el hallazgo pedía. Lo que la salvedad 4 rompe del otro lado es `F-8eB3-005` y `F-8eB3-007`, ajenos |
| `F-8dC2-007` · la partición: *«una sola fuente»*, *«las otras tres»*, el disparador de `T2`/`T5` | **MITAD CORTA, MITAD SIGUE** | los conteos están corregidos (*«las **dos** fuentes … las **cuatro** de billing»*, §3.1). El §3.2 punto 1 sigue palabra por palabra, y `T7` lo empeoró → `F-8eC2-002` |
| `F-8dC2-008` · `V/21` §2.4 afirma *«nadie tiene un título vivo»* | **CORTA** | verificado: el § lleva hoy *«**Dos correcciones sobre esta misma verificación, porque razonaba sobre el conjunto equivocado**»*, con las dos que yo señalaba y una tercera que yo no tenía (el orden). El punto 3 que ese arreglo escribió es el encargo que `F-8eC2-007` mide |
| `F-8dC2-009` · el grep no alcanza el documento del corte | **SIGUE, y peor** | recontado con los términos nuevos: **25 de 26 dan cero** sobre el corte y el único no-cero (*«lápida»*, 2) no lo redefinió ningún arreglo de esta tanda. `DEC-METH-010` no cambió esto: sus cuatro obligaciones operan sobre apariciones → entra en `F-8eC2-007` |

**Conteo: 4 cortan · 1 corta a medias · 4 siguen llegando.** Es la primera vuelta en que mi vector
tiene más cortes que supervivientes, y **los cuatro cortes son arreglos que tocaron documentos de mi
vector** — la primera tanda que los abrió.

**Y un dato que corresponde a esta sección y no a un hallazgo**: la fecha límite que la FASE 7 se
pone a sí misma **vence pasado mañana**. `16-fase-7…` §2: *«Se escribe ANTES de que nazca la rama
del paraguas»*; `D-28`: *«Plazo: hasta el **2026-09-23**»*. Hoy es el **2026-09-21**. En los once
commits de la tanda no hay una línea de los cinco ítems huérfanos. Es la cuarta vuelta que lo digo
y la primera en que el plazo es de dos días.

---

## 5. Ataques que intenté y el diseño resistió

Seis, y valen tanto como los hallazgos.

**1. «`B9` libera antes que `B10`, así que hay una ventana en que un grant con `includesAddons:
true` cancela la principal y el complemento sigue cobrando.»** Lo armé entero y **el diseño lo
declara y lo ordena bien**. `B/descomposicion` §2, fila `B9`: *«**`S20` no es de acá**: el grant
cancela la principal (`S13`) y el complemento lo apaga **B10**, que llega después en el camino
crítico y es donde vive el modelo del addon»*, y el grafo del §3 pone `B9 → B10` en el camino
crítico, en ese orden. Más arriba, `DEC-ARCH-007` cierra la puerta de la liberación parcial de
raíz: *«**Las dos llegan a producción juntas y terminadas**»*, con la rama de integración que
convierte *«no lo hagas»* en *«no se puede»*. **La ventana existe dentro de la rama del paraguas y
no llega a producción**, y el documento que reparte la eligió a propósito. Es de las decisiones
mejor escritas de la descomposición.

**2. «`D16` supone que el reloj de inactividad arranca en cero el día que empieza la pausa, y no
tiene por qué.»** Lo intenté y **el glosario lo cierra por definición**. `NUCLEO/01` §1.2:
*«**Inactividad** (de una ficha): el tiempo que lleva **sin estar a la vez publicada y cubierta**»*
— o sea, mientras la ficha está publicada y cubierta la inactividad **es cero por definición**, no
por un evento que la reinicie, así que una pausa sobre una ficha viva arranca el reloj en cero y
los 120 días del tope caen dentro de los 180. El caso en que el reloj **ya venía corriendo** cuando
la pausa empieza es real y es **`F-8eA2-009`**, ajeno; lo que resistió es la forma del invariante
para el caso que el § describe. Y la acumulación tampoco rompe: entre dos pausas hay una
reanudación, y *«`cubierto` pasa a verdadero»* es el hecho de reinicio número 2 de la lista cerrada.

**3. «El corte quedó expuesto a la familia nueva de la sucesión: una `S19` pendiente o un `sucede_a`
sin cerrar lo cruzan.»** Lo rearmé con las filas nuevas y **sigue sin existir**, por el mismo motivo
que la vuelta pasada y ahora con más filas que probarlo. El sistema nuevo no tiene una sola fila
hasta el paso 4 —*«El sistema nuevo no hereda una sola fila»* (`B/21` §2.4)— así que no hay
predecesora en `GRACE_PERIOD` ni en `SUSPENDED` para que `S19` retenga nada, no hay `sucede_a` que
apuntar, no hay `S18` que cerrar, no hay complemento del que `S20` o `S21` puedan colgar y no hay
pagador manual al que `MP5` pueda abrirle una cuota. **El corte es inmune a las seis filas nuevas de
esta tanda, y lo es por construcción.** Lo que sí le tocan es lo que queda **alrededor** del
esquema: la escritura del grant (`F-8eA3-004`) y el orden que nadie fijó (`F-8eC2-007`).

**4. «La partición se rompió: `DEC-SUB-013` mete un reloj de billing que verticales tiene que
saber.»** No. Medí la frontera después de la tanda y sigue siendo **un hecho y un aviso**: `MP5`
es interno a billing, su efecto declarado es `S4` —una transición de billing— y el único puente
hacia verticales sigue siendo `cubierto` cambiando. Más aún, el `B/03` §5 escribe explícitamente por
qué **no** se lo cuenta a verticales: *«Verticales no sabe que detrás de esa pérdida de cobertura
hay una pausa, y `DEC-TRIAL-008` decidió que no lo sepa, así que lo que protege al cliente no es una
excepción sino dos cosas: **`PB7` republica la ficha sola** … y **el tope de una pausa es menor que
el día del hard delete**»*. **La frontera aguantó las ocho decisiones nuevas enteras**, que es el
resultado más sólido del programa en cuatro vueltas.

**5. «`B6` bloquea todo y ahora `MP4` y `MP5` cuelgan de él: el programa entero es inejecutable.»**
Lo intenté y **el §3.1 nuevo lo acota con precisión quirúrgica**: su tabla separa *«mover la plata
de vuelta cuando el pago entró **por el proveedor**»* (`B6` 🔒) de *«cuando el pago entró **a mano**»*
(`B7`, *«se devuelve por donde entró —una transferencia— y **no toca la pasarela**»*), y concluye
*«**B7 puede quedar entera y correcta con B6 sin empezar**»*. La división de `B5`/`B6` del §2.4
—*«Sin esta división, B7 heredaría la falta de diseño y serían cuatro los capítulos que hay que
escribir en vez de uno»*— sigue siendo correcta después de la tanda. Lo que **no** resistió es el
reparto de `B5` mismo, y eso es `F-8eC2-005`.

**6. «El paraguas se puede partir ahora que el pago manual no necesita pasarela: que salga
verticales sola, o que salga el pagador manual antes.»** Lo intenté por cuarta vez y **falla igual,
y esta vez con un argumento nuevo en contra**: el pago manual se apoya en `B5` y `B7`, y `B5`
depende de `B3`, que depende de `B1`, que es *«el adaptador y el proveedor que miente»* — o sea la
unidad que más espera a la pasarela. Y `DEC-ARCH-007` no es una preferencia sino un mecanismo:
*«la unidad que llega a `staging` es el paraguas»*. **La partición aguanta, y su punto más fuerte
sigue siendo que la hace cumplir el flujo de ramas y no la memoria de nadie.**

---

## 6. Fuera de mi vector

- **[`C1` — la costura]** `HOS-1354/docs/21-migracion.md` **sigue con sus secciones fuera de
  orden**: §1 → §1.3 → §3 → §3.3 → **§2.4** → §2.5 → §4, medido con `rg -n "^#{2,4} "`. Y el §3.3
  sigue titulándose *«Las altas nuevas son una decisión del owner, y **se declara abierta**»* sobre
  una pregunta que `DEC-MIG-002` cerró y que `DEC-MIG-004` volvió a cerrar. **Es el cuarto informe
  consecutivo que lo reporta, intacto**, y cuatro commits de esta tanda abrieron ese archivo.

- **[`C1` — deduplicación]** `G-R5` lo miran tres informes desde tres lados: `F-8eA2-006` (dónde
  corre), `F-8eA3-003` (qué lee) y mi `F-8eC2-004` (quién lo construye y cuándo). `F-8eB1-010` le
  agrega un cuarto (la cortesía sin tope). **Si son uno o cuatro defectos lo decide el que
  deduplica.** Mi mitad es la única que no se resuelve escribiendo una columna.

- **[`C1` — el veredicto de método]** Tres de mis nueve hallazgos (`F-8eC2-002`, `F-8eC2-006`,
  `F-8eC2-009`) contestan **sí** a la tercera línea, y los tres son del mismo tipo exacto: *«párrafo
  no tocado dentro de un archivo que el commit sí abrió»*. En `F-8eC2-006` la distancia es de **dos
  renglones de la misma tabla**; en `F-8eC2-009` son **21 frontmatters**. Dos contestan **no** con
  el mismo motivo estructural (`F-8eC2-003` y `F-8eC2-008`: **una fila que falta no es una
  aparición**), uno contesta **no** porque el defecto vive en el párrafo que el arreglo escribió
  (`F-8eC2-001`, y es el único punto ciego que la obligación 2 crea por su propia redacción), y
  uno contesta **no** porque sobre ese archivo no hay apariciones de nada (`F-8eC2-007`).
  **Reparto: 3 alcanzables y no ejecutadas · 4 inalcanzables por tres motivos distintos.**

- **[`NUCLEO` → `C1`]** `nucleo/00-indice.md` lleva el *«51 invariantes»* que sostiene la
  indivisibilidad del núcleo (`F-8eC2-006`), y sigue siendo el documento donde tendría que estar
  enunciada la convención del `updated:` (`F-8eC2-009`). Los dos son de `C1` por vivir en `nucleo/`.

- **[repo, no diseño]** `F-8cC2-005` sigue entero: `rg -c "SPEC-143-billing-testing-coverage"
  CLAUDE.md` → **3**, y el directorio sigue sin existir en esta rama. El gate manual de billing que
  el `CLAUDE.md` del repo declara *«no negociable»* apunta a tres archivos que esta misma rama
  borró, y el PR que lo va a destapar es el que `DEC-ARCH-007` describe como el que *«nadie puede
  revisar de verdad»*.
