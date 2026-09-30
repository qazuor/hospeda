---
title: "FASE 5 · aplicación del lote de la aplicación — núcleo, contrato, log y matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación del lote de la aplicación: núcleo, contrato, log y matriz

Fuente: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), «Lote de la aplicación»
(letras A a L; contra la recomendación, A; L con la 2 recomendada tras la corrección del
coordinador), y las preguntas con su contexto en [`21-cruces.md`](./21-cruces.md) §5. Origen en
cada cambio: `(FASE 5, lote de la aplicación, owner 2026-09-30, <letra>)`.

## 1. Archivos tocados

- `nucleo/01-glosario.md`
- `nucleo/02-modelo-de-datos.md`
- `nucleo/08-auditoria-y-observabilidad.md`
- `01-decision-log.md`

No se tocaron: `12-contrato-de-cobertura.md`, `06-mp-validation-matrix.md`, ni `nucleo/00`, `03`,
`04` y `07` (ver §3).

## 2. Qué se aplicó

### Núcleo

- **B** · `nucleo/01-glosario.md:77` «la herramienta del corte de `V6`, que es del sistema nuevo,»
  (tachado al lado: ~~el script del corte~~).
- **B** · `nucleo/02-modelo-de-datos.md:105` «la herramienta del corte de `V6`, que es del sistema»
  (tachado: ~~el script del corte~~).
- **B** · `nucleo/02-modelo-de-datos.md:197` «la herramienta del corte de `V6`: FASE 5, owner
  2026-09-30, lote 2 D» (tachado: ~~el script del corte~~).
- **E** · `nucleo/02-modelo-de-datos.md:102` «La tabla de claves viaja igual: SQL generado por
  script» y, en la misma frase, «los guards pasan de 33 a 34».
- **E** · `nucleo/02-modelo-de-datos.md:128` (tabla de §1.4, fila de `G3`) «vigilado por el control
  que lo regenera y compara».
- **F** · `nucleo/08-auditoria-y-observabilidad.md:195` «El rol de socio no lo asigna aprobar»
  (tachado: ~~**Aprobar asigna además el rol de socio**~~).
- **L** · `nucleo/08-auditoria-y-observabilidad.md:279` «Y con ellas `fullAdminRole` del plugin
  queda sin ninguna acción» y «el plugin sigue sólo como guardia del baneo».

### Log (11 📌 sobre 11 decisiones, cada una con su marca en el *Estado*)

- **A** (contra la recomendación, dicho en los tres) ·
  - `DEC-MIG-002` · `01-decision-log.md:2709` «Si el corte se aborta, la regla que bloquea toda».
  - `DEC-MIG-003` · `01-decision-log.md:3102` «puesta hasta el reintento**: la plataforma entera».
  - `DEC-MIG-005` · `01-decision-log.md:6418` «la regla que bloquea toda escritura hasta el reintento».
- **C** · `DEC-MIG-003` · `01-decision-log.md:3105` «se declara y se acepta».
- **D** · `DEC-MIG-003` · `01-decision-log.md:3108` «copia a una tabla de paso»; `DEC-MIG-006` ·
  `01-decision-log.md:6871` «copia a una tabla de paso».
- **B** · `DEC-MIG-006` · `01-decision-log.md:6868` «los escribe la herramienta del corte»;
  `DEC-ARCH-013` · `01-decision-log.md:7213` «los escribe la herramienta del corte de `V6`».
- **E** · `DEC-ARCH-013` · `01-decision-log.md:7207` «con el mismo mecanismo y el mismo control que
  el catálogo»; `DEC-TEST-001` · `01-decision-log.md:4572` «34 guards distintos»; `DEC-ARCH-014`
  (los 33 de los 📌 O-A y P-C) · `01-decision-log.md:7442` «pasan a **34**».
- **F** · `DEC-ENT-006` · `01-decision-log.md:6622` «no se asigna al aprobar la».
- **H** · `DEC-ARCH-014` (donde vive la lista de `U1`) · `01-decision-log.md:7439` «son **las seis
  del cobro viejo**»; repetido en `DEC-ENT-006` · `01-decision-log.md:6626` «son **seis**».
- **I** · `DEC-CONC-002` · `01-decision-log.md:1624` «sale la columna `origen_de_lápida` y su
  restricción».
- **J** · `DEC-RF-008` · `01-decision-log.md:6488` «impone una restricción de la base».
- **L** · `DEC-AUTH-003` · `01-decision-log.md:6739` «de Better Auth queda sin ninguna acción».
- **Resumen** · fila *Precisadas sin `SUPERSEDED`*: «tras los once 📌 del lote de la aplicación»;
  fila *FASE 5*: «0 nuevas, 11 📌 sobre 11 decisiones».

## 3. Lo que no se aplicó y por qué

- **I en el núcleo y el contrato**: `origen_de_lápida` no aparece en ningún archivo mío
  (`rg -n "origen_de_l" nucleo 12-contrato-de-cobertura.md 06-mp-validation-matrix.md` → 0). Sólo
  queda el 📌 de `DEC-CONC-002`.
