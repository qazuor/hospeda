---
title: "FASE 9 completa · lo aplicado en verticales, contrato y núcleo"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — lo aplicado en verticales, contrato y núcleo

Registro de la tanda de aplicación del carril **`V/*`** (salvo `V/21`, `descomposicion.md` y
`spec.md`), **`D/12-contrato-de-cobertura.md`** y **`D/nucleo/*`**. Fuente: las decisiones del
owner de [`10`](./10-decisiones-del-owner.md) y las contradicciones y bordes de los informes `01`
a `09` que caen en este carril. Rutas: `V/` es `HOS-1353-…/docs/`, `N/` es `D/nucleo/`, `C` es el
contrato, `B/` es `HOS-1354-…/docs/`. Los números de línea son los del texto **después** de aplicar.

Toda línea nueva lleva *«owner 2026-09-25; FASE 9 completa, &lt;ID&gt;»* o *«FASE 9 completa,
&lt;ID&gt;»*; lo que cambió de sentido quedó tachado al lado. Los bordes declarados llevan
*«declarado por `DEC-METH-015`, FASE 9 completa»*. `updated: 2026-09-25` en los 18 archivos
tocados.

## 1. Decisiones del owner

| decisión | dónde | qué |
|---|---|---|
| **1** | `N/07:54-58` (§1.3), `N/07:201-205` (§5.3 regla 2), `N/07:234` (§6, *«antes de cancelar»*), `N/04:105` (invariante 25) | un correo obligatorio en `failed` no bloquea: se cancela igual y se escala como no-entregable |
| **2g** *(consecuencia en este carril)* | `V/03:353-364`, `V/02:298` (fila `trial`), `N/01:65-73` | el corte **no** escribe filas de `trial`: tachado lo que decía que sí |
| **3a** *(consecuencia en este carril)* | `N/07:228` (fila *«cobro fallido / grace»*) | los correos del grace no prometen que el reintento use la tarjeta nueva |
| **3c** *(consecuencia en este carril)* | `C:148-152` | `cobrada: no` sobre `GRACE_PERIOD` pasa a ser posible (la sucesora que venía pagando) |
| **4d** | `V/15:153-161` (§2.6) | el pliegue no mira `cobrada`; lo que deja lo cierra la orfandad de `B/16` §4.2 |
| **4c/4d** *(consecuencia en el inventario)* | `N/01:568` (inventario de *«fila viva»*, fila 5) | el mismo consumidor lee sobre un conjunto |
| **4e** | `C:633-639` (§2.7), `V/20:59` (`G-R2-C`) y `V/20:359-368` | emisión de `USER`/`GLOBAL` sólo en verticales compatibles, con guard gemelo de `G-R2-B` |
| **5a** | `N/08:165` (fila 14 nueva), `N/08:164` (`reembolsar` = `RF2`), `N/08:167-176` (recuento 13→14), `N/08:289`, `:304`, `:353`; `V/17:296-300`, `:306`, `:323-331`, `:342`, `:368`, `:382`, `:386-387` (trece→catorce); `N/01:379-388`, `:445`, `:455-457` (décima máquina, el reembolso); `N/03:17-23`, `:84`, `:96`; `N/00:105`; `V/20:63`, `:67`; `V/03:244` | fila nueva del catálogo; y, como el owner la llamó *«máquina»*, se la cuenta como la décima (`B/03` §6.1, `RF1`–`RF5`, ya lo hace así) |
| **5b** | `N/01:48`, `:50`, `:59` (fila del hecho 6), `:61-67`, `:74`, `:84-92`, `:119-131`, `:134`, `:200-203`, `:489`; `V/02:241`, `:252`, `:348-368`, `:393`, `:405-410`, `:425`, `:448`, `:460`, `:561`; `V/03:516` (fila `PB11`), `:584-601`, `:688-693`, `:1087`; `V/20:68` (`G-R6-B`), `:76-78`, `:84-106`, `:165-178`, `:207-212`, `:272`; `N/07:93`; `N/08:163` | levantar la moderación es el **hecho 6** (`PB11`); la lista cerrada pasa de cinco a seis |
| **6a** | `V/10:92`, `V/02:118-122`, `C:985-989` | la pricing no ofrece planes de una vertical que no admite altas; `S1` lee `admiteAltas` |
| **6b** | `V/02:504` (fila nueva de §3.2), `V/02:494-498`, `C:589-595`, `V/03:1104-1118` (⚠️ punto 2), `V/15:336-337` | al llegar `fin_de_servicio` el barrido del día invalida toda la vertical |
| **6c** | `V/03` diagrama y nota (`:27-47`), tabla (`:56`, `:58` fila **`T8`**), `:118-120`, `:203-236` (subsección *«`T6` espera el cobro, y `T8` lo consume»*), `:258-261`, `:269-271`, `:310`, `:458-462`; `V/11:22-23`, `:28-31`, `:471-490` (§9.4); `V/19:69` (fila 23, el botón inteligente); `V/02:185-190`, `:298`, `:323`; `V/18:84-90`, `:98`; `N/01:475`; `N/03:103`, `:150-157`; `C:121`, `:158-161`, `:893-895` | `T6` exige un título que convierte; `T8` consume la fila al primer pago; el botón manda a publicar |
| **7a** | `V/17:63`, `:161-170` (precisión 6 generalizada), `:207-212` (§2.2), `:255-257` (§2.3); `V/02:341` (vertical inmutable); `V/20:51` (`G2` mitad *c*) y `:343-351`; `C:102-108` | precisión 6 para todo recurso con vertical; `listing.vertical` inmutable |
| **7b** | `V/18:41-52` (tabla y clave del carrusel), `:123-129`, `:139-145`, `:283-286`; `V/03:1008-1027` (población del reconciliador); `V/02:503`; `V/15:279`; `V/19:68`, `:88-92`; `N/01:47`; `C:832` | clave *«presencia en el carrusel»* (Gold y Silver), mismo caché y reconciliador |
| **7c** | `V/18:130-139`, `:148-151`, `:158`; `V/17:297`, `:325-327`; `N/08:163`, `:171-173`; `V/19:78`; `V/03:1022-1024`; `N/01:47` | bit de moderación de la presencia, escrito por la misma acción que `PB10` |
| **8a** | `V/02:487-489`, `:496`, `:501`, `:511-524` (regla 3); `V/03:1038-1040`; `V/15:255-259`, `:463-468` | la invalidación es por `user` |
| **8b** | `V/17:48-53`, `:65`, `:111-114` | «inhabilitado por abuso» sale del paso 2 |
| **8c** | `V/17:67`, `:171-179` (precisión 7), `:422-426` (§3.5); `V/18:143-146` | lo ajeno existe sólo en estado público |
| **8d** | `V/17:412-420` (§3.5); `V/02:224-230` | las lecturas de lo propio no consultan el paso 6 |
| **8e** | `N/08:48-51` (§1.1), `:62` (§1.2), `:66-73`; `N/01:54` (hecho 1); `N/02:84` | el evento guarda sólo el nombre de los campos de contenido; corregido `N/01:54` |

