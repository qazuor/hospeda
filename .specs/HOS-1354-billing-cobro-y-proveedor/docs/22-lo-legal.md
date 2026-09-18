---
title: Master Spec 22 — Lo que queda en manos de la consulta legal
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
capitulo: 22
cierra:
  - M-LEGAL-01
  - M-LEGAL-02
  - M-LEGAL-03
---

# 22 · Lo que queda en manos de la consulta legal

Mitad **BILLING** del capítulo 22 (`09-master-spec/22-lo-legal.md`).

**Este capítulo no opina sobre derecho.** Es el pliego de la consulta: qué hay que preguntar,
**qué parte del diseño depende de cada respuesta**, y qué cambia si la respuesta no es la que se
asumió.

Los tres huecos se cierran acá **separando dos cosas que venían juntas**:

- lo que es una **pregunta legal** — no se resuelve por analogía ni con una búsqueda web, y queda
  abierta con su riesgo declarado;
- lo que es una **decisión de diseño** que alguien confundió con una legal — ésa se cierra, acá y
  ahora.

---

## 1. Lo que se cierra sin abogado

Tres cosas de los tres huecos son de diseño, y estaban esperando a un abogado que no tenía nada
que decir sobre ellas.

### 1.1 La baja es tan simple como el alta, y eso no depende de la norma

`M-LEGAL-01` pide *«baja online tan simple como el alta, sin gestiones telefónicas»*. **Se
compromete como requisito de diseño, con norma o sin ella:**

**cancelar es self-service, desde Mi Suscripción, en no más pasos que los que costó suscribirse,
sin teléfono, sin formulario de contacto y sin hablar con nadie.** Lo que pasa después ya está
decidido: `DEC-SUB-009` cancela en el proveedor de inmediato y sostiene el servicio hasta el fin
del período pagado.

Que además sea obligatorio es una pregunta legal; que sea **lo correcto** no lo es.

### 1.2 Cómo se prueba que se avisó · la parte de `M-LEGAL-03` que sí cierra

`M-LEGAL-03` termina con lo que de verdad decide un reclamo: *«si un cliente dice que no le
avisaron, lo que vale es la evidencia del envío»*.

**Ya está resuelto por el capítulo 07 (núcleo) y no hacía falta un abogado**: el §44 exige que el
intento de notificación quede registrado, y el outbox guarda destinatario, plantilla, estado,
identificador del proveedor e intentos. La clave de una-sola-vez del capítulo 07 (núcleo) §2 —el
sujeto más el hito, `sub:<id>:aumento:-30d`— hace que **cada aviso sea localizable por lo que
es**, no por una búsqueda de texto.

Y los tres avisos de aumento de `DEC-MP-002` son **transaccionales no suprimibles** (cap. 07
§4.1, núcleo): no los apaga el opt-out ni el tope diario. Un aviso obligatorio que el opt-out
pudiera silenciar no sería evidencia de nada.

**Lo que queda abierto de `M-LEGAL-03` es el PLAZO, no la prueba.**

### 1.3 El canal

**Correo transaccional**, por lo mismo. No una notificación dentro del producto, que no deja
constancia de haber llegado a nadie.

---

## 2. Las tres preguntas legales

### 2.1 ¿El silencio del cliente vale como aceptación de un aumento?

**Es la más pesada, y es estructural.**

| | |
|---|---|
| **qué se asumió** | que sí. `DEC-MP-002` parte 3: llegada la fecha efectiva **el monto se muta automáticamente**; el cliente no acepta nada, puede cancelar antes |
| **en qué se apoya** | es el modelo estándar de la industria, y `PC-3` **`VERIFIED`** midió que el proveedor **no pide un consentimiento nuevo** para mutar el monto |
| **qué NO está verificado** | que eso sea válido en Argentina, que es justo el terreno donde la normativa de consumo suele ser restrictiva |
| **qué cambia si la respuesta es no** | **`DEC-MP-002` cambia de forma, no de redacción.** Haría falta **aceptación activa**, y a quien no responda **no se lo podría aumentar** — o sea que la cartera quedaría partida en dos precios por tiempo indefinido, y todo el diseño de la ventana de 60 días con tres contactos pasaría a ser otra cosa |