- **J en el núcleo**: ningún archivo del núcleo nombra la serialización de devoluciones por orden.
- **D, C y A en el núcleo**: el núcleo no describe la rama de aborto, el 5b ni la ventana sin
  servidor; `nucleo/02:97` sólo dice que el corte *«entra en la rama de aborto»*, que sigue cierto.
- **H en el núcleo**: el núcleo no nombra columnas de `partners`.
- **G y K**: ninguna decisión viva dice lo contrario (`DEC-CONC-002` ya manda *«con el correo antes
  y la relectura después»* en el reintento de toda cancelación nuestra; ninguna decisión fija qué
  pasos refrescan la página), así que no dejan 📌.
- **Contrato** (`12-contrato-de-cobertura.md`): ninguna letra lo toca. Su única mención cercana,
  *«la versión la trae el acto —otorgar, anclar o la herramienta del corte—»* (`:681`), ya es
  consistente con B.
- **Matriz**: ninguna fila cita `origen_de_lápida` ni un conteo de guards; no se tocó.
- **Los 📌 viejos que dicen 33** (`DEC-TEST-001` N1/C9 y casos 16 y 48; `DEC-ARCH-014` O-A y P-C) no
  se editan: el log no reescribe 📌 fechados; el 📌 nuevo de cada una dice 34.
- **`DEC-ARCH-012`**: el catálogo generado del lote 2 D vive en `DEC-ARCH-013`, no en la 012; no se
  le puso 📌.

## 4. Para otro dueño

1. **`V/20` §2 o `B/20` §2 (catálogo de guards)**: sumar el guard 34, *«el SQL generado del catálogo
   o de la tabla de claves no es el que genera su script (FASE 5, owner 2026-09-30, lote 2 D y lote
   de la aplicación, E)»*, en la mitad que fije el owner (ver §5).
2. **`16-fase-7-del-paraguas.md` §4.2 (paso 3 y 5b)**: A (la regla queda hasta el reintento si se
   aborta), C (el aviso sin servidor se declara y se acepta) y D (la tabla de paso que el 5b recorre
   y borra), y B (la herramienta del corte de `V6` escribe las cinco pruebas).
3. **`V/18` §2 y `V/17`**: F, el rol de socio en el reclamo o en el alta directa con dueño.
4. **`B/02` y los capítulos de lápida (`B/09`, `B/21`)**: I, tachar `origen_de_lápida` y su
   restricción. **`B/02` §2.3 o el de `refund`**: J, el índice parcial por orden.
5. **`V/descomposicion.md` (fila de `V5`)**: L, vaciar `fullAdminRole` junto con `impersonate` y
   `set-role`.
6. **Coordinador**: `DEC-AUTH-003` (📌 del lote 3 C, `01-decision-log.md` en su último 📌 previo)
   dice *«el borrado del dueño pasa a `PB9`»*; el registro `13-` §4 punto 1 ya señaló que es
   `PB12`. No es de este lote y no lo toqué.

## 5. Vuelve al owner

### A qué mitad y a qué unidad suma el guard 34

E cuenta el control como guard (33 → 34) pero no dice quién lo construye. `DEC-TEST-001` pide que
*«la unidad nazca ANTES o CON lo que el guard vigila»*: la tabla de claves llega con `V1`, el
catálogo con `V6`. Si `V1` agrega la clave que deja a Juan destacar su ficha y el control todavía
no existe, nada avisa si el SQL commiteado no la trae.

1. **`V1`, en verticales (19 de verticales)**. Costo: bajo. Riesgo: bajo; nace con la primera carga
   que vigila. **Recomendada.**
2. **`V6`, en verticales**, con el catálogo. Costo: bajo. Riesgo: medio; entre `V1` y `V6` la tabla
   de claves queda sin control.
3. **`U1`, del paraguas**, como `G8`. Costo: bajo. Riesgo: `U1` no construye nada del diseño nuevo
   salvo el package vacío (`DEC-ARCH-014`), así que contradice su alcance.

## 6. Conteos

- **Decisiones del log**: `rg -o "^### DEC-[A-Z]+-\d+" $D/01-decision-log.md | sort -u | wc -l` →
  **142** (sin cambio).
- **Precisadas sin `SUPERSEDED`**: script sobre el campo *Estado* (precisad/recontad/enmendad/cerrad
  y sin `SUPERSEDED`) → **71** antes y **71** después; `SUPERSEDED` → **12** antes y después. Las
  once que reciben 📌 ya estaban contadas, y `DEC-MIG-002` sigue en `SUPERSEDED EN PARTE`.
- **📌 nuevos**: 11 sobre 11 decisiones.
- **Guards**: 33 → **34** (E), escrito en `nucleo/02` y en los 📌 de `DEC-ARCH-013`, `DEC-TEST-001`
  y `DEC-ARCH-014`.
- **Matriz**: `cd $D && python3 contar-filas-de-la-matriz.py` → **117** = 63 · 16 · 24 · 14 (sin
  cambio).
- **markdownlint** (`npx markdownlint-cli2` sobre los cuatro archivos tocados y este registro): 0
  errores antes, 0 después.