## 2. Contradicciones de texto aplicadas

| id | informe | dónde |
|---|---|---|
| `K-1` | `05` | `C:846-852` |
| `K-2` | `05`, `06` | `C:114` |
| `K-3` | `05` | `N/01:246-253` |
| `K-4` | `05` | `V/02:221` |
| `K-5` | `05` | `V/03:510`, `V/03:725-734` (⚠️ punto 7), `V/02:582-584` |
| `K-6` | `05` | `N/08:163` (queda verdadera con 5b, y se dice) |
| `K-8` | `05` | `N/01:431-461` (el recuadro sale de la tabla del diccionario) |
| `α` (encabezado del ⚠️) | `06` | `V/03:1085-1088` |
| `C:111` / `C:809-811` | `06` | `C:114`, `V/03:1104-1118` |
| `V/02:116-117` | `06` | `V/02:118-122` (con 6a la afirmación pasa a ser verdadera) |
| `C-R12-2` | `07` | `N/01:531-534` (el lado de `B/03` es del otro carril) |
| `C-R12-3` | `07` | `V/03:138-143` |
| `C-R12-4` | `07` | `V/03:176-183` (⚠️ punto 3) |
| `C-R12-5` | `07` | `V/03:27-47`, `V/03:118` |
| `C-R14-1` | `07` | `V/03:765-770` |
| contradicción 1 | `08` | `C:102-108` |
| contradicción 3 | `08` | `V/18:167-177` (⚠️ punto 2), `V/03:1008-1016`, `V/02:503` |
| `C-1` | `09` | `V/02:298`, `:576`, `:633-637`; `V/22:79-84`, `:97-103`, `:111-119` (el pliego `D/13` es de otro carril) |
| `C-3` | `09` | `V/02:47` (`UNIQUE(id, vertical)`; la mitad de `B/02:493` es del otro carril) |
| `C-7` | `09` | `V/03:968-972` |
| `C-8` | `09` | `C:442-465` (la mitad de `B/19` 16/16-bis es del otro carril) |
| `C-10` | `09` | `N/02:88-89` |
| `C-12` | `09` | `V/03:240-244` |
| `C-13` | `09` | `N/00:42-49` |
| `C-14` | `09` | `V/03:106`, `V/11:237-239`, `N/00:64-65` |
| `C12` | `01` | `C:422` |
| contradicción 1 de `R4` | `03` | `N/08:152` (el motivo `DESTINO_DE_PLAN_NO_MENSUAL` y los otros lugares son de `B/`) |
| contradicción 5 de `R4` | `03` | `N/01:839-844` (apoyada en la fila nueva de `B/03` §3.2 que el otro carril tiene que escribir) |

