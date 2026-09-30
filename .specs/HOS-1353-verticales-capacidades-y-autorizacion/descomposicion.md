---
title: Descomposición de la épica de verticales
linear: HOS-1353
statusSource: linear
created: 2026-09-18
updated: 2026-09-27
status: CURRENT
---

# Descomposición de HOS-1353

> **Esto no es un plan de fechas ni el atomizado en tareas.** Es el corte en unidades de trabajo y
> el orden que sale de las dependencias del propio diseño. El atomizado de cada unidad se hace
> cuando esa unidad arranca, no ahora.

## 1. El criterio de corte

**Se corta siguiendo la cadena de preguntas del diseño**, no por capa técnica ni por capítulo.

Cortar **por capa** —toda la base, después todos los servicios, después la API— tiene el problema
conocido: nada funciona hasta el final, y el primer error de modelado se descubre cuando ya hay
tres capas encima. Cortar **por capítulo** es peor: los capítulos son ejes de diseño y se cruzan —
el `02` toca todo, el `15` y el `17` se necesitan mutuamente.

La cadena que sí ordena es la del propio sistema, y cada eslabón deja **una pregunta contestada**:

```text
¿qué verticales y qué claves existen?      → V1
¿qué otorga un plan?                        → V2
¿qué puede hacer esta cuenta?               → V3
¿tiene título vivo?                         → V4
¿puede hacer ESTO, acá y ahora?             → V5
¿qué pasa cuando algo baja?                 → V6
```

Las tres últimas —Partner, superficies, retención— no están en la cadena porque **no la
condicionan**: se apoyan en ella.

### 1.1 Dos reglas que valen para las nueve

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después es un
   guard que se escribe contra código ya escrito, y para entonces ya hay call sites que lo
   violan. Y cada uno **lleva su caso que lo hace fallar a propósito** — un guard que no puede
   fallar es un comentario con exit code 0.
2. **Ninguna unidad pregunta por dinero.** Si una lo necesita, es señal de que el corte de
   `DEC-ARCH-005` se está filtrando: se mira, no se resuelve en el lugar.

---

## 2. Las nueve unidades

| # | unidad | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|
| **V1** | **El catálogo y su doble guard** | el enum de verticales, su espejo en base, y el catálogo de claves de entitlement y limit en código, **y el package del contrato** (revisión del owner, 2026-09-28, N6, `L1-d`) *(desde el lote P-C lo crea vacío `U1`, y `V1` llena las cuatro primeras cosas; la quinta, la interfaz del reloj, la llena `B1`, en paralelo: verificación corta, 2026-09-29)*: el único punto de comunicación con billing, con las dos interfaces, sus validaciones, los simuladores de cada lado y los juegos de casos compartidos (contrato §7.1); ~~cada entrada entra con la unidad que construye su implementación~~ **`V1` escribe las interfaces, las validaciones y los simuladores de todas las entradas, las de ida y las de la dirección inversa, y cada unidad que construye una implementación trae sólo esa implementación** (contrato §7.1; FASE 9 vuelta 3, `F-8V3C1-005`) | `02` §1 (núcleo) · `10` §1 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §7.1 | `G1` `G3` ~~`G8`~~ **`G14`** *(que una mitad no importe a la otra; N6)* *(`G8` pasó a `U1`, la unidad del paraguas que hace la limpieza del principio: verificación corta, 2026-09-29, lote O-A; `16-fase-7…` §4.6)* |
| **V2** | **El catálogo de planes, y la dirección inversa del contrato** | `plan`, `plan_version` y sus entitlements y limits, con `rank`, vigente y vendible — **y las ~~tres~~ dos consultas con que billing lee este catálogo**: `políticaDePlan` ~~, `situaciónDeVertical`~~ y `direcciónDeCambio`, que devuelve **un veredicto** y nunca los valores ~~— `situaciónDeVertical.admiteAltas` la lee además `S1`, que rechaza el alta nueva y la sucesión en una vertical que ya no admite altas (owner 2026-09-25; FASE 9 completa, 6a)~~ (revisión del owner, 2026-09-28, C8: `situaciónDeVertical` salió) — **y `políticaDeAddon`**, con que billing lee de una `addon_version` su `addon`, su vigencia y su tipo de scope, nunca lo que otorga (owner 2026-09-26, `G4-2`; su consumidor es `A1`, de `B10`) ~~; **y la mitad de verticales del acto de discontinuar, que escribe `admite_altas = no` antes que billing escriba la fecha y los avisos** (`02` §2.1, `B/10` §4.3; owner 2026-09-27, FASE 9 vuelta 2, `Q-ALTAS`)~~ (sale con la revisión del owner, 2026-09-28, C8) | `02` §2.1 · `10` §2 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §4.1 | ~~**`G-R3`**~~ *(pasa a ser una validación de *«publicar una versión de plan»*, que V2 construye igual; revisión del owner, 2026-09-28, N1)* |
| **V3** | **La resolución de capacidades** | *«¿qué puede hacer esta cuenta en esta vertical?»* tiene respuesta: agregación, scopes, caché e invalidación — **la invalidación por `user`, en todas sus verticales, y no por `user + vertical`** (`02` §3.2 regla 3; owner 2026-09-25, FASE 9 completa, 8a), **y la de una vertical entera, que ~~el barrido del día del fin de servicio invoca~~ invoca el reconciliador diario de cobertura, de V6, en su corrida del día del fin de servicio** (`02` §3.2; 6b — ~~el barrido es de `B12`~~ el ejecutor, owner 2026-09-27, FASE 9 vuelta 2, `R5`); **el trinquete del `GRANT` leído del campo `piso` de la fuente** y nunca de una tabla de billing (`15` §2.5; 9h) | `15` §1–3 · `02` §3 | **`G-R2`** **`G-R2-B`** |
| **V4** | **El contrato de cobertura y el trial** | hay títulos vivos de verdad, y `cobertura()` responde **con la firma entera del contrato §2** —hoy ~~siete campos, con `piso` (9h)~~ ocho campos, con `piso` (9h) y `desde`, que la de arranque devuelve en la de trial y en `BASE`, por la revisión del owner, 2026-09-28, C4—; **la máquina de trial con sus ~~ocho~~ siete transiciones** (`T7` salió: revisión del owner, 2026-09-28, N7): el trial se convierte con el primer pago acreditado (`DEC-TRIAL-010`), **`T6` exige un título que convierte y `T8` consume la fila al primer pago de quien ya ejerció el evento** (owner 2026-09-25; FASE 9 completa, 6c); **`T6`, ~~`T7`~~ y `T8` emiten el aviso de cobertura, como `T1`–`T5`, y todo aviso sale después del commit** (contrato §3, *«quién emite»*; FASE 9 vuelta 2, `F-8V2C1-007`, `F-8V2A2-008`, `F-8V2C1-002`); **y la operación `extenderTrial`** del contrato §4.1 —la única escritura de billing en verticales—: corre `T4` dentro del lock de la máquina de trial, con el techo de `11` §3, y contesta `ACEPTADA` o `RECHAZADA`; la clave de canje la vuelve idempotente (owner 2026-09-26, `G4-2`; la consume `B9`) **y verticales la guarda en `canje_de_trial` al aplicar la extensión, así que un reintento con la misma clave contesta `ACEPTADA` sin correr `T4` otra vez** (`02` §2.2; FASE 9 vuelta 3, `F-8V3C1-003`); ~~**y la respuesta de arranque de `finDeServicio`, `NINGUNA`, en el módulo que contesta por billing y que `G13` no deja llegar a producción** (contrato §4.1, §5.1 y §6.3; owner 2026-09-27, FASE 9 vuelta 2, `R5`, `F-8V2C1-005`)~~ (sale con la revisión del owner, 2026-09-28, C8); **y la acción administrativa *«extender un trial»*** de `NUCLEO/08` §3 —la cortesía durante el trial—, **fuera del contrato**: `T4` con origen `SUPER_ADMIN` y motivo obligatorio, pasa el techo de `11` §3.4 y suma al total visible con su origen (`11` §3.5), con permiso propio y auditoría (owner 2026-09-26, P2; FASE 9 vuelta 1); **y el lock de la máquina de trial, que es el de publicación por `user + vertical` y lo toman sus ~~ocho~~ siete transiciones (`T7` salió: revisión del owner, 2026-09-28, N7); ~~la vuelta por `PB3`/`PB7` bajo un título que paga contando para la guarda de `T8`~~ (salió con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`); `T4` con la fecha de fin sin pasar, y `T3` sin escribir el reloj** (`03` §2; owner 2026-09-27, FASE 9 vuelta 2, `R15`, `F-8V2A2-003`, `F-8V2A2-007`); **y `T1` exige una versión de plan vigente y vendible** (`03` §2; owner 2026-09-27, FASE 9 vuelta 2, `R24`); **y lee la hora por la interfaz del reloj del package del contrato, que escribe `B1`: `V4` depende de `B1`, la duodécima dependencia entre épicas** (contrato §7.1, punto 5; FASE 9 vuelta 3, `F-8V3C1-006`) | `11` entero · `03` §2 · `02` §2.2 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) | **`G-R4`** **`G-R4-B`** **`G-R6`** **`G13`** *(owner 2026-09-26, `G5-5`; §2.3)* |
| **V5** | **La autorización** | ninguna operación se ejecuta sin pasar por los ~~nueve~~ siete pasos — **con la vertical leída del recurso e inmutable** (precisión 6; 7a), **lo ajeno existente sólo en estado público** (precisión 7; 8c), **el paso 2 sin «inhabilitado por abuso»** (8b) y **las lecturas de lo propio sin el paso 6** (§3.5; 8d); todas owner 2026-09-25, FASE 9 completa; **el guest rechazado en el paso 1 salvo en la lectura pública, la lista cerrada del paso 2 con el correo sin verificar, ningún rol como fuente del conjunto efectivo** (FASE 9 vuelta 1, `F-8V1A1-006`, `-007`, `-002`) **y ninguna acción administrativa con `actor = sujeto`** (owner 2026-09-26, `G5-1`); **la precisión 7 sólo para lo que no escribe, el sujeto que no elige el pedido (precisión 8), un permiso de inspección por entidad del §48, y la acción 15 evaluada sobre el dueño** (FASE 9 vuelta 2, `F-8V2A1-001`, `-002`, `-004`), ~~**y la acción 16 evaluada sobre el actor** (owner 2026-09-27, `Q-ACC16`)~~ (salió con la revisión del owner, 2026-09-28, C8) | `17` entero | `G2` `G4` `G6` **`G-R3-B`** **`G-R3-C`** |
| **V6** | **Publicación y excedente** | una ficha se publica, cae al perder cobertura, vuelve al recuperarla **—también desde `ARCHIVED`: sola por `PB7`, o a pedido del dueño por `PB8`, que la versión de piso le autoriza—**, y el excedente se resuelve solo **en las dos direcciones**: cae lo más reciente primero y **vuelve primero lo que cayó al final**, con el criterio escrito en los dos avisos — **y el reconciliador diario de cobertura**, que una vez por día corre `PB2`/`PB3`/`PB7` donde el aviso no llegó, escribe los hechos 2 y 5, invalida el caché y le hace ping al monitor de cron externo (`03` §9; `DEC-ARCH-009`, owner 2026-09-25) ~~**—y que en su corrida del día del fin de servicio de una vertical, leído por la pregunta `finDeServicio` del contrato §4.1, corre `PB2`, escribe el hecho 4 en cada ficha de la vertical con el instante de la fecha e invalida la vertical entera** (owner 2026-09-27, FASE 9 vuelta 2, `R5`)~~ (revisión del owner, 2026-09-28, C8) —**y cuya población incluye a todo `user + Partner` con una clave de presencia, la página o el carrusel, sobre el que no corre transiciones: compara las claves y, si difieren, invalida** (`03` §9, `18` §1.6; FASE 8 completa, `R13`, y FASE 9 completa, 7b)—. **Y la máquina entera, de seis estados y ~~doce~~ trece transiciones, de `PB1` a `PB13`** (FASE 9 vuelta 3, `F-8V3D1-005`: `PB13` entró con C10, y su reparto está en el §2.11) (salida 3 de la FASE 9 completa; decía sólo lo de arriba): **el lock por `user + vertical`** que toman `PB1`, `PB3`, `PB7` y `PB2` (`03` §9; FASE 8 completa, `R14`) **—y `PB8` y `PB9`, que comparten `desde` con `PB7` (FASE 9 vuelta 2, `F-8V2A2-004`), y `PB10`, `PB4`, `PB6` y `PB12`, que comparten el suyo con alguna de ellas (FASE 9 vuelta 2, verificación: `PB10`, caso vecino de `14-`; las otras tres, owner 2026-09-28, `V2-u`), y `PB5`, que comparte `DRAFT` con `PB1` (owner 2026-09-28, `V2-z2`)—**; **`MODERATED`, con `PB10` y `PB11`** —la acción administrativa de moderar, `NUCLEO/08` §3—, **y `PB11` como sexto hecho de reinicio** (owner 2026-09-25; FASE 9 completa, 5b); **`PB12`, el borrado del dueño a `PURGED`** (FASE 8 completa, `F-8CA2-004`), **con la desconexión del calendario de esa ficha en el mismo acto: su token se revoca en el proveedor y se borra** (`03` §9 `PB12`, `02` §4.1; owner 2026-09-26, `G1-5`; la unidad, con OK del owner, FASE 9 vuelta 1, J); **la vertical de la ficha inmutable desde el alta** (`02` §2.5; 7a); **y la escritura `C` del corte**, que pone `inactiva_desde` en el instante del corte a toda ficha preexistente en la misma migración estructural que crea la columna (`21` §2.4; asignada en la salida 3 de la FASE 9 completa, §2.10); **el estado de nacimiento de la ficha preexistente** (`21` §2.4, la tabla `L1`–`L8`), en la misma migración que la escritura `C`, ~~**incluido el borrado del contenido de las `L1`**~~ **y, en el paso 5b del corte y no en la migración, el borrado del contenido de las `L1` —en la base, sus fotos en el almacenamiento externo y su token de calendario—, con una herramienta del corte que se puede correr dos veces** (`16-fase-7…` §4.2; FASE 9 vuelta 2, `F-8V2A3-002`); **y, en el paso 4c del corte, la revalidación de las páginas públicas de las fichas que nacieron despublicadas, que la escritura de nacimiento no programa porque no es una transición** (`16-fase-7…` §4.2; FASE 9 vuelta 2, `F-8V2C2-006`); **y `PB1` desde `UNPUBLISHED_BY_BILLING` por su rama de trial** (FASE 9 vuelta 1, R1; owner 2026-09-26, `G1-1`, `G1-2`); **y la consulta ~~`ficha(idDeFicha) → { vertical, dueño }`~~ `ficha(idDeFicha) → { vertical, dueño, admiteDestaque }`** del contrato §4.1, con que `A1` valida el objetivo de un addon `LISTING` (owner 2026-09-26, `G4-2`; **`admiteDestaque`**, FASE 9 vuelta 1, `N-G4V-06`) **—y la consulta `fichaPurgada` del contrato §4.1 con el empuje *«la ficha llegó a `PURGED`»* de `PB12`, que sale después del commit (`12-contrato…` §3.1; owner 2026-09-26, `G2-1`; la fila no la nombraba, FASE 9 vuelta 1, §4 punto 4 de `24-verificado-G4`)—**; **y `PB8` bajo el lock, `PB12` con la lista cerrada de lo que cuelga de `listing`, la referencia anulable de la conversación, `listing` sobre las tres tablas actuales, ~~y el registro de `PB3`/`PB7` diciendo si una `SUSCRIPCIÓN` cubría la vuelta~~** (`03` §9, `02` §2.5 y §4.1; FASE 9 vuelta 2, `R9`, `R15`, `F-8V2A2-004`, `F-8V2A3-003`; el registro salió con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`) | `03` §9 · `02` §2.5 · `15` §4 · `21` §2.4 *(la escritura `C`)* | `G5` **`G-R6-B`** ~~**`G-R5-B`**~~ *(el `N` de `PB5`, que V6 construye; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25; desde la revisión del owner, 2026-09-28, C9, es una validación de *«cambiar un plazo»* y no un guard)* **`G-R9`** *(la lista cerrada de `PURGED`, que `PB12` aplica antes que `PB9`; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`)* |
| **V7** | **Partner** | la postulación con su máquina, la presencia como entitlement booleano, y el reclamo por correo — **la presencia sin máquina: la página y el carrusel se ven si el partner tiene hoy su clave —cada uno la suya— y la presencia no está moderada**; **el bit de moderación y su escritura** por la acción administrativa de moderar, la misma de `PB10`/`PB11` (§2.10); **y la respuesta 404, no 410, al partner sin presencia** (`21` §4); FASE 8 completa, `R13`; owner 2026-09-25, FASE 9 completa, 7b y 7c; **y el reclamo con sesión, a la cuenta que reclama, que verifica el correo si es el de esa cuenta; el correo nunca verificado que no se cambia con un vínculo; la guarda de `PP1` como restricción de la base, con la espera anulable por el admin** (`18` §2.2 y §2.4, `02` §2.7; owner 2026-09-27, FASE 9 vuelta 2, `R7`) | `18` entero · `03` §11 · `21` §4 *(el 410 que pasa a 404)* | — |
| **V8** | **Superficies** | Mi Cuenta, los mensajes que hay que decir, el panel de postulaciones — **incluido el botón de suscribirse que, a quien todavía no publicó en esa vertical, lo manda a publicar en vez de al checkout** **si publicar le arrancaría el trial** (FASE 9 vuelta 1, `F-8V1D1-004`) (`19` §4 fila 23, donde está la regla entera; owner 2026-09-25, FASE 9 completa, 6c; el espejo de billing es `B/19` §4, de `B13`), y las filas 20 a 22 (la ficha `PURGED`, *«suscribite para publicar»*, la presencia que dejó de verse o está moderada); **y la acción administrativa 15, *«editar el contenido de una ficha ajena»*** —crearla en borrador a nombre de su dueño, corregirla, restaurar contenido, **sin publicar, sin destacar y sin borrar**—, **con permiso propio** (el *«sin borrar»* vale para la edición de contenido: borrar a pedido del dueño son las acciones 23 y 24; revisión del owner, casos vecinos, 2026-09-29, caso F-C), auditada con el actor, el sujeto y el *«por qué»* del `NUCLEO/08` §1.2, y con el aviso al dueño de la ~~fila 1~~ **fila 26** del `19` y su correo de `NUCLEO/07` §6 (`NUCLEO/08` §3; `DEC-AUTH-003`; owner 2026-09-26, `G5-2`; la unidad, con OK del owner, FASE 9 vuelta 1, L; la fila, FASE 9 vuelta 2, `F-8V2D1-002`), **con sus pasos 5 a 7 evaluados sobre el dueño de la ficha y no sobre el admin** (`17` §3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`); **y las acciones administrativas 23 y 24, borrar una ficha ajena por `PB12` y ~~borrar una cuenta~~ **dar de baja una cuenta** (caso I-C), las dos a pedido de su dueño y con motivo** (§2.11; revisión del owner, casos vecinos, 2026-09-29, caso F-C); **y las filas 27 y 28 del `19` §4, la alerta de precio cerrada y la conversación en sólo lectura sobre una ficha `PURGED`** (owner 2026-09-27, FASE 9 vuelta 2, `R9`); **y la fila 29 del `19` §4, la vertical sin planes disponibles** (owner 2026-09-27, FASE 9 vuelta 2, `R24`) | `19` · `08` §1.2 y §3 (núcleo) | — |
| **V9** | **Retención** | el reloj de 90 y 180 días **con sus ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos de reinicio** (~~el cuarto lo escribe el reconciliador diario de cobertura, de V6, en su corrida del día del fin de servicio —era el barrido de `B12`: owner 2026-09-27, FASE 9 vuelta 2, `R5`—~~ el cuarto salió con la revisión del owner, 2026-09-28, C8; el sexto, *«se levanta la moderación»*, lo escribe `PB11`, de V6 —owner 2026-09-25; FASE 9 completa, 5b—; el quinto lo escribe ~~`PB2`, de V6~~ `PB2`, de V6, sobre la ficha publicada, y el recálculo que el aviso despierta sobre las demás fichas del dueño en la vertical —o, si el aviso se perdió, el reconciliador diario de cobertura, de V6 (`DEC-ARCH-009`)—; FASE 8 completa, `F-8CA2-001`, owner 2026-09-25), ~~la anonimización,~~ **el día 180 como la fila `PB9` hacia `PURGED`, que sólo borra el contenido de la ficha (`DEC-DATA-005`; FASE 8 completa, `F-8CA2-008`)**, **y en el mismo acto desconecta el calendario de esa ficha: su token se revoca en el proveedor y se borra** (`03` §9 `PB9`, `02` §4.1; owner 2026-09-26, `G1-5`; la unidad, con OK del owner, FASE 9 vuelta 1, J), el ~~hash~~ **seudónimo determinístico** del correo (FASE 9 completa, `C-1`), los **tres** avisos, **y el registro de los actos del dueño sobre la ficha que no son transiciones —crearla, editarla, exportarla—, que es la fuente del hecho 1, guardando sólo el nombre de los campos de contenido, nunca su texto**, para que el día 180 no deje el contenido vivo en los eventos (`NUCLEO/08` §1.1–§1.2; owner 2026-09-25, FASE 9 completa, 8e); **y el empuje *«la ficha llegó a `PURGED`»* que `PB9` le manda a billing después de su commit** (contrato §3.1; FASE 9 vuelta 1, `G2-1`); **y `PB9` bajo el lock, con la lista cerrada de lo que cuelga de `listing`, y la función del seudónimo** (`03` §9, `02` §2.2 y §4.1; FASE 9 vuelta 2, `R9`, `F-8V2A2-004`, `F-8V2A3-004`) | `02` §4 · `22` §3 · `01` §1.2 (núcleo) · `03` §9 (`PB9`) · `08` §1.1–§1.2 (núcleo) | — *(decía «el de `D16`», que era `G-R5`; se va a `B8` — §2.7)* |