**Riesgo declarado y aceptado por el owner (2026-09-16): avanzar así y corregir si la consulta
dice otra cosa.** Y con una condición práctica que conviene repetir: **conviene resolverla antes
de implementar**, porque corregirla después no es editar un texto.

### 2.2 El derecho de revocación: el plazo, la ventana y el botón

`M-LEGAL-01` pide *«derecho de revocación dentro de un plazo legal, sin costo ni justificación,
con devolución de lo pagado»*.

**El mecanismo ya está decidido y medido**, y eso no se reabre: `DEC-RF-001` hace de la revocación
**una sola operación** —reembolso total **más** cancelación—, porque está medido que reembolsar
**no** da de baja y devolverle la plata sin cancelar le hace pagar el mes siguiente. El pedido se
registra y se responde al instante; la plata sale con confirmación humana.

**Lo que queda abierto son tres cosas, y ninguna es el mecanismo:**

1. **Si cada renovación abre una ventana nueva** o si corre una sola vez desde el alta. **Cambia
   el diseño**: en el primer caso cada cobro mensual arrastra su propia ventana de revocación y
   el sistema tiene que saber en cuál está cada suscripción.
2. **El plazo exacto.** La búsqueda propia —fuente oficial, **no una opinión legal**— encontró la
   **Resolución 424/2020** sobre el art. 34 de la Ley 24.240: **10 días corridos**, y **24 horas**
   para informar el código de identificación. Se anota como lo que es: un dato a confirmar, no un
   fundamento.
3. **El botón de arrepentimiento** —visible en el primer acceso de la página de inicio, sin exigir
   registro ni trámite— quedó **fuera de alcance por decisión explícita del owner** hasta
   consultarlo.

> **Riesgo declarado, y es el más filoso de los tres**: no construir el botón **no es una
> funcionalidad faltante — si la norma aplica, es un incumplimiento.** Consultarlo antes de
> construirlo sobre una búsqueda web es razonable; lo que no se puede es olvidarse de que el
> riesgo corre mientras tanto.

---

## 4. El resumen, para llevar a la consulta

| # | pregunta | qué depende | qué pasa si la respuesta es la contraria |
|---|---|---|---|
| 1 | ¿el **silencio** vale como aceptación de un aumento? | `DEC-MP-002` parte 3 | **cambia el diseño**: aceptación activa, y a quien no responda no se lo aumenta |
| 2 | ¿cada renovación abre una **ventana de revocación** nueva? | el diseño de la revocación | **cambia el diseño**: cada cobro arrastra su ventana |
| 3 | ¿cuál es el **plazo** de revocación? (la búsqueda propia dice 10 días corridos) | un número | sólo un número |
| 4 | ¿hace falta el **botón de arrepentimiento**? | está fuera de alcance por decisión del owner | **es un incumplimiento, no una feature faltante** |
| 6 | ¿hay **plazo de preaviso** obligatorio para un aumento? | los 60 días son **decisión comercial**, no normativa | sólo un número, **si es menor a 60** |

**Las seis piden revisión profesional, no una búsqueda web.** Las tres que están en negrita
—1, 2 y 4— cambian diseño o crean incumplimiento; las otras tres cambian un número o una promesa.

---

## Lo que este capítulo NO cierra

- **Las seis preguntas**, por definición. Lo que sí queda cerrado es **qué depende de cada una**,
  que es lo que permite implementar el resto sin esperarlas.
- **El comprobante no fiscal** ya lo decidió `DEC-LEGAL-001` y no se reabre: se emite por cada
  cobro, **nunca se lo llama factura fiscal**, y no tiene fecha ni disparador de revisión hasta
  ARCA.