## 3. Bordes declarados

| id | informe | dónde |
|---|---|---|
| `B-1` / `α` | `05`, `06` | `V/03:1090-1103` (⚠️ punto 1 reemplazado), `N/01:263-273`, `C:832-834`, `C:870-874`, `N/04:171-172`, `V/03:941-942` |
| `B-2` | `05` | `V/20:258-265` |
| `B-3` | `05` | `V/02:585-590` |
| `B-4` | `05` | `V/03:719-724` (⚠️ de la moderación, punto 6) |
| `B-9` | `05` | `V/03:529-532`, `N/03:54-57` (regla 2) |
| `β` | `06` | `V/03:1104-1118` (⚠️ punto 2 reemplazado, con el job de la cortesía) |
| fin de `CANCEL_SCHEDULED` sin ventana | `06` | `V/15:510-516` |
| `R12-BORDE-2` | `07` | `V/03:195-201` (⚠️ punto 5) |
| `R14-BORDE-1/2/3` | `07` | `V/03:780-803` (⚠️ del lock, puntos 2 a 4) |
| `B3` | `08` | `V/18:179-186` (⚠️ punto 4) |
| `B4` | `08` | `V/19:68` (fila 22) |
| `DB-1` | `09` | `N/07:334-339` |
| `DB-4` | `09` | `N/08:289`, `:302-304`, `:345-351` (con 5a queda con productor: `RF5`) |

## 4. Lo que NO se aplicó, y por qué

- **`K-9`** (`05`): `A5` y `A6` sobre la misma llegada a `PURGED` contra la regla 7 de `N/03`. El
  informe da dos salidas —un décimo caso de la regla 7 o sacarle a `A6` la llegada a `PURGED`— y
  **elegir es una decisión**, que además toca `B/16` y `B/03` §8 (otro carril). Queda para el
  orquestador y quien cerró R6.
- **`C-2`** (`09`): agregar `piso` a la firma de `cobertura()`. **Cambia la firma**, y el informe
  dice que el orquestador decide si va al owner. No se tocó `C` §2.
- **`OW-2`** / 5c: es `V/21`, fuera de este carril.
- **`R4` contradicción 5 / `N/01` precisión 3**: aplicada del lado del núcleo, pero **se apoya en una
  fila de `B/03` §3.2** (`PAUSED · COURTESY` → `PAUSED · CUSTOMER_REQUEST`) que tiene que escribir el
  carril de billing. Si no la escribe, `N/01:839-844` cita una fila que no existe.
- **`G-R2-C`**: se declaró el guard (4e) pero **no se le asignó unidad constructora**: es de
  `descomposicion.md`, fuera de este carril (`V/20:365-368` lo dice).

## 5. Citas fuera de carril que quedaron desalineadas

Con el texto exacto que haría falta. Ninguna se tocó.