### 2.1 Por qué V1 va primero aunque parezca infraestructura

Porque **dos de sus tres guards** son **los únicos que no se pueden agregar después sin reescribir lo
anterior**. `G1` prohíbe nombrar una vertical fuera de los ocho ítems del Eje 2 y `G3` verifica el
catálogo de claves **en las dos direcciones**. Si llegan en V5, para entonces hay cinco unidades
de código que los violan y el guard nace con una lista de excepciones — que es exactamente cómo
un guard deja de servir.

### 2.2 Por qué el trial y el contrato son la misma unidad

Porque **el trial es la implementación de arranque del contrato** (`DEC-ARCH-006`). Separarlos
dejaría el puerto sin ninguna fuente que lo responda de verdad, y ahí la única opción sería un
simulacro que contesta siempre lo mismo — que es justo lo que la decisión descartó, porque **deja
sin ejercer la mitad interesante: perder la cobertura**.

### 2.3 ~~Hay un guard de V4 que NO nace en V4, y nace del otro lado~~ `G13` nace en V4, como dice el contrato

> **Reescrito el 2026-09-26 (owner, `G5-5`; FASE 9 vuelta 1, contradicción (a)).** **`G13` lo
> construye `V4`**, con la implementación de arranque, y su fila vive en `V/20` §2. El argumento de
> abajo —*«falla desde el primer día»*— lo contesta el propio contrato §6.3: el guard **falla sobre
> un build destinado a producción, no sobre la rama**, así que calla mientras ningún build apunte a
> producción y no nace con lista de excepciones. Y la razón que lo mandaba a billing (*«el consumidor
> del contrato es billing»*, `B/20` §2) era falsa: el consumidor de `cobertura()` es verticales. Las
> dos ubicaciones protegían el merge, porque las épicas llegan juntas (`DEC-ARCH-007`); ésta además
> tiene la defensa desde el primer día. Lo que sigue queda como historia.

*(Este § decía *«esta tabla dejó a V4 sin guards»*, y desde el reparto del §2.6 V4 tiene tres:
`G-R4`, `G-R4-B` y `G-R6`. ~~Lo que sigue valiendo entero es el caso de `G13`, que es de otra
naturaleza: es un guard **sobre** lo que V4 construye y que **no puede nacer acá**.~~ **Desde `G5-5` son cuatro: `G13` nace en V4 (el recuadro de arriba), así que *«no puede nacer acá»* ya no vale; FASE 9 vuelta 1, §4 punto 2 de `24-verificado-G4`.**)*