| archivo:línea | dice | tendría que decir | causa |
|---|---|---|---|
| `B/20:63` (`G-R6-B`) | *«uno de los **~~cuatro~~ cinco hechos**»* | *«~~cinco~~ **seis** hechos (el sexto, `PB11`, FASE 9 completa, 5b)»* | 5b |
| `B/20:291` | *«De los ~~cuatro~~ cinco hechos que escriben»* | *«~~cinco~~ seis»* | 5b |
| `B/03:1892` (§7.1) | *«—**hoy cinco**»* | *«—**hoy seis**»* (`V/20:207` ya dejó de afirmar que `B/03` lo dice así) | 5b |
| `B/20:280` | *«las NUEVE máquinas de las dos épicas»* | *«las ~~NUEVE~~ DIEZ máquinas»* (el mismo archivo ya dice *«diez»* en `:244`) | 5a |
| `V/descomposicion.md:62`, `:107` | *«~~cuatro~~ cinco hechos»* | *«seis hechos»* | 5b (salida 3 de `DEC-METH-004`) |
| `V/descomposicion.md:185-186`, `:204`, `:261`, `:377` | *«nueve máquinas»* | *«diez máquinas»* | 5a |
| `B/descomposicion.md:456` | *«~~cuatro~~ cinco hechos»* | *«seis hechos»* | 5b |
| `B/descomposicion.md:381`, `:390` | *«veinte motivos»* | *«veintidós motivos»* | `B/02` §2.5 ya tiene 22 |
| `D/13-pliego-consulta-legal.md:135`, `:145`, `:155` | *«hash irreversible»*; *«**Ningún mecanismo.**»* | *«seudónimo determinístico del correo normalizado: no permite leer el correo, pero reconoce a quien vuelve con el mismo»*; en la rama del *«no»*: *«cambia un mecanismo: hay que poder borrar el seudónimo de una fila que hoy se declara íntegra, con un escritor nuevo y una columna anulable, y el `UNIQUE` deja de bloquear a esa persona»*. **Va antes de mandar el pliego** | `C-1` |
| `D/04-open-decisions.md:398`, `V/spec.md:63` | *«hash irreversible»* | *«seudónimo determinístico»* | `C-1` |
| `B/02:493` | *«el piso tampoco es anulable»* | *«el piso **es una versión de ese mismo plan** (FK compuesta sobre `plan_version(id, plan_id)`), y el plan pertenece a esa vertical (FK compuesta sobre `plan(id, vertical)`, que `V/02` §2.1 ya declara `UNIQUE`)»* | `C-3` |
| `B/19:127-128` (filas 16 y 16-bis) | *«que **no se ofrece**»* | agregar *«…y le dice que **perdió la cobertura** y que sus fichas vuelven cuando autorice»* | `C-8` (`C:463-465` ya lo exige) |
| `B/19` §4 | — | la fila espejo del botón inteligente (6c), que `V/19:69` cita como *«el espejo de billing»* | 6c |
| `B/03:736-737` | *«la cobertura vuelve con el alta nueva de `S1`»* | *«y la cobertura no vuelve: la vertical dejó de admitir altas (`B/10` §4.3), así que no hay alta nueva que la devuelva. Lo que le queda es lo suyo: `PB8` y la exportación, sobre la versión de piso»* | 6a (informe `06`) |
| `B/10` §4.6 | — | *«La lee `S1` (`B/03` §3.2): la vertical que no admite altas no admite suscripciones nuevas ni sucesiones»* | 6a |
| `B/16` §4.2 | *«la cuenta se borró»* (única orfandad de `USER`/`GLOBAL`) | la cláusula de 4d y la lectura sobre el conjunto de 4c, que `N/01:568` y `V/15:152-161` ya citan | 4c, 4d |
| `V/21:127-130`, `:151`; `D/16:139` | *«`PB2` se dispara por el cambio de `cubierto` … se despublican la mañana del corte»* | *«…el corte no es un cambio de `cubierto` (no hay valor anterior), así que `PB2` no dispara por evento: **las despublica la primera corrida del reconciliador diario de cobertura** (`V/03` §9, `DEC-ARCH-009`), dentro del primer día»* | `C-7` |
| `D/01` (log) `:4311` | *«la lista de los **cinco** consumidores»* | *«seis»* (`V/02:436-437` ya lo anota) | `K-7` |
| `D/01` (log), bajo `DEC-ARCH-009` | — | 📌 *«**Precisada** (2026-09-25): la población excluye también `MODERATED` (`F-8CA2-004`) e incluye a todo `user + Partner` con una clave de presencia —la página o el carrusel (7b)—, sobre el que no corre transiciones: compara las claves y, si difieren, invalida (`R13`, `V/03` §9, `V/18` §1.6)»* | contradicción 2 de `08` |
| `D/01` (log), bajo `DEC-MAIL-001` | — | la precisión de la decisión 1 (un `failed` definitivo no bloquea) | 1 |
| `D/01` (log), bajo `DEC-DATA-002`/§1.2 | — | el sexto hecho (5b) y la décima máquina (5a), si el log los cuenta | 5b, 5a |

## 6. Listas cerradas que se movieron, recontadas

Comando (sobre el texto ya aplicado, desde `.specs/`):

```text
$ python3 - <<'EOF'
import re
n1=open('HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md').read()
sec=n1.split('**Los ~~cuatro~~ ~~cinco~~ seis hechos que reinician')[1].split('**Por qué el corte')[0]
print([re.match(r'^\| \**([0-9C])',l).group(1) for l in sec.split('\n') if re.match(r'^\| \**[0-9C]\**\s*\|',l)])
n8=open('HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md').read()
sec=n8.split('| acción | de dónde sale |')[1].split('\n\n')[0]
print(len([l for l in sec.split('\n') if l.startswith('|') and not l.startswith('|---')]))
sec=n1.split('| máquina | estados |')[1].split('\n\n')[0]
print([re.match(r'^\| \*\*([^*]+)\*\*',l).group(1) for l in sec.split('\n') if l.startswith('| **')])
v3=open('HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md').read()
print(sorted(set(re.findall(r'^\| \**(T\d)\**\s*\|',v3,re.M))), len(set(re.findall(r'^\| \**(PB\d+)\**\s*\|',v3,re.M))))
EOF
['1', '2', '3', '4', '5', '6', 'C']
14
['Trial', 'Suscripción', 'Pago', 'Pago manual', 'Addon (instancia)', 'Publicación', 'Postulación de Partner', 'Grace', 'Pausa', 'Reembolso']
['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] 12
```

| lista | antes | después | citas del número viejo corregidas en este carril |
|---|---|---|---|
| hechos del reloj | 5 (+ `C`) | **6** (+ `C`) | todas las de `N/01`, `V/02`, `V/20`, `N/07` y las de *«reinicios»*; búsqueda final: `rg -n -P "(?<!~~)cinco(?!~~)\**\s+(hechos\|reinicios\|escritores)"` → sólo `V/03:693` (*«los otros cinco»*, correcto) y las de §5 |
| acciones administrativas | 13 | **14** | las siete de `V/17` y la de `N/08`; `B/19:198` y `B/03:1887` ya dicen catorce |
| máquinas | 9 | **10** | `N/01` §2 (dos), `N/03:17-23`, `:84`, `:96`, `N/00:105`, `V/20` `G-R4` y `G-R6`, `V/03:244`; `rg -n -i -P "nueve\**\s+(máquinas\|tablas)"` → sólo las de §5 |
| transiciones de trial | 7 | **8** (`T8`) | `V/11:22`, `N/01:475` (salidas de `PRE_TRIAL`, 3→4), `V/02:185-190`, `V/18:84-90`, `:98` |
| pares *«mismo `desde`, otro evento»* de la regla 7 | 9 | **10** (`T8`) | `N/03:96-157` |
| precisiones de `V/17` §1.2 | 6 | **7** | `V/17:78-80` |
| reglas de invalidación de `V/02` §3.2 | 2 | **3** | `V/02:506-507` |
| mitades de `G2` | 2 | **3** | `V/20:51` |
| motivos de marca | 20 | **22** (movido por el carril de billing: `COBRO_DEL_PERÍODO_SIN_RESOLVER` y `PAUSA_NO_APLICADA`) | las citas del núcleo: `N/01:701`, `:730`, `N/03:42-44`, `N/04:64`, `N/08:158`, `:327`; los **SÍ** siguen en siete. `rg -n "veinte" nucleo/ V/ C` → ninguna cita viva de motivos |
| publicación | 6 estados / 12 transiciones | **sin cambio** | — |