El que le correspondía a V4 y no podía nacer en V4 lo encontró la descomposición de billing:
**`G13`**, la tercera defensa del
[contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3 — *«un
guard impide que la implementación de arranque llegue a producción»*.

~~**No puede nacer acá.** Mientras la de arranque es la única implementación que existe, un guard que
prohíba su llegada a producción **falla desde el primer día**, y un guard que falla desde el primer
día nace con una lista de excepciones — que es exactamente el argumento del §2.1, leído al revés.~~

~~Nace en **B4** de la otra épica, que es donde aparece la segunda implementación. Queda anotado acá
para que nadie lo lea como un olvido.~~ (tachado 2026-09-26: nace en **V4**, ver el recuadro de
arriba)

### 2.4 Por qué el excedente va con publicación y no con entitlements

El reconciliador se define en el `15` §4, pero **lo que hace es despublicar**, y su criterio —cae
lo más reciente primero— sólo se puede verificar con fichas de verdad. Construirlo en V3 sería
escribirlo sin poder probarlo.

### 2.5 `G-R6-B` va con V6 y no con V9, y las dos candidatas eran razonables

`G-R6-B` (`20` §2) falla si **algo toca `listing.inactiva_desde` desde un lugar que las listas
cerradas no nombran, o si un lugar que ellas nombran dejó de tocarla**: una **escritura** que no sea
uno de los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos del `01` §1.2 (núcleo) ni la escritura `C` del corte, una
**lectura** que no figure entre los ~~cinco~~ seis consumidores del `02` §2.5 (cuarta enmienda de
`DEC-TEST-001`; recontados en la FASE 8 completa, `F-8CD1-009`), o **uno de esos ~~cinco~~ seis que
ya no lee**, **o uno de los que deciden archivar, borrar o avisar que no consulta
`retenciónDetenida`** (revisión del owner, casos vecinos, 2026-09-29, caso 16). Las dos unidades que lo podían reclamar son **V6**, que crea la columna
(`02` §2.5) y **escribe** en ella —`PB1`, `PB3` y `PB7` son el tercer hecho, **la primera rama de
`PB2` es ~~el quinto~~ uno de los ~~dos~~ tres ejecutores del quinto** —~~el otro es~~ los otros son el recálculo que el aviso
despierta, sobre las fichas del dueño que no estaban publicadas, **y el reconciliador diario de
cobertura, cuando el aviso se perdió** (`DEC-ARCH-009`)— (FASE 8 completa, `F-8CA2-001`,
owner 2026-09-25), la relectura de
`PB4`/`PB5` es uno de los ~~tres~~ cuatro momentos del segundo (`02` §4.2 regla 4), **`PB11` es el
ejecutor único del sexto** (owner 2026-09-25; FASE 9 completa, 5b) **y la escritura `C` del corte
nace con la columna** (§2.10)—, y **V9**, que es la dueña
del `01` §1.2 y del reloj que la **lee**.

**Va con V6 por la regla 1 leída entera**: el guard protege **las piezas que tocan la columna**, no
las listas como texto, y **V6 es la unidad donde nacen las primeras** — la columna, sus escrituras
y los dos lectores que archivan. Y por el argumento del §2.1 leído sobre el orden real: **V9
depende de V4 y V6** (§3), así que un guard que llegue con V9 llega **después de todos los
escritores que existen**, que es la definición de *«un guard que se escribe contra código ya
escrito»*. Puesto en V6, lo que puede aparecer después es **una pieza nueva** — que es exactamente
lo que viene a rechazar.

**Y la mitad de lectores refuerza la elección en vez de moverla, aunque sus consumidores nazcan
tarde.** De los ~~cinco~~ seis, `PB4` y `PB5` son de V6; el día 180 y los dos avisos previos son de **V9**;
la fecha que se le imprime al cliente es de **V8**. Un guard que naciera con el último de ellos
llegaría cuando los ~~cinco~~ seis ya existen y **nacería con lista de excepciones**; naciendo en V6 ve
llegar a los ~~tres~~ cuatro de afuera **uno por uno**, y cada uno tiene que traer su fila al `02` §2.5 para
pasar. Es el caso de libro del §2.1, con lectores en vez de escritores.

**Lo que V9 conserva es su parte**: la lista del `01` §1.2 es su capítulo y el guard la cita; si
alguien agrega un ~~quinto~~ séptimo hecho, **el cambio es de V9 y el rojo lo da el guard de V6**. *(El
sexto, «se levanta la moderación», ya lo probó: lo agregó la FASE 9 completa a la lista de V9 y
lo ejecuta `PB11`, de V6 — 5b.)* ~~Es la misma
forma de `G13`, que vigila el contrato de V4 y nace en `B4` (§2.3):~~ *(`G13` ya no sirve de
ejemplo: nace en `V4` desde el 2026-09-26, `G5-5`, §2.3.)* **Dónde se construye un guard y
qué documento define su lista son dos preguntas distintas.**

### 2.6 Los ocho guards de esta épica que no tenían unidad, y por qué cada uno cae donde cae

La columna de arriba dejaba **ocho** guards de `V/20` §2 sin ninguna unidad que los construya, y
`C2` lo venía reportando **tres vueltas seguidas** (`F-8dC2-003` → `F-8eC2-004`). La **quinta
enmienda de `DEC-TEST-001`** decide repartirlos ahora, con tres condiciones que gobiernan lo que
sigue: **la razón va medida y con cita**, **la unidad nace ANTES o CON lo que el guard vigila** —el
criterio del §2.5, que es el que `G-R5` violó— y **lo que no tiene unidad clara se declara sin
dueño**. Los ocho tienen unidad medida; lo que el §2.8 trataba aparte **no era una asignación
faltante y tampoco era una pregunta**: era un defecto del enunciado de `G-R6`, y quedó resuelto en
`B/20` §2.

| guard | unidad | qué construye esa unidad que hace que el guard pueda existir ahí |
|---|---|---|
| **`G-R3`** | **V2** | las **dos versiones no vendibles** que el guard vigila — son `plan_version`, y `02` §2.1 es capítulo de V2 |
| **`G-R2`** | **V3** | **la resolución**, que el propio `15` §2.6 declara *«el sujeto del guard»* |
| **`G-R2-B`** | **V3** | **el trinquete por vertical** del `GRANT`, que se compara adentro de esa misma resolución (`15` §2.5) |
| **`G-R4`** | **V4** | **la primera tabla de transiciones del programa**: la de trial, `03` §2 |
| **`G-R4-B`** | **V4** | esa misma tabla **y el contrato** cuyo §4 el guard hace cumplir |
| **`G-R6`** | **V4** | la misma primera tabla — mismo dominio que `G-R4` |
| **`G-R3-B`** | **V5** | **la clase** *«transición disparada por el reloj»*, que `17` §3.4 declara |
| **`G-R3-C`** | **V5** | **el paso 5** y la declaración que el guard lee, que `17` §3.5 pide con todas las letras |

**`G-R3` va con V2 porque su sujeto nace ahí y no antes.** El guard sale de `02` §2.1, que es
capítulo de V2, y lo que vigila son **las dos versiones no vendibles** —la de pre-trial y la de
piso—, que son `plan_version`: exactamente lo que V2 deja funcionando (*«`plan`, `plan_version` y
sus entitlements y limits, con `rank`, vigente y vendible»*). Antes de V2 no hay ninguna versión
que se pueda sembrar mal, así que el guard **nace con su sujeto y no contra él**. Y V2 es la
**segunda** unidad del §3, con lo cual todo lo que después lee esas versiones —la resolución de
V3, el paso 5 de V5, y la reactivación desde `ARCHIVED` *«que la versión de piso le autoriza»*
(§4, fila V5)— llega **uno por uno**. Importa que sea temprano por lo que el catálogo dice de este
guard: *«es el que más carga lleva … si alguien siembra una de esas dos versiones con una clave
comercial, toda la plataforma la recibe gratis, para siempre»* (`V/20` §2).

**`G-R2` va con V3 porque el capítulo que lo crea nombra su sujeto.** `15` §2.6 cierra diciendo
*«Se comprueba sobre la resolución y no sobre cada call site, porque `V/17` §1.3 ya obliga a que
los pasos se resuelvan en un solo lugar; **ese lugar es el sujeto del guard**»*. Ese lugar —el
pliegue del conjunto efectivo y sus cuatro estrategias— **lo construye V3** (`15` §1–3). Fuera de
V3 el guard no tiene dónde pararse: no es una propiedad de los call sites.

**`G-R2-B` va con V3 por el mismo capítulo, y su consumidor llega de la otra épica.** `15` §2.5
termina con *«Lo vigila `G-R2-B` (`V/20` §2)»*, y lo que vigila es el **trinquete por vertical** de
la fuente `GRANT` —*«toma la fuente `GRANT` de esa vertical … y ninguna otra»*—, que se compara
*«al final»* dentro de la resolución. La fuente `GRANT` la enchufa **B9** de la otra épica, que en
`B/descomposicion.md` §3 está después de `B7 → B8`: naciendo en V3 el guard **ve llegar al grant**
en vez de heredarlo escrito.

**`G-R4` va con V4 porque V4 construye la primera de las ~~nueve~~ diez máquinas.** El guard vigila *«las
~~nueve~~ diez máquinas, en las dos épicas»* (la décima, el reembolso de `B/03` §6.1: owner 2026-09-25,
FASE 9 completa, 5a), y esta épica tiene tres: trial (`03` §2, **V4**), publicación
(`03` §9, V6) y postulación de Partner (`03` §11, V7). La más temprana del §3 es la de V4, y las
~~**seis de billing**~~ **siete de billing** no compiten por ser primeras: `DEC-ARCH-005` parte el programa en dos épicas
donde verticales *«arranca»* y billing *«espera»*, ~~y `B/descomposicion.md` §2.3 mide que hoy «lo
único que arranca es B2 y la interfaz de B1»~~ **y en `B/descomposicion.md` §3 las primeras
unidades de billing son B1 y B2** (esa medición del §2.3 quedó tachada el 2026-09-25: la pasarela
está decidida y nada espera ya), ninguna de las dos con tabla de transiciones. Y el
par que el guard cuenta nace ahí mismo: de los ~~**cuatro**~~ ~~**tres**~~ **cuatro** pares con dos destinos que el diseño
declara hoy, `T1`/`T6` es de esta máquina, **`PB11`/`PB13` de la de publicación** (V6; revisión del owner, 2026-09-28, C10) y los otros ~~tres~~ dos —`S5`/`S19` y `S7`/`S19` ~~, `S10`/`S25`~~ (revisión del owner, 2026-09-28, C8)—
son de la tabla de suscripción, que construyen B7 y B8 (`B/20` §2). Naciendo en V4 el guard ve
llegar ~~**ocho tablas una por una**~~ **las otras nueve máquinas una por una** —en siete tablas más, porque
billing declara sus siete máquinas en cinco tablas (`B/20` §2); el «ocho» contaba máquinas y no
tablas, salida 3 de la FASE 9 completa—; naciendo en cualquier otro lado nace contra tablas ya escritas.

**`G-R4-B` va con V4 porque el defecto que lo motivó es de la propia máquina de V4.** El guard
falla si una máquina **de esta épica** nombra un estado de la suscripción, y sale del §4 del
contrato — que **lo trae V4** (su fila del §2 lo lista entre sus capítulos). El caso es `T6`:
estaba escrita sobre *«una suscripción viva»*, *«un predicado que el §4 del contrato le prohíbe
evaluar al lado que tiene que evaluarlo»* (`V/20` §2). Las otras dos máquinas de la épica son de V6
y V7, las dos posteriores a V4 en el §3.

**`G-R6` va con V4 por el mismo orden, y hay una razón propia por la que ahí es seguro.** Su
dominio es el mismo de `G-R4` —*«las ~~nueve~~ diez máquinas, en las dos épicas»*— así que la primera tabla
del programa es el lugar que la regla 1 pide. Lo propio es esto: su predicado es **global**
(*«exige que al menos una transición **del corpus** las escriba»*), y un predicado global evaluado
sobre un corpus a medio construir puede dar **rojos falsos**. Con las máquinas de esta épica no
puede: el §4 del contrato le prohíbe a una máquina de verticales leer del otro lado —que es
justamente lo que `G-R4-B` hace cumplir—, así que **ninguna condición de V4, V6 o V7 lee una
columna que sólo escriba billing**. Eso vuelve a la primera tabla un lugar seguro para nacer, y no
sólo el más temprano. Lo que el predicado global abría del lado de billing está en el §2.8, y
**quedó cerrado**: el corpus que el guard recorre son las tablas declaradas, no las construidas
(`B/20` §2).

**`G-R3-B` va con V5 porque antes de V5 no hay nada que leer.** La **clase** que vigila —*«las
transiciones disparadas por el reloj»*, y que *«nunca otorga»*— la declara `17` §3.4, y `17 entero`
es de V5. El capítulo además insiste en que *«la clase se declara transición por transición, nunca
se infiere»*: **la declaración es el mecanismo, y el mecanismo lo construye V5**. El caso que el
capítulo usa, `T3`, es de la máquina de V4 y ya existe cuando V5 llega — y **no es una excepción
heredada**, porque lo que V5 construye es el acto de clasificar, y `T3` se clasifica al
construirlo. Los relojes que vienen después —`PB4` y `PB5` de V6, el de retención de V9, y los de
billing— llegan uno por uno.

**`G-R3-C` va con V5 porque el capítulo de V5 lo pide con todas las letras.** `17` §3.5 lo enumera
como su tercera parte —*«Un guard que lo hace cumplir: toda operación de dominio **declara** si
pasa por el paso 5, y el build falla si alguna no lo declara»*— y explica por qué no puede llegar
después: *«sin él, alguien agrega una operación dentro de ocho meses, no se pregunta nada, y nadie
se entera — la fábrica de exenciones por ruta»*. El paso 5 y los otros ~~ocho~~ seis son de V5, y la
enumeración que el guard vuelve completa *«se arma sola a medida que se construyen las
superficies»*, que son V8 y B13: las dos posteriores.

### 2.7 `G-R5` se va a `B8`, porque la celda de `V9` estaba en la épica equivocada

*(`G-R5` salió con la revisión del owner, 2026-09-28, C14: la pausa pedida por el dueño detiene el
reloj de retención y el guard se quedó sin sujeto. Esta sección queda como historia de su reparto;
`B8` ya no lo construye.)*

`F-8eC2-004` lo reportó y **se confirma recorriendo los dos grafos del §3**. La celda de `V9` decía
*«el de `D16`»* —o sea `G-R5`, nombrado por su invariante y no por su id— y el guard compara **dos
cifras de configuración**: el **tope de una pausa**, que declara `B/03` §5 (*«**4 pausas-mes** por
pausa»*), y el **día del hard delete**, que declara `V/02` §4.1. De las dos, la que `V9` construye
es la segunda: sus capítulos son `02` §4, `22` §3 y `01` §1.2 (núcleo), y **`B/03` §5 no está entre
ellos**. El catálogo de billing ya lo había advertido por escrito, doce líneas antes de que la
celda se escribiera: *«Figura acá porque **el número que puede romperlo es de esta épica**: si
alguien sube el tope de pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace sin
verlo»* (`B/20` §2).

**Y el orden no lo deja mal ubicado: lo deja inejecutable.** `V9` corre *«una vez que estén V4 y
V6»* (§3), temprano y sin esperar a billing; el tope lo construye **B8**, que en
`B/descomposicion.md` §3 está después de la bisagra —`B1 → B3 → B5 → B7 → B8`— y después de todo
lo que espera a la pasarela. El guard se construiría **antes que el número que compara**, y ahí no
llega tarde: llega tan temprano que **no tiene contra qué fallar**, que es *«un comentario con exit
code 0»* — la regla 1 de esta descomposición leída al revés.

**Va a `B8`, que es la unidad que construye el tope**, y la razón entera, del lado que lo
construye, está en `B/descomposicion.md` §2.8. Es la misma forma ~~de `G13` (§2.3) y~~ de `G-R6-B`
(§2.5) con el eje cambiado (`G13` dejó de serlo: nace en `V4`, owner 2026-09-26, `G5-5`): **dónde se construye un guard y qué documento declara sus números son
dos preguntas distintas.** `V9` conserva lo suyo — el día 180 es de su capítulo y el guard lo cita;
si alguien mueve ese número, **el cambio es de `V9` y el rojo lo da el guard de `B8`**.

### 2.8 El predicado global de `G-R6`, y por qué el reparto no lo tocaba

**`G-R6` tiene un predicado global y el corpus se construye por partes.** El guard exige que *«al
menos una transición **del corpus** escriba»* cada columna que una condición lee, y el corpus son
~~nueve~~ diez máquinas repartidas en dos épicas que se construyen a lo largo de todo el programa. Del lado
de verticales eso es inofensivo (§2.6), pero del lado de billing **una condición puede leer una
columna cuyo escritor llega en una unidad posterior** — el caso medido está en el propio catálogo:
la fecha del próximo cobro tiene **tres** escrituras (`B/03` §7.2) y una de ellas es `S10`, que es
de B8, mientras la condición que la lee es de B5. Entre B5 y B8 el guard daría **rojo sobre el
camino normal**, que es lo que la fila de `G-R1-A` describe como *«un guard que alguien va a
relajar»*.

**Esto quedó escrito como pregunta para el owner y no lo era: era un defecto del ENUNCIADO**, y la
diferencia importa porque una pregunta espera y un enunciado ambiguo se resuelve solo, en el peor
sentido — el primero que se choque con ese rojo lo relaja, y lo que se pierde es la vigilancia de la
clase que costó `F-8eB1-002`, **un crítico de dinero**. **Resuelto en `B/20` §2, donde el guard se
define**: *«el corpus»* son **las tablas que los capítulos declaran**, no el subconjunto ya
construido. `S10` tiene fila en `B/03` §7.2 desde antes de que nadie escriba una línea de `B8`, así
que entre `B5` y `B8` el guard está **verde**, y el defecto que lo motivó —una columna que **ningún
lugar del diseño** escribe— lo sigue atrapando entero. Lo que a cambio **no** verifica, y está dicho
allá, es que el escritor declarado esté implementado — **que desde `DEC-TEST-002` lo exige el
criterio de terminación de su unidad y no un guard** (§4, y el desarrollo en `B/descomposicion` §4).

**Y ninguna de las dos salidas que este § proponía se toma.** *«Que el guard evalúe sobre las
máquinas existentes en cada momento»* es exactamente la lectura que produce el rojo, y *«que su rojo
sea informativo hasta que las nueve estén»* compra meses en los que nadie lo mira. **La asignación a
V4 no se mueve**: era independiente de la salida elegida, y lo sigue siendo.

### 2.9 La dirección inversa del contrato la construye V2, y hasta esta pasada no la construía nadie

**El contrato tiene dos direcciones y sólo una tenía constructor.** Lo que billing **empuja** a
verticales lo construye `B4` del otro lado y lo recibe `V4`; lo que billing **LEE** de verticales
—las tres consultas del [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§4.1— **no figuraba en la columna de capítulos de ninguna de las 22 unidades del programa**, medido
con `rg -c "direcciónDeCambio|situaciónDeVertical|políticaDePlan"` sobre el corpus: **cero en los
dos `spec.md`, cero en las dos `descomposicion.md`, cero en los 24 capítulos y cero en el núcleo**.
Y la pieza sin constructor no era una menor: el propio contrato la llama *«la única regla que decide
**qué se le cobra a alguien y qué día**»*.

**Va con V2 porque las tres consultas leen las tablas que V2 construye, y ninguna otra.** Recorrido
campo por campo:

| consulta | qué lee | de qué unidad es esa tabla |
|---|---|---|
| `políticaDePlan` → `díasDeGrace`, ~~`díasDeTrial`,~~ `permitePausa`, `vigente`, `vendible` | columnas de `plan_version` | `02` §2.1 — **V2** |
| ~~`situaciónDeVertical` → `admiteAltas`~~ | **sale** (revisión del owner, 2026-09-28, C8): la consulta y su columna eran de la discontinuación | — |
| `direcciónDeCambio(origen, destino)` → `SUBE \| BAJA` | `plan_version_entitlement` y `plan_version_limit` de **las dos** versiones | `02` §2.1 — **V2** |
| ✚ `políticaDeAddon(versiónDeAddon)` → `addon`, `vigencia`, `díasDeVigencia`, `tipoDeScope` | columnas de `addon_version` | `02` §2.1 — **V2** (owner 2026-09-26, `G4-2`) |

*(`díasDeTrial` salió de la firma el 2026-09-26: ningún capítulo de billing lo leía, y la máquina
de trial lo lee de su propia tabla —FASE 9 vuelta 1, `F-8V1C1-015`—. Las otras entradas del
contrato §4.1 no son de V2: `fichaPurgada` y `ficha` las construye V6, porque leen la ficha, y
`extenderTrial` V4, dueña de la máquina de trial —`G2-1`, `G4-2`—. ~~**Y `finDeServicio` no es de
esta épica**: la contesta billing (`B12`), y V4 construye su respuesta de arranque, `NINGUNA`,
con el resto de la implementación de arranque —owner 2026-09-27, FASE 9 vuelta 2, `R5`—.~~
`finDeServicio` salió con la revisión del owner, 2026-09-28, C8.)*

~~**Los siete campos son de `02` §2.1, que es capítulo de V2**~~ **Los campos de estas ~~cuatro~~ tres
consultas son de `02` §2.1, que es capítulo de V2** (FASE 9 vuelta 1: sin cifra, como la regla
del contrato §4.2), así que ésta es la unidad más
temprana en la que ~~las tres consultas~~ ~~**las cuatro**~~ **las tres** (revisión del owner, 2026-09-28, C8) se pueden escribir — y la regla 1 del §1.1, leída sobre una
pieza en vez de sobre un guard, pide exactamente eso: **nace con su sujeto y no contra él**.

**Y la tercera no es una excepción aunque su REGLA esté escrita del otro lado.** ~~*«La dirección se
deriva del delta entre las dos versiones, no del `rank` … cualquier baja manda»* vive hoy en
`B/10` §3.5,~~ **El criterio vive hoy en `B/10` §3.5 —*«Verticales lo computa por el delta entre las
dos versiones —no por el `rank`—»* y *«Cualquier baja manda»*—**, que desde la FASE 8 completa
abre diciendo que **la dirección no la deriva billing: la decide el veredicto de verticales**
(`F-8CD1-003`, `F-8CC1-013`). *(Esta cita reproducía como vigente la frase que `B/10` §3.5 ya
tachaba, «La dirección se deriva del delta…»; la corrige la salida 3 de la FASE 9 completa, `C10`
del informe `01`. El criterio y la conclusión no cambian.)* Ese §, que es capítulo de **B12, la última unidad del camino crítico de billing**, mientras
**su consumidor es `B8`, cinco unidades antes**. Eso no la vuelve de B12: el contrato ya decidió de
quién es el acto —*«La comparación la hace verticales, que es dueño de las tablas, y billing recibe
un **VEREDICTO**»*—, y **quién ejecuta una comparación y dónde está escrito su criterio son dos
preguntas distintas**, que es la misma forma que el §2.5 usa para `G-R6-B` y el §2.7 para `G-R5`.
Lo que V2 construye es **la consulta y su respuesta**; `B/10` §3.5 queda como el § que declara el
criterio y `B12` como su lector tardío.

**Lo que esto evita, y está escrito en el propio contrato:** sin la consulta, lo único que `B8`
tiene a mano al cambiar de plan es el `rank`, y el diseño ya midió el desenlace de derivar la
dirección de ahí — *«un plan más caro puede bajar un límite al rediseñarse, y entonces al cliente
**se le recorta algo en silencio mientras se le cobra como mejora**»*. Con el camino de upgrade
tomado por error, además, **el excedente cae sin el aviso previo** que el de downgrade obliga.

**Y no mueve ninguna asignación de guard.** Ninguno de los 29 *(hoy ~~30, con `G-R5-B`; FASE 8 completa~~ 31: `G-R5-B`, FASE 8 completa, y `G-R2-C`, FASE 9 completa)* tiene por sujeto el contrato de
frontera (§4.2 del contrato, dicho allá) *(desde la revisión del owner, 2026-09-28, N6, `G14` vigila los imports entre las dos mitades, y no las lecturas de esta fila)*, así que esta fila agrega **capítulos a una unidad**, no un
dueño de guard. Es un reparto de trabajo, que es lo que este documento hace.

### 2.10 Lo que la FASE 9 completa agregó al diseño, y qué unidad lo construye

Salida 3 de `DEC-METH-004` (2026-09-25). Las decisiones del owner del día
(`HOS-1352/docs/26-fase-9-completa/10`) y las reglas del 25/09 que resolvió el consolidado de la
FASE 8 completa (`25-fase-8-completa/00` §5) se recorrieron contra la tabla del §2, **una por una**,
preguntando *«¿qué unidad la construye?»*. Todas las de esta épica tienen unidad, y la tabla del §2
las nombra en su fila; lo que sigue es el censo, para que la próxima pasada lo pueda recontar sin
releer las filas.

| regla nueva | de dónde | unidad | por qué ahí |
|---|---|---|---|
| `T6` exige un título que convierte; `T8` consume la fila al primer pago | 6c | **V4** | es la tabla del `03` §2 |
| el botón de suscribirse manda a publicar a quien no publicó **—con `cubierto` falso ~~, si la vertical admite altas~~ y si publicar le arrancaría el trial; si no, al checkout ~~o al aviso de que no admite altas~~ (revisión del owner, 2026-09-28, C8) (la regla única de `19` §4 fila 23; el último espejo sin la condición, FASE 9 vuelta 1, §4 punto 1 de `24-verificado-G4`)—** | 6c | **V8** | fila 23 del `19` §4; su espejo es `B13` |
| la invalidación del caché es por `user` | 8a | **V3** | `02` §3.2, regla 3 |
| ~~el fin de servicio invalida la vertical entera~~ | 6b | **sale** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan | — |
| ~~el día del fin de servicio lo ejecuta verticales: `PB2`, el hecho 4 en cada ficha de la vertical y la invalidación, leyendo la fecha por `finDeServicio`~~ | ~~`R5` (owner 2026-09-27, FASE 9 vuelta 2)~~ | **sale** (revisión del owner, 2026-09-28, C8) | — |
| la firma gana `piso` y el trinquete del grant lo lee de ahí | 9h | **V4** *(la firma)* · **V3** *(el trinquete)* | contrato §2; `15` §2.5 |
| la vertical se lee del recurso y es inmutable; la mitad *(c)* de `G2` | 7a | **V5** *(el paso y el guard)* · **V6** *(la columna, `02` §2.5)* | `17` §1.2 precisión 6 |
| el paso 2 sin «inhabilitado por abuso» | 8b | **V5** | `17` §1.1 |
| lo ajeno existe sólo en estado público | 8c | **V5** | `17` §1.2 precisión 7 |
| las lecturas de lo propio no consultan el paso 6 | 8d | **V5** | `17` §3.5 |
| `MODERATED` y el borrado del dueño: `PB10`, `PB11`, `PB12` | `F-8CA2-004` | **V6** | `03` §9; `PB9` sigue en **V9** |
| el empuje *«la ficha llegó a `PURGED`»* y la consulta `fichaPurgada` | `G2-1` (owner 2026-09-26) | **V6** *(la consulta, y el empuje de `PB12`)* · **V9** *(el empuje de `PB9`)* | `12-contrato…` §3.1 y §4.1; `03` §9 |
| en `PURGED` el calendario se desconecta: su token se revoca en el proveedor y se borra | `G1-5` (owner 2026-09-26; la unidad, OK del owner, J) | **V9** *(en `PB9`)* · **V6** *(en `PB12`)* | cada una es dueña de su transición (`03` §9) |
| la acción administrativa 15, *«editar el contenido de una ficha ajena»* | `G5-2`, `DEC-AUTH-003` (owner 2026-09-26; la unidad, OK del owner, L) | **V8** | `NUCLEO/08` §3; su aviso es la ~~fila 1~~ fila 26 del `19` (FASE 9 vuelta 2, `F-8V2D1-002`), y V8 corre después de V6, dueña de la ficha |
| levantar la moderación reinicia el reloj: el sexto hecho | 5b | **V6** *(ejecuta `PB11`)* · **V9** *(la lista del `01` §1.2)* | la forma del quinto (§2.5) |
| el lock por `user + vertical` en toda transición que ocupa cupo | `R14` | **V6** | `03` §9 |
| el reconciliador diario de cobertura, con la población de Partner | `DEC-ARCH-009`, `R13`, 7b | **V6** | `03` §9; comparar claves no necesita a V7 |
| la clave *«presencia en el carrusel»* | 7b | **V7** *(la lectura)* · V1 *(la clave, que es catálogo)* | `18` §1.6 |
| el bit de moderación de la presencia | 7c | **V7** | `18` §1.6; la acción que lo escribe, abajo |
| el registro de los actos del dueño sin el texto de los campos de contenido | 8e | **V9** | es la defensa del día 180 |
| la escritura `C` del corte | `F-8CA3-002` | **V6** | abajo |
| el partner sin presencia responde 404, no 410 | `F-8CA1-014` | **V7** | `21` §4 |
| el corte no siembra trials consumidos | 2g | **ninguna** | no hay nada que construir: es una escritura que dejó de existir (`21` §2.4). *(Sigue verdadero para los consumidos; el corte sí siembra uno activo desde revisión del owner, 2026-09-28, C12: §2.11.)* |
| ✚ la precisión 7 sólo para lo que no escribe; la precisión 8, el sujeto leído de la sesión o del recurso; un permiso de inspección por entidad del §48 | `F-8V2A1-001`, `F-8V2A1-002` (FASE 9 vuelta 2) | **V5** | `17` §1.2 y §3.2 regla 1 |
| ✚ la acción 15 evaluada sobre el dueño, y su aviso en la fila 26 del `19` y en `NUCLEO/07` §6 | `F-8V2A1-004`, `F-8V2D1-002` (FASE 9 vuelta 2) | **V5** *(la clase)* · **V8** *(la acción y el aviso)* | `17` §3.2 regla 3 |
| ✚ el reclamo de Partner con sesión y a la cuenta que reclama; el correo nunca verificado que no se cambia con un vínculo; la guarda de `PP1` como restricción de la base; la espera anulable | `R7` (owner 2026-09-27, FASE 9 vuelta 2) | **V7** · **V5** *(la excepción del paso 2)* | `18` §2.2 y §2.4, `02` §2.7, `03` §11 |
| ✚ la lista cerrada de lo que cuelga de `listing` en `PURGED`: la alerta de precio cerrada con aviso, la conversación en sólo lectura con su referencia anulable, lo del dueño que sólo sirve a la ficha borrado | `R9` (owner 2026-09-27, FASE 9 vuelta 2) | **V9** *(en `PB9`)* · **V6** *(en `PB12`, y la referencia anulable)* · **V8** *(las filas 27 y 28 del `19` y los correos)* | `02` §4.1, `19` §4 |
| ✚ `G-R9`: el guard de la lista cerrada de `PURGED`, que recorre el esquema (FK a las tres tablas de `listing` y `entity_type`) y falla si una tabla no tiene fila en `02` §4.1; y `posts` entra en esa lista | `V2-k`, `N-B-02` (FASE 9 vuelta 2, verificación, owner 2026-09-27) | **V6** *(el guard)* · **V9** *(la lista, que es de su capítulo)* | `20` §2, `02` §4.1; va con V6 por el argumento del §2.5: `PB12` aplica la lista antes que `PB9`, y un guard que llegara con V9 llegaría después de su primer consumidor |
| ✚ `listing` son las filas de las tres tablas actuales; el corte se detiene si Gastronomía o Experiencia no dan cero | `F-8V2A3-003` (FASE 9 vuelta 2) | **V6** | `02` §2.5, `21` §2.4 |
| ✚ el paso 4c del corte: revalidar las páginas públicas de las fichas que nacieron despublicadas *(desde revisión del owner, 2026-09-28, C12, sólo las que nacen fuera del sitio y el sistema viejo servía, si alguna: la ficha a la vista nace `PUBLISHED`; se mide en el paso 0 y, si da cero, el paso se saltea, revisión del owner, casos vecinos, 2026-09-29, caso 5)*, **y los listados que muestran su tarjeta por la etiqueta de colección de cada tipo**, **y la página de cada destino, una purga por destino (22)** | `F-8V2C2-006` (FASE 9 vuelta 2); `N-C-07` y `V2-t` (FASE 9 vuelta 2, verificación) | **V6** | `16-fase-7…` §4.2, `21` §2.4 |
| ✚ ~~la vuelta por `PB3`/`PB7` bajo un título que paga cuenta para la guarda de `T8`;~~ el lock de la máquina de trial es el de publicación y lo toman las ~~ocho~~ siete (salen la vuelta, por revisión del owner, 2026-09-28, C12, `L1-b`, y `T7`, por revisión del owner, 2026-09-28, N7) | `R15` (owner 2026-09-27, FASE 9 vuelta 2) | **V4** *(la guarda y el lock, que construye la primera que llega, V4, y V6 reusa)* · ~~**V6** *(el registro de `PB3`/`PB7` dice si una `SUSCRIPCIÓN` cubría, y con la `SUSCRIPCIÓN` ya cobrada evalúan `T8` dentro del lock: FASE 9 vuelta 2, verificación, `N-B-01`)*~~ | `03` §2 |
| ✚ `T4` exige la fecha de fin sin pasar; `T3` no escribe el reloj | `F-8V2A2-003`, `F-8V2A2-007` (FASE 9 vuelta 2) | **V4** | `03` §2 |
| ✚ `PB8` y `PB9` toman el lock y releen su `desde` adentro; **y `PB10` también, porque comparte `desde` con `PB3` y `PB9`**; **y `PB4`, `PB6` y `PB12`, por la misma razón: la excepción de las que sólo liberan cupo queda vacía**; **y `PB5`, que sale de `DRAFT` como `PB1`** | `F-8V2A2-004` (FASE 9 vuelta 2); `PB10`, caso vecino de `14-` (FASE 9 vuelta 2, verificación); `V2-u` (owner 2026-09-28); `V2-z2` (owner 2026-09-28) | **V6** *(~~`PB4`, `PB6`, `PB8`, `PB10` y `PB12`~~ `PB4`, `PB5`, `PB6`, `PB8`, `PB10` y `PB12`)* · **V9** *(`PB9`)* | `03` §9 |
| ✚ el seudónimo: SHA-256 sin clave sobre la normalización de `DEC-TRIAL-004`, que no cambia nunca; ~~**los puntos y el `+alias` se sacan sólo en la lista cerrada de proveedores que los ignoran, y cambiar la lista no recalcula filas viejas**~~ **qué se quita lo dice, proveedor por proveedor, la lista cerrada de `02` §2.2 (los puntos sólo en Gmail y, si la medición lo confirma, en Proton; el `+alias` en Gmail, Microsoft, Proton, iCloud y todo dominio que la lista no nombra), y cambiar la lista no recalcula filas viejas** | `F-8V2A3-004` (FASE 9 vuelta 2); `R23` (owner 2026-09-27); `V2-j1` a `V2-j3` (FASE 9 vuelta 2, verificación, owner 2026-09-28) | **V9** | `02` §2.2 |
| ~~la mitad de verticales del acto de discontinuar: escribe `admite_altas = no`~~ | ~~`Q-ALTAS`, `Q-ALTAS-b`~~ | **sale** (revisión del owner, 2026-09-28, C8) | — |
| ~~la acción administrativa 16, *«discontinuar una vertical»* o acortar su cola~~ | ~~`Q-ACC16`; `V2-g`, `V2-h`~~ | **sale** (revisión del owner, 2026-09-28, C8) | — |
| ✚ `T1` exige una versión de plan vigente y vendible; la pantalla de la vertical sin planes disponibles | `R24`, `F-8V2A3-005` (owner 2026-09-27, FASE 9 vuelta 2) | **V4** *(la guarda)* · **V8** *(la fila 29 del `19` §4)* | `03` §2, `19` §4 |
| ✚ el recuento de Gastronomía y Experiencia también antes del 1a | `R9-b` (owner 2026-09-27, FASE 9 vuelta 2) | **V6** | `21` §2.4, `16-fase-7…` §4.2 |
| `G-R2-C` | 4e | **ninguna de esta épica: `B10`** | abajo |

**Lo que no está en la tabla, porque no es de esta épica**: `S32`–`S35`, `RF1`–`RF5` y la acción
administrativa 14 (5a), la sucesora en grace (3c), los addons que siguen a su título (4a, 4c, 4d),
el canje bajo el piso (4b) y la rama del barrido de 9a. Ninguna pregunta qué puede hacer una
cuenta; todas mueven o miran plata, y su unidad la pone `B/descomposicion.md`. ~~**Y 6a —`S1`
leyendo `admiteAltas`— no agrega nada acá**: la columna y la consulta ya las construye V2.~~ (6a
salió con la revisión del owner, 2026-09-28, C8.)

**La escritura `C` va con V6, y hasta esta pasada no tenía unidad.** `V/21` no figuraba en la
columna de capítulos de ninguna fila. La escritura pone `listing.inactiva_desde` en el instante del
corte a toda ficha que existe ese día, **en la migración estructural del corte y en ningún otro
lugar** (`21` §2.4, `NUCLEO/01` §1.2), y esa migración es la que crea la columna, que **es de V6**
(`02` §2.5). En otra unidad, la columna nacería no anulable sin el único valor que la regla le
permite a una ficha preexistente. Y `G-R6-B`, también de V6, ya la nombra en su mitad *(a)*: nace
con su sujeto.

**La acción de moderar tiene dos sujetos y no agrega una arista al §3.** `PB10`/`PB11` (la ficha,
**V6**) y el bit de la presencia (**V7**) los escribe **la misma** acción administrativa del
`NUCLEO/08` §3, y V6 y V7 corren en paralelo después de V5. **La construye la primera de las dos
que llegue, con su sujeto; la segunda le agrega el suyo.** Hacer esperar a V7 por V6 compraría una
dependencia por una fila de catálogo, y el orden del §3 sale de preguntas que se contestan, no de
quién escribe primero una acción. *(Reparto de esta pasada; se señala al orquestador.)*

**`G-R2-C` no va a V3 aunque su gemelo esté ahí, y la razón es la regla 2 del §1.1.** `B/20` §6 y
los registros de aplicación de la FASE 9 completa lo sugerían para V3 *«por capítulo, con
`G-R2-B`»*. Medido contra lo que cada uno necesita leer, **no son gemelos en eso**: `G-R2-B` compara
datos que **viajan en la fuente** —el plan de su `referencia` y su `piso`—, y por eso se evalúa
dentro de la resolución de V3 sin preguntar nada del otro lado. **`G-R2-C` compara la vertical de
la respuesta contra las verticales compatibles del producto, y ésas viven en `addon_product`**
(`B/02` §2.4), **una tabla de billing que ninguna fuente transporta**: en V3 el guard tendría que
leer billing —la filtración que la regla 2 manda mirar— o no tendría contra qué fallar, porque la
implementación de arranque no emite addons (contrato §5.1). Es el caso del §2.7 con otro guard:
**nacería antes que el dato que compara**. **Va a `B10`**, que construye `addon_product` y la
fuente `ADDON` (`B/descomposicion.md` §2, fila `B10`: `16` entero y `02` §2.4). `V/20` §2 conserva
la fila, igual que conserva la de `G-R5`. ~~**La asignación la escribe `B/descomposicion.md`, fuera
de este documento; hasta entonces `G-R2-C` sigue sin unidad** y `B/20` §6 sigue diciendo 1.
*(Propuesta de esta pasada, contra la sugerencia de los registros `15` y `17`; se señala al
orquestador.)*~~ **El owner decidió `B10` y no `V3`** (2026-09-25, FASE 9 completa, decisión 10c,
contra la sugerencia de los registros `15` y `17`): `B/descomposicion.md` §2, fila `B10`, ya
escribe la asignación, y `B/20` §6 pasa de decir 1 a decir 0.

### 2.11 Lo que la revisión del owner agregó, y qué unidad lo construye

(Revisión del owner, 2026-09-28, tanda 2 de la aplicación: C4, C7, C10, C12, C14, N6 y N7, sobre
`HOS-1352/docs/30-revision-del-owner/10-decisiones-del-owner.md`; **y la tanda 4: C3, N1, C9 y C11**,
las cinco últimas filas.) Recorrido contra la tabla del §2
preguntando *«¿qué unidad lo construye?»*, igual que el §2.10. **Lo que sale no necesita unidad**;
se nombra para que nadie lo construya.

| qué | de dónde | unidad | qué la demuestra |
|---|---|---|---|
| **el package del contrato**: las dos interfaces, sus validaciones, los simuladores de cada lado y los juegos de casos compartidos (contrato §7.1) | N6, `L1-d` | ~~**V1** *(lo crea)*~~ **`U1`** *(lo crea vacío)*, **V1** *(llena las cuatro primeras cosas)* y **B1** *(la interfaz del reloj)*, en paralelo (verificación corta, 2026-09-29, lote P-C); ~~cada entrada entra con la unidad que construye su implementación (contrato §4.1, *«quién construye»*)~~ **`V1` escribe las interfaces y los simuladores de todas las entradas, y cada unidad trae sólo su implementación** (contrato §7.1; FASE 9 vuelta 3, `F-8V3C1-005`) | el juego de la dirección inversa corre contra el simulador y contra la implementación de verticales, y una constante no lo pasa |
| **`G14`**: una mitad no importa a la otra | N6, `L1-d` | **V1** | un import de billing agregado en verticales lo pone en rojo, nombrando el archivo |
| **`desde` en la fuente** y **la ventana de la cuota mensual** por la fecha del ciclo (`15` §7, `02` §2.2 `cuota_ventana`) | C4, `L2-e`, `L2-f1`, `L2-f2`, `L2-f3` | **V4** *(`desde` en la de arranque)* · **V3** *(la ventana)* | el alta del 31 renueva el 30 de abril, el 28 o 29 de febrero y el 31 de marzo; un anual renueva la cuota cada mes; un cambio de plan a mitad de ventana no regala cuota ni la deja negativa; la prueba renueva desde el día en que arrancó; un complemento suma a la ventana del título y no abre otra; **con dos títulos vivos que dan cuota, ancla el que arrancó primero** (revisión del owner, casos vecinos, 2026-09-29, caso 10)**, y cuando ese título muere la ventana en curso sigue hasta su fin y la próxima arranca con el ancla del que queda** (verificación corta, 2026-09-29, lote N-I) |
| **`retenciónDetenida`**: la respuesta de arranque (`no`) y sus lectores, `PB4`, `PB5`, `PB9` y los avisos de retención | C14, `L1-c` | **V4** *(la de arranque)* · **V9** *(los lectores)* | con una pausa pedida por el dueño, una ficha con el reloj vencido no se archiva, no se borra y no recibe aviso; al reanudar, el reloj arranca de cero, **y también si la pausa termina en una baja** (revisión del owner, casos vecinos, 2026-09-29, caso 12), **sin escribir nada: con una pausa que terminó en una baja, la ficha no se archiva hasta que se cumple el plazo contado desde el fin de la pausa** (`retenciónDetenida` devuelve también ese instante, caso F-A)**; y el aviso previo al archivado apunta a esa misma fecha, no a la contada sobre el primer día de la pausa** (verificación corta, 2026-09-29, lote M-H) |
| **`puedeCobrarle`** ✚: la respuesta de arranque (`no`) y su lector, la precondición de la acción 24 | verificación corta, 2026-09-29, lotes M-F y M-G | **V4** *(la de arranque)* · **V8** *(el lector)*; la real es de **B4** | con la real, una cuenta con una suscripción `ACTIVE`, `PAUSED` o `SUSPENDED` no se da de baja, y con una `CANCEL_SCHEDULED` como único cobro sí, **y con una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta tampoco** (verificación corta, 2026-09-29, lote N-C); la 24 no lee ninguna tabla de billing |
| **`PB13`**, `PB11` con la guarda de origen, **`PB12` desde `MODERATED`**, y la marca **`pedido_de_arreglo`** | C10, `L2-i`, `g3` | **V6** | una ficha que estaba publicada y se modera vuelve publicada al levantar si hay cobertura y cupo, y a `UNPUBLISHED_BY_BILLING` si no; una que era borrador vuelve a borrador; pasar a sólo pedido de arreglo termina igual y deja el pedido abierto; el dueño puede editar y borrar una `MODERATED`, no publicarla; **borrar cualquier ficha por `PB12` encola el correo de confirmación, no sólo una moderada** (revisión del owner, casos vecinos, 2026-09-29, caso 15) |
| **el listado de arreglos pendientes** en el panel, el pedido en Mi Cuenta y los avisos de moderación (`V/19`, `NUCLEO/07` §6) | C10, `g3` | **V8** | el listado muestra antigüedad, fecha sugerida vencida y los que el dueño avisó |
| **la prueba activa que escribe el corte**, **`L5`/`L7` en borrador**, **`L8` publicada**, y los dos gates del corte (lista de proveedores medida, recuento de seudónimos compartidos) (`21` §2.4) | C12, `L1-a`, `L1-b` | **V6** *(la migración del corte, con la escritura `C`)* · **V4** *(la fila de `T1` que la migración reusa: la derivación del plan de trial; la función del seudónimo es la misma que `T1` usa, de la unidad que ya la tiene)* | sobre una base con `L1`-`L8`: un dueño con una `L8` amanece en `TRIAL_ACTIVE` con la ficha publicada; uno con sólo borradores no recibe prueba; repetir la migración no escribe dos; contratar durante esa prueba convierte por `T2`; dos cuentas con el mismo seudónimo en la vertical detienen el corte |
| **sale `R15`**: la vuelta bajo un título que paga para `T8`, la evaluación de `T8` dentro de `PB3`/`PB7` y el registro de `PB3`/`PB7` | C12, `L1-b` | **ninguna** | no hay nada que construir |
| **sale `T7`**, y el panel rechaza pasar los días de prueba de una vertical de 0 a más de 0 y al revés (`11` §8) | N7 | **ninguna** para `T7`; el rechazo del panel va con la unidad que construya la edición de los días de prueba: **`V2`**, que construye la acción *«publicar una versión de plan»* (revisión del owner, 2026-09-28, N1, tanda 4; los días de prueba cuelgan de la versión) | pasar Partner de 0 a 7 días desde el panel se rechaza |
| **salen `D16` y `G-R5`** | C14 | **ninguna** | no aplica |
| **la baja de cuenta, fuera de la épica** ([HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393)), **con su lista de pasos escrita antes del corte: la baja del cobro, `PB12` por cada ficha y la cuenta** (revisión del owner, casos vecinos, 2026-09-29, caso 7; `NUCLEO/08` §1.3); **las señales que sólo observan, no se guardan** ([HOS-1394](https://linear.app/hospeda-beta/issue/HOS-1394)) | N7, `g1`, `g2` | **ninguna** | no aplica |
| **los tres pasos de la baja de cuenta manual, desde el panel**: la acción 23, *«borrar una ficha ajena a pedido de su dueño»*, que corre `PB12`, y la 24, ~~*«borrar una cuenta a pedido de su dueño»*~~ *«dar de baja una cuenta a pedido de su dueño»* (caso I-C); el paso 1 es *«cancelar una suscripción»*, que ya existe (`NUCLEO/08` §1.3 y §3); **y la 25, *«vaciar la presencia de un Partner a pedido de su dueño»***, parte del paso 2 en un Partner (verificación corta, 2026-09-29, lote N-G) | revisión del owner, casos vecinos, 2026-09-29, caso F-C | **V8** *(las dos acciones y su panel, como la 15; confirmado por el owner, casos vecinos, caso H-D)*, sobre `PB12` de **V6**; **y la 25, sobre la presencia de V7** *(derivado, lote N-G)* | soporte borra la ficha de otra persona a su pedido y salen el correo de `PB12` y el empuje a billing; ~~borrar~~ dar de baja una cuenta ~~con una suscripción viva~~ **a la que `puedeCobrarle` le contesta `sí`** o con una ficha fuera de `PURGED` **o una presencia de Partner con contenido** (lote N-G) se rechaza, **y con una `CANCEL_SCHEDULED` como único cobro pasa** (verificación corta, 2026-09-29, lotes M-F y M-G); con actor igual a sujeto, el paso 3 la rechaza; ~~**y borrar una cuenta borra su fila y sus sesiones, seudonimiza lo personal y deja intactos el registro de auditoría y los cobros** (caso H-C; con el choque con la FK de `trial.user_id` abierto, `02` §2.4)~~ **y dar de baja una cuenta no borra su fila: reemplaza el nombre, el correo y el teléfono, cierra sus sesiones y la deja sin acceso; el registro de auditoría, los cobros y la fila de `trial` quedan intactos, y un alta nueva con el mismo correo no recibe otra prueba** (revisión del owner, casos vecinos, 2026-09-29, caso I-C, que corrige H-C; ~~`02` §2.4~~ `02` §2.2: FASE 9 vuelta 3, `F-8V3D1-007`)**; los datos de facturación de la cuenta, el nombre y el correo ~~de su cliente de billing~~ de quien pagó, se conservan tal cual, porque la ley obliga a guardar los comprobantes** (revisión del owner, casos vecinos, 2026-09-29, caso J-C; ~~con el ⚠️ de dónde viven,~~ ~~`02` §2.4~~ `02` §2.2)**: viven en la copia que cada comprobante guarda al emitirse, que la baja no toca** (revisión del owner, casos vecinos, 2026-09-29, caso K-A; `B/02` §2.3, de `B5`); **y con un Partner, la 25 deja su presencia sin fotos, logo, secciones ni enlaces, en la base y en el almacenamiento externo, y su página responde 404** (verificación corta, 2026-09-29, lote N-G) |
| **«entrar como» el cliente**, sólo su condición escrita | C7 | **ninguna** en esta versión | no aplica |
| **la limpieza del agrupamiento viejo de Gastronomía y Experiencia en el producto**: el rol de dueño de comercio, sus siete permisos, la tabla de contactos de alta y el tipo de partner, **con su migración de datos**; **y el `CLAUDE.md` raíz y los archivos de i18n que lo nombran** (revisión del owner, casos vecinos, 2026-09-29, caso 41; `21` §4); **y las specs de fuera del programa y `.qtm/` que lo nombran: la implementada se borra entera y la que sigue en curso se reescribe, según el estado de su issue en Linear el día de la limpieza** (revisión del owner, casos vecinos, 2026-09-29, caso I-D; `21` §4)**: se borran la de un issue `Done`, `In Review` o `Canceled`, la de un issue que ya no existe y todas las de `.qtm/`, y se reescriben sólo las de un issue en `In Progress` o `Backlog`** (revisión del owner, casos vecinos, 2026-09-29, caso J-B; `21` §4)**; y un estado que esa lista no nombra sigue el tipo que Linear le da: uno de tipo terminado, cancelado o duplicado (`Duplicate`) se borra, y uno de tipo en curso, sin empezar o backlog (`Todo`, `Working on`, `User Action Pending`, `On Hold`) se reescribe** (revisión del owner, casos vecinos, 2026-09-29, caso K-B; `21` §4); el tipo de partner, renombrado ~~con el nombre que defina el owner~~ a `business`, con la etiqueta «Comercio» en español sin cambios (revisión del owner, casos vecinos, 2026-09-29, caso 19; `21` §4) ; **y todo el código del sistema viejo que la nombra, con el cobro viejo entero, en la limpieza del principio** (verificación corta, 2026-09-29, lote N-A; `16-fase-7…` §4.6) | C3, `L2-c` (tanda 4); lote N-A | ~~**V1** *(dueña de `G8`)* ⚠️ *o una unidad propia que vaya antes de `V1` y de `B1`, si el owner la separa: `30-revision-del-owner/34-` §3, N-A-1*~~ **`U1`**, la unidad del paraguas, dueña de `G8`, que va antes de `V1` y de `B1` y hace ~~sólo~~ la limpieza y, al terminarla, crea vacío el package del contrato (lote P-C) (verificación corta, 2026-09-29, lote O-A; su fila, con su criterio, en `16-fase-7…` §4.6) | el rol, los permisos y la tabla ya no existen y sus filas vivas se movieron; ningún partner conserva el tipo viejo, y todos los que lo tenían quedan en `business`**, y ninguna otra columna que guarde un valor de `PartnerTypeEnum` (como `alliance_leads.partner_type`) conserva el valor viejo** (verificación corta, 2026-09-29, VC-VT-10); `G8` corre sin más exención que el PDR y, hasta el paso 6 del corte, la lista de pendientes **en sus dos historias, y hasta el cierre de HOS-1352, en las carpetas del programa** (caso H-A); **ningún archivo de otra spec ni de `.qtm/` la nombra** (caso I-D); ~~**y el trinquete nace con la lista que mide su script, y ningún archivo fuera de él la nombra** (verificación corta, 2026-09-29, lote M-E)~~ **y ningún archivo de código la nombra ni ningún `package.json` declara `@qazuor/qzpay`: `G8` y `G16` nacen verdes sobre todo el repo, y la rama compila** (verificación corta, 2026-09-29, lote N-A) |
| **la foto de la base y el reemplazo de la historia de migraciones y del ledger del seed**, el día del corte (`16-fase-7…` §4.2, paso 6) | C3, `L2-a` (tanda 4) | **V6** *(dueña de la migración estructural del corte)* | ensayado en `staging` con backup: después del reemplazo, correr las migraciones no aplica nada y la base es igual a la foto; el repositorio no tiene otra migración que la de partida |
| **la acción *«publicar una versión de plan»*** con sus validaciones (`G-R3` entre ellas, `NUCLEO/02` §1.4), y **la migración de datos única del catálogo** ~~del paso 3a del corte~~ **dentro de la migración estructural del paso 3, antes de la prueba del corte; el 3a sólo la verifica** (FASE 9 vuelta 3, owner 2026-09-30, lote C) | N1, `L1-e`, `L1-f` (tanda 4) | **V2** *(la operación, las validaciones y la migración del catálogo)* · **V8** *(el editor de planes y claves del panel)* | publicar una versión de piso con una clave comercial se rechaza con el mensaje de su mitad; publicar una segunda versión vigente de un plan se rechaza; la confirmación dice qué cambia clave por clave; la migración del catálogo, corrida dos veces, no escribe dos; ~~**y con uno de los cinco plazos sin valor escrito vacío, falla** (`NUCLEO/02` §1.5; revisión del owner, casos vecinos, 2026-09-29, caso 43)~~ (esa condición pasó a la migración que crea la versión 1 de los plazos, fila de abajo: verificación corta, 2026-09-29, lote N-H) |
| **los plazos de verticales**: su tabla versionada, la acción *«cambiar un plazo»* sobre sus claves y sus validaciones (`NUCLEO/02` §1.5), y **la versión guardada en cada reloj**: la ficha (`plazos_version` y `borrado_anunciado`, `02` §2.5), la fila de `trial` y la postulación de Partner | C9, C11, `L2-g`, `L2-h`, N7 (tanda 4) | **V9** *(la tabla, la acción y la ficha)* · **V6** *(`PB4`, `PB5` y `PB9` leyendo la versión y la fecha anunciada)* · **V4** *(la fila de `trial`)* · **V7** *(la postulación)* · **V8** *(su parte de la pantalla de plazos, que es una sola con la de billing, compuesta en la app del panel: caso 47)* | acortar el plazo de borrado de 180 a 120 no mueve la fecha anunciada de una ficha ya archivada, y una ficha cuyo reloj arranca después usa 120; un archivado que corrió tarde anuncia una fecha más tarde y `PB9` no borra antes; un plazo de archivado mayor que el de borrado se rechaza; **y la migración que crea la tabla escribe la versión 1 de los plazos de verticales con sus valores, así que la escritura `C` y la prueba del corte la encuentran, y con uno de los cinco sin valor escrito vacío falla** (verificación corta, 2026-09-29, lote N-H) |

### 2.12 Lo que la FASE 9 vuelta 3 agregó, y qué unidad lo construye

(FASE 9 vuelta 3, sobre `HOS-1352/docs/37-fase-8-vuelta-3/10-decisiones-del-owner.md` y la
escritura sin decisión de su consolidado.) Recorrido contra la tabla del §2 con la misma pregunta
que el §2.11: *«¿qué unidad lo construye?»*.

| qué | de dónde | unidad | qué la demuestra |
|---|---|---|---|
| **el reclamo que cierra las sesiones y las credenciales previas** de la cuenta que verifica, **el link de un solo uso** (el reclamo escribe `owner_user_id` sólo si está nulo) y **una cuenta, un Partner** (`UNIQUE(owner_user_id)` donde no es nulo) (`18` §2.4, reglas 2, 4 y 5; `02` §2.7) | lotes A y B, `F-8V3A1-001`, `F-8V3A1-002`, `F-8V3A2-002` | **V7** | la dueña de la casilla reclama sobre la cuenta de un ocupante con el correo sin verificar, y la sesión del ocupante deja de valer y su contraseña y su cuenta vinculada ya no entran; el mismo link abierto otra vez, desde otra cuenta, no cambia `owner_user_id` y la pantalla deriva a soporte; una cuenta que ya es dueña de un Partner reclama otro y se rechaza, y un segundo vínculo escrito directo en la base choca con la unicidad |
| **las dos pantallas que derivan a soporte**: el link de un Partner ya reclamado y el reclamo de un segundo Partner (`19` §4, filas 32 y 33) | lotes A y B | **V8** | abrir un link ya usado muestra la fila 32 y no dice a qué cuenta está vinculado; reclamar un segundo Partner muestra la fila 33 |
| **`PP1` como segunda excepción del guest en el paso 1**, con captcha y una postulación abierta por correo (`17` §1.2, precisión 9; `03` §11) | lotes I y M, `F-8V3A1-005` | **V5** *(la excepción en la cadena)* · **V7** *(el formulario con el captcha)* | un visitante sin cuenta postula con el captcha resuelto y queda una `PENDIENTE`; sin captcha se rechaza; cualquier otra escritura del guest falla en el paso 1; una segunda `PENDIENTE` del mismo correo la rechaza la base |
| **las conversaciones, las reseñas y los comentarios, de quien los escribe**, sobre una ficha que exista para él (`17` §1.2, precisión 7) | `F-8V3A1-003` | **V5** | un turista le escribe a una ficha publicada ajena y deja una reseña; sobre una ficha en borrador ajena contesta lo mismo que sobre un identificador que no existe; su conversación sobre una `PURGED` se lee entera y no admite mensajes |
| **«de `SUPER_ADMIN`» como permiso** (`17` §3.2 regla 1, ⚠️) | `F-8V3A1-006` | **V5**, cuando se decida cuál de las dos lecturas vale | pendiente de la pregunta abierta: con la primera, un override que le da a un `CLIENT_MANAGER` el permiso de fijar el precio de un ciclo se rechaza |
| **`PB13` en la misma cola ordenada que `PB3` y `PB7`** (`03` §9) | lote O, `F-8V3A2-003` | **V6** | cupo 2 con A y B publicadas; se modera A, el reconciliador sube C, se levanta A: A vuelve publicada y C vuelve a `UNPUBLISHED_BY_BILLING` por la rama del excedente de `PB2`, sin escribir el reloj |
| **`pedido_de_arreglo` en la lista cerrada de `PURGED`** (se cierra sin correo y se conserva), **`addon_instance` en lugar de las dos tablas del cobro viejo**, y **`PURGED` sin escribir `deleted_at`** (`02` §2.5 y §4.1) | R11 y R15, `F-8V3A2-004`, `F-8V3A3-007`, `F-8V3A3-004` | **V6** *(con `PB12`)* · **V9** *(con `PB9`)* | `PB12` sobre una ficha moderada con un pedido abierto lo cierra sin encolar correo y la fila queda; `G-R9` verde con la lista de 40; sobre una base con el carril de extras aplicado, después de `PB12` el favorito de un tercero sigue |
| **los dos borrados remotos después del commit**, con las filas marcadas pendientes y la corrida diaria que reintenta y reporta lo colgado (`02` §4.1) | R23, `F-8V3A2-005` | **V6** *(con `PB12`; `PB9` de **V9** lo usa)* | con el almacenamiento caído, `PB12` confirma, la fila de la foto queda marcada y la foto sigue en el almacenamiento; la corrida siguiente la borra en los dos lados; una pendiente que sobrevive a una corrida sale como error |
| **`canje_de_trial`**, la clave de canje de `extenderTrial` (`02` §2.2, `03` §2 `T4`) | R19, `F-8V3C1-003` | **V4** | `extenderTrial` dos veces con la misma clave corre `T4` una sola vez y contesta `ACEPTADA` las dos veces; un rechazo no deja fila |
| **una clave medida es siempre de vertical** (`15` §3.2, `02` §2.2) | R25, `F-8V3A3-005` | **V3** | el catálogo rechaza una clave medida con scope global |
| **las seis respuestas de arranque en el módulo que `G13` vigila** (`V/20` §2) | R5, `F-8V3C1-002`, `F-8V3D1-001` | **V4** | un build de producción que enlaza cualquiera de las seis falla, con un caso por cada una |
| **las tres columnas que sobreviven a `U1` hasta el corte** y **la migración que las borra después de la clasificación** (`21` §2.4) | lote N, `F-8V3A3-002` | **V6** *(dueña de la migración estructural del corte)* | sobre una base con una ficha `L7`, la clasificación la hace nacer `DRAFT` y no `PUBLISHED`; después de la migración posterior, las tres columnas ya no existen |
| **el catálogo antes de la prueba del corte, los dos en la migración estructural del paso 3** (`21` §2.4) | lote C, `F-8V3A2-001`, `F-8V3A3-001` | **V2** *(la carga del catálogo)* · **V6** *(el orden dentro de la migración)* | sobre una base sin catálogo, la migración lo carga y escribe cada prueba del corte con su plan de trial y su fin no nulos |
| **las interfaces, las validaciones y los simuladores de todas las entradas del package**, de ida y de la dirección inversa, y **la dependencia de `V4` sobre `B1`** por la interfaz del reloj (contrato §7.1) | R20, `F-8V3C1-005`, `F-8V3C1-006`, `F-8V3C1-008` | **V1** *(las interfaces y los simuladores)* · **V4** *(espera a `B1`)* | `B10` se prueba contra el simulador de `ficha` antes de que exista `V6`; el caso *«un trial vence de verdad»* de `V4` adelanta el reloj compartido y vence |
| **verticales no escribe `addon_product.version_id`**: crea la versión, y re-apuntarla es de billing (`02` §2.1) | R29, `F-8V3C1-007` | **V2** *(crea la versión)*; el acto que re-apunta es de **B10** (`B/descomposicion.md`) | ningún código de verticales escribe esa columna |

**Lo que no tiene unidad acá**: el seudónimo que la baja conserva hasta la pregunta 5 (lote H) no
se construye; si el abogado contesta en contra, la tarea puntual de soporte es de fuera de la
épica, como la baja de cuenta (§2.11).

---

## 3. El orden, y qué se puede hacer en paralelo

```text
U1 (del paraguas: la limpieza del principio, lote O-A)
 │
 ▼
V1 ──► V2 ──► V3 ──► V4 ──► V5 ──► V6 ──► V8
                                └──► V7 ──┘
                      └──────────────► V9
```

| | |
|---|---|
| **camino crítico** | ~~`V1 → V2 → V3 → V4 → V5 → V6 → V8`~~ `U1 → V1 → V2 → V3 → V4 → V5 → V6 → V8` (verificación corta, 2026-09-29, lote O-A) |
| **en paralelo** | **V7** una vez que esté V5 · **V9** una vez que estén V4 y V6 |
| **nada arranca antes que V1** | y V1 no depende de nada ~~, **salvo de la limpieza del principio si el owner la separa en una unidad propia** (`16-fase-7…` §4.6; ⚠️ `30-revision-del-owner/34-` §3, N-A-1; verificación corta, 2026-09-29, lote N-A); si la hace `V1`, es su primer cambio~~ **de esta épica: depende sólo de `U1`, la limpieza del principio, que es del paraguas** (`16-fase-7…` §4.6; verificación corta, 2026-09-29, lotes N-A y O-A). **No es una dependencia entre épicas**: `U1` no es de ninguna, y ~~las once de `B/descomposicion.md` §2.6 siguen siendo once~~ no le suma ninguna a las de `B/descomposicion.md` §2.6, **que son doce desde la FASE 9 vuelta 3 por otra razón: `V4` depende de `B1`, que escribe la interfaz del reloj** (contrato §7.1, punto 5; `16-fase-7…` §4.6; `F-8V3C1-006`). **`V1` y `B1` arrancan en paralelo, y cada una llena su parte del package del contrato que `U1` deja vacío** (verificación corta, 2026-09-29, lote P-C); **la espera de verticales sobre `B1` empieza en `V4`**, la primera unidad que lee la hora (FASE 9 vuelta 3, `F-8V3C1-006`) |

**Y mientras la app de la rama está rota**, desde la limpieza del principio hasta que `B4` integra la implementación real de billing, **verticales se construye y se prueba contra el simulador de billing del contrato** (`12-contrato…` §7.1; `16-fase-7…` §4.6; verificación corta, 2026-09-29, lote N-A).

**V5 es la bisagra**: hasta ahí se construyen capacidades, y de ahí en adelante se consumen. Es
también el punto donde el contrato deja de ser una definición y pasa a tener un consumidor real —
el paso 5.

---

## 4. Lo que cada unidad tiene que dejar demostrado

No es una lista de tests: es **qué pregunta tiene que poder contestar alguien de afuera** cuando
la unidad se declara terminada.

> **Y hay una condición que vale para las nueve y no está en la tabla, porque no depende de qué
> construye cada una**: **una unidad no está terminada mientras algún guard de su columna `guards`
> del §2 no esté escrito y no tenga su caso que lo hace fallar a propósito.** La regla 1 del §1.1
> dice **cuándo** va cada guard —*«con la pieza que protege, nunca al final»*— y hasta esta pasada
> **no había ningún lugar donde se comprobara que había ido**: la asignación vivía sólo en una
> columna que nadie consulta al declarar una unidad lista, así que las nueve se podían declarar
> terminadas, una por una, con **cero** guards escritos, y el tablero del §5 las marcaba verdes.
> **Los ~~29~~ ~~30~~ ~~31~~ ~~32~~ ~~35~~ 33 guards del programa están repartidos entre las ~~22~~ **23** unidades —~~16~~ ~~17~~ ~~**18**~~ ~~**19**~~ ~~**20**~~ ~~**18**~~ **17** en esta épica, ~~13~~ ~~**14**~~ ~~**13**~~ ~~**12**~~ **15** en la
> otra **y 1 en `U1`, la unidad del paraguas, que se lleva `G8` de `V1`** (verificación corta, 2026-09-29, lote O-A; `16-fase-7…` §4.6) (revisión del owner, 2026-09-28: entra `G14`, de `V1`, por N6; sale `G-R5`, de `B8`, por C14; el total no se mueve; **y entran `G15`, `G16` y `G17` en la otra, los tres de `B1`**, por C13, N2 y N4: 35; **y `G-R3`, de `V2`, y `G-R5-B`, de `V6`, pasan a ser validaciones del panel**, por N1 y C9: 33), contados sobre las dos columnas; `G13` pasó de `B4` a `V4`, owner 2026-09-26, `G5-5`— y ninguno aparecía en ninguno de los 22 criterios.** *(El
> trigésimo es `G-R5-B`, de V6: FASE 8 completa, `F-8CA2-014`, owner 2026-09-25. **El trigésimo
> primero, `G-R2-C`** —owner 2026-09-25, FASE 9 completa, 4e—, ~~todavía no está en ninguna de las
> dos columnas: esta pasada lo propone para `B10` (§2.10), y el 17 + 13 pasa a 17 + 14 cuando
> `B/descomposicion.md` lo escriba~~ **ya está en la columna de `B10`**, owner 2026-09-25,
> decisión 10c (`B/descomposicion.md` §2, fila `B10`). **El trigésimo segundo, `G-R9`**, el de la
> lista cerrada de `PURGED`, de V6: FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`;
> recontado sobre las dos columnas.)*
>
> **No se enumeran acá uno por uno a propósito**: duplicar la columna sería un segundo censo del
> mismo conjunto, que es la clase de defecto que el contrato §2.1 acaba de cerrar. **La columna es
> la lista; esto es lo que la vuelve una condición.**
>
> **Lo que esta condición NO exige, dicho para no afirmar de más**: que el guard esté
> *implementado* del lado del código que todavía no existe. Un guard cuyo caso de rojo se ejerce
> sobre **texto declarado** —`G-R4`, `G-R6` y `G-R6-B` recorren tablas de transiciones y listas
> cerradas de los capítulos, no el subconjunto ya construido (`B/20` §2)— se puede romper a
> propósito el día que nace, incluso cuando la fila que se le saca es de una unidad de la otra
> épica. Eso es lo que vuelve exigible esta condición en `V4`, que lleva tres guards cuyo dominio
> son **las ~~nueve~~ diez** máquinas (la décima, el reembolso: FASE 9 completa, 5a). **Y `G13`**, el
> cuarto de `V4` (owner 2026-09-26, `G5-5`), se rompe a propósito igual el día que nace: su caso de
> rojo es un build destinado a producción que enlaza la implementación de arranque.
>
> **Y hay una segunda condición de la misma forma, sobre los ESCRITORES** (`DEC-TEST-002`):
> **una unidad no está terminada mientras alguna escritura que sus capítulos le declaran a una de
> sus transiciones no esté implementada.** Vale para las nueve, es independiente de qué construye
> cada una, y sale de la columna de **capítulos** del §2 igual que ésta sale de la de `guards`. Es
> la contrapartida exacta de lo que el §2.8 acaba de resolver: `G-R6` lee *«el corpus»* como **las
> tablas que los capítulos declaran** —sin eso nace en rojo sobre el camino normal—, y el precio
> es que **un escritor declarado que nadie implementa pasa en verde**. **El desarrollo, con por qué
> es un criterio y no un guard, está en**
> [`B/descomposicion.md`](../HOS-1354-billing-cobro-y-proveedor/descomposicion.md) §4, que es donde
> vive el caso medido: la fecha del próximo cobro y `MP5`.

| # | la unidad está lista cuando… |
|---|---|
| **V1** | agregar una clave al código sin agregarla ~~a la base~~ al catálogo **falla**, y ~~al revés también~~ una clave que no está en el catálogo no se puede escribir en la base, que la rechaza por FK (revisión del owner, 2026-09-28, N1); y **el nombre del agrupamiento viejo de Gastronomía y Experiencia en cualquier archivo que no sea el PDR falla** (`G8`; C3), **salvo en las dos historias de la lista de pendientes hasta el paso 6 del corte; agregar una ~~tercera~~ cuarta entrada a la lista falla, y un build destinado a producción después del corte con ~~la lista no vacía~~ una de las dos historias en la lista falla** (revisión del owner, casos vecinos, 2026-09-29, caso 8), **regla que enciende el commit del paso 6, así que el build del paso 3 con la lista llena pasa** (caso F-B); **y salvo en las carpetas del programa en `.specs/`, la tercera entrada, hasta el commit del cierre de HOS-1352, que la saca y extiende la regla a la lista entera** (revisión del owner, casos vecinos, 2026-09-29, caso H-A), **y sólo en ellas: una spec de otro issue o un archivo de `.qtm/` que la nombre falla** (caso I-D); ~~**y salvo en los archivos del trinquete, la lista medida del código que la nombra el día que nace el guard: un archivo nuevo que la nombra falla, y uno de la lista que ya no la nombra o ya no existe falla hasta que sale de ella en el mismo cambio** (verificación corta, 2026-09-29, lote M-E)~~ (el trinquete salió: después de la limpieza del principio no queda código que la nombre; verificación corta, 2026-09-29, lote N-A); y nombrar una vertical sin implementar su ítem del Eje 2 **falla**. *(Las cláusulas de `G8` de este criterio son desde el lote O-A de `U1`, que construye el guard con la limpieza del principio; `V1` las hereda verdes y no las vuelve a probar: `16-fase-7…` §4.6, verificación corta, 2026-09-29.)* |
| **V2** | dos versiones vendibles y vigentes con el mismo `rank` en la misma vertical **son imposibles**, no un empate a desempatar; y **`direcciónDeCambio` contesta `BAJA` sobre un par de versiones donde el destino tiene `rank` MAYOR y un solo limit menor** **de estrategia `SUMA` o `MÁXIMO` —más es mejor— (con una clave `MÍNIMO`, menor es mejor y el caso es el de abajo: `SUBE`; FASE 9 vuelta 1, §4 punto 3 de `24-verificado-G4`)** —si contesta `SUBE`, está leyendo el `rank` y no el delta (§2.9)—, con `políticaDePlan` ~~y `situaciónDeVertical`~~ contestando ~~los otros cinco campos~~ **sus campos —cuatro de `políticaDePlan`, sin `díasDeTrial` (FASE 9 vuelta 1, `F-8V1C1-015`)~~, y dos uno de `situaciónDeVertical` (`finDeServicio` salió, FASE 9 vuelta 2, `R5`)~~ (`situaciónDeVertical` salió con la revisión del owner, 2026-09-28, C8)—, y `políticaDeAddon` los suyos (`G4-2`),** sin que ninguna devuelva un entitlement ni un limit; **y contesta `SUBE` sobre un par donde lo único que cambia es una clave `MÍNIMO` que pasa de 24 a 4** —*bajar* es empeorar según la estrategia de la clave (`15` §2.2, `B/10` §3.5; FASE 9 vuelta 1, `F-8V1C1-002`)—; ~~y **discontinuar una vertical escribe `admite_altas = no` antes de que billing escriba su fecha**, y **esa escritura no se deshace cuando la mitad de billing falla** (`02` §2.1, `B/10` §4.3; owner 2026-09-27, FASE 9 vuelta 2, `Q-ALTAS`, `Q-ALTAS-b`)~~ (sale con la revisión del owner, 2026-09-28, C8) |
| **V3** | una clave que suma y una que no acumulan **distinto**, y la que no acumula **favorece al cliente**; y revocar una fuente invalida el caché de ~~ese `user + vertical`~~ **ese `user` en todas sus verticales** —un suspendido pierde la herencia de Turista VIP y las claves globales del plan que ya no paga en la próxima lectura (owner 2026-09-25; FASE 9 completa, 8a)—, **e invalidar una vertical entera borra las entradas de todos los users en ella** (6b); y **un grant nunca otorga menos que su `piso`**, leído de la fuente (9h) |
| **V4** | un trial vence de verdad, `cobertura()` pasa de sí a no por sí sola, y un segundo trial para el mismo `user + vertical` **es imposible**; y, sobre la tabla del `03` §2, **publicar con una `SUSCRIPCIÓN` presente y `cobrada: no` ~~arranca el trial (`T1`) y no lo consume (`T6` no dispara)~~ no arranca el trial ni lo consume** —ni `T1` ni `T6` disparan, la persona sigue en `PRE_TRIAL` y la ficha se publica porque está cubierta (`03` §2, fila de `cobrada: no`; FASE 9 vuelta 1, contradicción (d))—**, y el primer pago de quien ya ejerció el evento lo consume (`T8`)** — con billing todavía ausente se ejerce contra la respuesta del contrato que recibe la máquina, no contra la implementación de arranque, que no emite suscripciones (spec §4.2; owner 2026-09-25, FASE 9 completa, 6c); **y `extenderTrial` contesta `RECHAZADA` con el techo lleno y no mueve la fecha de fin, y el reintento con la misma `claveDeCanje` después de un `ACEPTADA` contesta lo mismo sin extender dos veces** (contrato §4.1, `11` §3; FASE 9 vuelta 1, `N-G4V-08`: la única escritura de billing en verticales estaba en *qué deja funcionando* y ningún criterio la probaba; la mitad del canje es de `B9`); **y, con el job de `T3` atrasado, un canje sobre un trial con la fecha de fin pasada contesta `RECHAZADA`; un primer cobro que se acredita mientras el `PB1` del mismo dueño está en vuelo deja la fila escrita por `T6` o por `T8`, nunca por ninguna~~; y un dueño en `PRE_TRIAL` cuya ficha volvió por `PB3` bajo una suscripción queda en `TRIAL_CONVERTED` con su primer cobro~~** (`03` §2; FASE 9 vuelta 2, `R15`, `F-8V2A2-003`; el caso de la vuelta salió con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`); **y la de arranque no puede llegar a producción (`G13`)** —falla sobre un build destinado a producción, no sobre la rama (contrato §6.3; owner 2026-09-26, `G5-5`; FASE 9 vuelta 1, `F-8V1C1-011`)—: **un build de producción que importa el módulo que contesta `no` por las fuentes de billing ~~y `NINGUNA` por `finDeServicio`~~ falla, con un caso por cada una de las seis respuestas de arranque (§2.12; contrato §6.3; FASE 9 vuelta 3, `F-8V3C1-002`), y uno que importa la resolución del trial y de `BASE` no** (contrato §6.3; FASE 9 vuelta 2, `F-8V2C1-005`); **y el juego único pasa entero contra la de arranque** (contrato §6.2; `F-8V2C1-006`); y **en una vertical con todos sus planes retirados ~~y `admite_altas` en sí~~, publicar sin cobertura no arranca el trial ni publica, y la persona sigue en `PRE_TRIAL` con el trial sin consumir** (`03` §2; FASE 9 vuelta 2, `R24`, `F-8V2A3-005`) |
| **V5** | un recurso ajeno, uno archivado y uno inexistente **contestan lo mismo al que no es su dueño** —y una ficha `ARCHIVED` le acepta a **su** dueño verla, exportarla y reactivarla **aunque no tenga ninguna fuente de clase `TÍTULO`**, porque la versión de piso lo otorga (`02` §2.1)—; y una cuenta ~~inhabilitada~~ **con el correo sin verificar** no puede averiguar qué permisos tiene probando operaciones (8b); **una operación que declara otra vertical que la del recurso contesta *«no existe»*, y una que escribe la vertical de una ficha existente no pasa el build** (la mitad *(c)* de `G2`; 7a); **una ficha ajena en `DRAFT`, `ARCHIVED` o `MODERATED` contesta lo mismo que una inexistente** (precisión 7; 8c); **y un `SUSPENDED` lee su Mi Cuenta, su billing y sus fichas** (8d) — owner 2026-09-25, FASE 9 completa; **y una acción administrativa con `actor = sujeto` contesta *«sin permiso»* en el paso 3** —un `ADMIN` que es además Partner con pago manual no puede registrarse su propia cuota— (`17` §3.2 regla 5; owner 2026-09-26, `G5-1`); **y sobre una ficha `PUBLISHED` ajena, editarla, subirle fotos o comprar un addon `LISTING` con ella de objetivo contesta *«no existe»*; leer el billing de otra cuenta con el permiso de familia de leer el suyo contesta *«no existe»*, y el admin lo lee sólo con el permiso de inspección de esa entidad; y la acción 15 no deja la ficha por encima del cupo de su dueño** (`17` §1.2 precisiones 7 y 8, §3.2 reglas 1 y 3; FASE 9 vuelta 2, `F-8V2A1-001`, `-002`, `-004`)~~; **y la acción 16 la ejecuta un `SUPER_ADMIN` sin que los pasos 5 a 7 consulten a ningún dueño de la vertical, y un actor de sistema no la ejecuta** (`17` §3.2 regla 3 y §3.3; owner 2026-09-27, FASE 9 vuelta 2, `Q-ACC16`)~~ (sale con la revisión del owner, 2026-09-28, C8) |
| **V6** | un trial que vence baja la ficha a `UNPUBLISHED_BY_BILLING` y no a `DRAFT`, y al recuperar cobertura vuelve **sólo** la que bajó el sistema; **dos `PB1` simultáneos del mismo dueño con un solo lugar de cupo dejan una sola ficha publicada** (el lock; `R14`); **un aviso de cobertura perdido lo corrige la corrida siguiente del reconciliador diario**, sin que nadie publique a mano (`DEC-ARCH-009`); y **una ficha `MODERATED` no la saca ninguna transición del sistema, y levantar la moderación la deja en `DRAFT` con el reloj reiniciado** (`PB11`, hecho 6; 5b) — *(criterios agregados en la salida 3 de la FASE 9 completa)*; **una ficha del corte en `UNPUBLISHED_BY_BILLING` de un dueño en `PRE_TRIAL` se publica y arranca el trial; la de un dueño cubierto no se publica a mano y vuelve por `PB3`; una ficha `INACTIVE` sin `billing_unpublished_at` nace `DRAFT` y ningún cambio de cobertura la publica** (FASE 9 vuelta 1, R1); **después de `PB12` la ficha no conserva conexión de calendario: el token quedó revocado en el proveedor y no existe en la base** (`G1-5`; FASE 9 vuelta 1, J); **el empuje de `PB12` sale después del commit: el consumidor que lo recibe y relee `fichaPurgada` lee `sí`** (contrato §3.1; FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`); **y tres fichas del corte de un mismo dueño, sin evento de publicación, suben por `PB3` con cupo 1 siempre en el mismo orden —la de `created_at` más viejo—, y una publicada después del corte queda detrás de las tres** (`03` §9, *«cuáles vuelven»*; FASE 9 vuelta 1, `N-G1-01`); **y la migración del corte deja una `L1` en `PURGED` con su contenido y sus fotos en el almacenamiento externo, y la herramienta del paso 5b la deja sin contenido, sin fotos y sin token de calendario; correrla otra vez no llama al almacenamiento ni al proveedor** (FASE 9 vuelta 2, `F-8V2A3-002`); **y la herramienta del paso 4c le pide al caché de páginas que revalide cada ficha nacida `UNPUBLISHED_BY_BILLING` o `PURGED`, y después la página de una de cada clase, pedida desde afuera, ya no la muestra; correrla otra vez da lo mismo** (`16-fase-7…` §4.2; FASE 9 vuelta 2, `F-8V2C2-006`); ~~**y con `finDeServicio` contestando una fecha ya cumplida, la corrida del reconciliador baja la ficha publicada, escribe el instante de la fecha en `inactiva_desde` de toda ficha de la vertical e invalida las entradas de la vertical** (`03` §9; owner 2026-09-27, FASE 9 vuelta 2, `R5`)~~ (revisión del owner, 2026-09-28, C8); **y con el primer cobro acreditado y `T8` evaluado antes de que `PB3` suba la ficha, la fila de `trial` consumida queda escrita igual, por `PB3`** (`03` §2; FASE 9 vuelta 2, verificación, `N-B-01`); **y el recorrido del esquema de `G-R9` da 29 tablas con FK y 11 con `entity_type`, todas con fila en la lista de `PURGED`, y una tabla nueva con FK a `accommodations` sin fila lo pone rojo** (`02` §4.1, `20` §2; `V2-k`); **y el 4c purga también la etiqueta de colección de cada tipo de ficha, y un listado que mostraba la tarjeta de una ficha bajada, pedido desde afuera, ya no la muestra** (`16-fase-7…` §4.2; `N-C-07`); **y purga la página de cada destino, 22, y la del destino de una ficha bajada, pedida desde afuera, ya no la lista** (`V2-t`) |
| **V7** | aprobar una postulación con el correo de un tercero **no vincula nada** hasta que alguien con acceso a esa casilla lo reclame; y **un Silver que deja de pagar sale del carrusel, y una presencia moderada responde 404 con el cobro intacto** (owner 2026-09-25; FASE 9 completa, 7b y 7c); **y reclamar con sesión vincula a la cuenta de la sesión y no a la que tiene la dirección; una cuenta con el correo sin verificar y un vínculo no puede cambiar el correo; dos postulaciones simultáneas con el mismo correo dejan una sola `PENDIENTE`; y una espera anulada por el admin deja postular** (`18` §2.2 y §2.4; owner 2026-09-27, FASE 9 vuelta 2, `R7`) |
| **V8** | ninguna superficie decide por sí misma: lo que se oculta ya está rechazado por V5; y **el botón de suscribirse de quien todavía no publicó en esa vertical lo manda a publicar, no al checkout** (owner 2026-09-25; FASE 9 completa, 6c) **si publicar le arrancaría el trial; en una vertical con los días de trial en cero, sin evento declarado o con el hash con fila lo manda al checkout, y en una vertical sin altas no ofrece nada** (la regla de `19` §4 fila 23; FASE 9 vuelta 1, `F-8V1D1-004`, `F-8V1A1-008`); **la acción 15 edita el contenido de una ficha ajena y no la publica, no la destaca ni la borra —un acto ajeno no dispara `T1`—; un admin sin su permiso no la ejecuta, aunque tenga otros, y cada ejecución deja su registro de auditoría con actor distinto del sujeto y el aviso al dueño** (`DEC-AUTH-002`, `DEC-AUTH-003`; `G5-2`; FASE 9 vuelta 1, L); y **en esa misma vertical la pantalla dice *«esta vertical no tiene planes disponibles»* y no muestra ningún botón de suscribirse** (`19` §4 fila 29; FASE 9 vuelta 2, `R24`) |
| **V9** | la fila de `trial` sobrevive al borrado de la cuenta, y su ~~hash~~ **seudónimo** **no** se anonimiza (`C-1`); **el día 180 (`PB9`) borra el contenido de la ficha y nada de la persona** (`DEC-DATA-005`), **y después del borrado ningún evento de dominio conserva el texto borrado** (8e); **y después de `PB9` la ficha no conserva conexión de calendario: el token quedó revocado en el proveedor y no existe en la base** (`G1-5`; FASE 9 vuelta 1, J); **y después de `PB9` la alerta de precio de un turista está cerrada y su correo encolado, la conversación se lee y no admite mensajes, y lo del dueño que sólo servía a la ficha no tiene filas de ella; `PB9` y `PB8` simultáneos sobre la misma ficha no dejan contenido borrado en una ficha `DRAFT`; y el seudónimo de un correo es el mismo antes y después de un redeploy** (`02` §2.2 y §4.1, `03` §9; FASE 9 vuelta 2, `R9`, `F-8V2A2-004`, `F-8V2A3-004`); y **`ana.maria@gmail.com` y `anamaria@gmail.com` comparten seudónimo, y `ana.maria@hotel.com` y `anamaria@hotel.com` no** (`02` §2.2; owner 2026-09-27, FASE 9 vuelta 2, `R23`), **ni `ana.maria@hotmail.com` y `anamaria@hotmail.com`, ni `ana@hotmail.com` y `ana@outlook.com`; y `ana+1@hotel.com` y `ana+2@hotel.com` sí lo comparten** (`02` §2.2; owner 2026-09-28, FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j3`); y **el día del fin de servicio, antes de que corra el reconciliador, `PB9` no borra la ficha archivada cuyo día 180 cae ese día** (`03` §9; FASE 9 vuelta 2, verificación, `N-B-03`) |

---

## 5. Dónde vive cada unidad

Las nueve están en Linear como sub-issues de `HOS-1353`, y cada una tiene su ficha publicada.
El estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se lleva en el
**[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles están listas: una unidad lo está
cuando todas sus dependencias están hechas.

| unidad | issue | ficha |
|---|---|---|
| **V1** | [HOS-1355](https://linear.app/hospeda-beta/issue/HOS-1355) | [ficha](https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o) |
| **V2** | [HOS-1356](https://linear.app/hospeda-beta/issue/HOS-1356) | [ficha](https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R) |
| **V3** | [HOS-1357](https://linear.app/hospeda-beta/issue/HOS-1357) | [ficha](https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6) |
| **V4** | [HOS-1358](https://linear.app/hospeda-beta/issue/HOS-1358) | [ficha](https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa) |
| **V5** | [HOS-1359](https://linear.app/hospeda-beta/issue/HOS-1359) | [ficha](https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX) |
| **V6** | [HOS-1360](https://linear.app/hospeda-beta/issue/HOS-1360) | [ficha](https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY) |
| **V7** | [HOS-1361](https://linear.app/hospeda-beta/issue/HOS-1361) | [ficha](https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb) |
| **V8** | [HOS-1362](https://linear.app/hospeda-beta/issue/HOS-1362) | [ficha](https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq) |
| **V9** | [HOS-1363](https://linear.app/hospeda-beta/issue/HOS-1363) | [ficha](https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd) |

**Las otras cuatro fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ).

---

## 6. Lo que esta descomposición NO decide

- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista.
- **Qué se reescribe y qué se reutiliza.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`).
  Esta descomposición dice **qué hay que tener funcionando**, no de dónde sale.
- **Fechas y esfuerzo.** No hay estimaciones acá a propósito: salen del atomizado.
- **Si cada unidad es un issue de Linear.** Depende de si conviene verlas en el roadmap o
  alcanza con el tracking interno de la épica.
