---
title: Pliego para la consulta legal
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
---

# Pliego para la consulta legal

> **Documento del programa, no el capítulo 13.** En este programa «el 13» siempre es el capítulo de
> Pagos, que sigue sin escribir. Esto es otra cosa: el texto que el owner lleva al abogado.
>
> **Para quien responde**: no hace falta leer nada más que esto. El §1 da el contexto mínimo y el
> §2 tiene las preguntas, cada una con qué asumimos y qué cambia si la respuesta es la contraria.
> Las preguntas están **numeradas de 1 a 6 igual que en la documentación interna**, para poder
> volcar las respuestas sin traducir nada.

---

## 1. Contexto mínimo

**Qué es.** Hospeda es una plataforma web de alojamientos turísticos y comercios de Concepción del
Uruguay y el Litoral argentino. Opera en Argentina, cobra en pesos y su público es argentino.

**Cómo cobra.** Suscripciones por **débito automático**, a través de **Mercado Pago**, con ciclos
mensual, trimestral, semestral o anual. El cliente autoriza una vez, en el checkout del proveedor,
y a partir de ahí se le cobra solo hasta que cancele.

**Quiénes pagan.** Dos perfiles distintos y eso importa para la respuesta:

| | |
|---|---|
| **anfitriones, gastronómicos, prestadores de experiencias y partners** | publican su ficha en la plataforma. Muchos son personas físicas o monotributistas; algunos, empresas |
| **turistas** | un plan de beneficios para el viajero. Acá el cliente es **inequívocamente un consumidor final** |

**Qué se le entrega hoy por cada cobro.** Un **comprobante no fiscal** — un recibo propio, con su
número correlativo y su PDF. **No es factura** y en ningún texto se lo llama así. La emisión fiscal
está diferida (ver §5).

**Cuánto hay en juego hoy, medido.** Al 2026-09-17, en producción: **8 suscripciones vivas**, de
las cuales **3 tienen un compromiso de cobro vivo**, y **cero pagos cobrados en toda la historia
del sistema**. O sea: **nada de esto está todavía en marcha a escala**, y por eso conviene
preguntar ahora — corregir el diseño cuesta poco, corregirlo con cartera encima cuesta mucho.

**En qué momento llega esta consulta.** El sistema de cobros se está **rediseñando de cero**. Nada
de lo que se pregunta abajo está implementado. Una respuesta que nos obligue a cambiar de forma
hoy es barata; la misma respuesta dentro de un año, no.

---

## 2. Las seis preguntas

### Pregunta 1 — ¿El silencio del cliente vale como aceptación de un aumento de precio?

**Es la más pesada de las seis, y es estructural.**

**Qué asumimos hoy.** Que sí. El diseño avisa el aumento con **60 días de anticipación**, en **tres
contactos** (al anunciar, a 30 días y a 7 días), cada uno con el precio actual, el precio nuevo, la
fecha exacta en que empieza a regir **para ese cliente** y la indicación de que puede cancelar
antes. Llegada la fecha, **el monto se actualiza automáticamente** y se sigue cobrando. El cliente
no firma ni confirma nada: su vía es cancelar.

**En qué nos apoyamos.** Es el modelo corriente de la industria de suscripciones, y el proveedor de
pagos **no exige un consentimiento nuevo** para cambiar el monto de una autorización vigente (está
verificado técnicamente). Los 60 días y los tres avisos son **decisión comercial nuestra**, no algo
que sepamos que la norma exige.

**Qué NO está verificado.** Que eso sea válido en Argentina, que es justamente donde la normativa
de defensa del consumidor suele ser más restrictiva con el consentimiento tácito.

**Qué cambia si la respuesta es NO.** Cambia la forma del mecanismo, no su redacción. Haría falta
**aceptación activa**, y a quien no responda **no se le podría aumentar**: la cartera quedaría
partida en dos precios por tiempo indefinido, y todo el diseño de la ventana de 60 días pasaría a
ser otra cosa. **Es la pregunta cuya respuesta más código cambia.**

**Sub-pregunta, si la respuesta es «sí, pero»**: ¿hay un requisito de forma —medio, antelación
mínima, contenido obligatorio del aviso— que tengamos que cumplir para que ese silencio valga?

---

### Pregunta 2 — ¿Cada renovación abre una ventana de revocación nueva, o corre una sola vez desde el alta?

**Qué asumimos hoy.** No lo asumimos: está abierto, y por eso se pregunta.

**Por qué cambia el diseño.** Si cada cobro mensual arrastra su propia ventana de arrepentimiento,
el sistema tiene que **saber en qué ventana está cada suscripción en cada momento** y exponerlo al
cliente y a soporte. Si corre una sola vez desde el alta, es un dato fijo y no hay nada que seguir.

**Qué ya está decidido y no depende de esta respuesta.** El mecanismo: revocar es **una sola
operación** —reembolso total **más** cancelación—, porque está medido que reembolsar **no** da de
baja la suscripción, y devolverle la plata sin cancelar le haría pagar el mes siguiente. El pedido
se registra y se responde al instante; la plata sale con confirmación de una persona.

---

### Pregunta 3 — ¿Cuál es el plazo exacto del derecho de revocación, y desde cuándo se cuenta?

**Qué encontramos por nuestra cuenta, y necesita confirmación.** Una búsqueda propia —fuente
oficial, **no una opinión legal**— dio la **Resolución 424/2020** sobre el artículo 34 de la Ley
24.240: **10 días corridos**, y **24 horas** para informar el código de identificación de la
operación.

**Se anota como lo que es: un dato a confirmar, no un fundamento.**

**Qué cambia según la respuesta.** Sólo un número. Es la más barata de las seis.

**Sub-pregunta**: ¿el plazo se cuenta desde la contratación, desde el primer cobro, o desde que se
empieza a prestar el servicio? En una suscripción los tres momentos pueden no coincidir.

---

### Pregunta 4 — ¿Hace falta el «botón de arrepentimiento»?

**Qué es.** El enlace visible en el primer acceso de la página de inicio, sin exigir registro ni
trámite previo, que permite revocar la contratación.

**Qué asumimos hoy.** Está **fuera de alcance por decisión explícita del owner** hasta esta
consulta.

**Por qué esta pregunta es distinta de las otras.** Las demás cambian diseño. Ésta cambia **el
tipo** de problema: **no construirlo no es una funcionalidad faltante — si la norma aplica, es un
incumplimiento**, y el riesgo corre mientras tanto.

**Sub-preguntas que necesitamos para construirlo bien si la respuesta es sí**:

1. ¿alcanza a todos nuestros clientes o sólo a los que son consumidores finales? Buena parte de
   nuestros pagadores son comercios que contratan para su actividad;
2. ¿qué tiene que hacer exactamente el botón —iniciar un trámite, o ejecutar la baja—;
3. ¿hay requisitos de ubicación, tamaño o texto?

---

### Pregunta 5 — ¿Podemos conservar un **hash irreversible** del correo tras borrar la cuenta?

**El caso concreto.** Ofrecemos una **prueba gratuita por única vez** por persona. Para no
regalarla dos veces hay que poder contestar *«¿esta dirección de correo ya consumió su prueba?»*.

**El conflicto.** Al borrar una cuenta —o al recibir un pedido de supresión— se anonimizan los
datos personales, **incluido el correo**. Si se anonimiza, la marca de «ya usó su prueba» queda
ahí pero **ya no reconoce a nadie**, y la persona se registra de nuevo con la misma dirección y
obtiene otra prueba gratis. O sea: **el borrado se convierte en la forma de conseguir otra**.

**Lo que proponemos.** Guardar un **hash irreversible** del correo normalizado, no el correo.
Sirve para lo único que tiene que servir —comparar un candidato contra lo ya consumido— y **no se
puede leer de vuelta**: no permite saber cuál era la dirección, ni contactar a nadie, ni
reconstruir el dato.

**La pregunta, en la forma que tiene respuesta:**

> **¿Podemos conservar ese hash después de borrada la cuenta y después de un pedido de supresión,
> con la única finalidad de no otorgar una segunda prueba gratuita?**

**Qué cambia si la respuesta es NO.** **Ningún mecanismo.** Cambia lo que prometemos: la prueba
«por única vez» pasa a ser una intención y no una garantía. Es una consecuencia aceptable, pero hay
que aceptarla a sabiendas.

**Sub-preguntas**: si se puede, ¿qué finalidad hay que declarar y con qué plazo de conservación? Y
¿cómo se responde a un pedido de acceso o supresión ~~que llegue **antes** de los plazos de
retención que ya tenemos definidos (90 y 180 días)~~? **Un dato para contestarla**: los plazos de
retención que tenemos definidos (90 y 180 días) **sólo alcanzan el contenido de las fichas**
—textos, fotos, preguntas frecuentes, horarios—; **los datos de la persona no los borra ni los anonimiza
ningún plazo nuestro** (decisión interna del 2026-09-25). El pedido de supresión llega, entonces,
sobre datos que nuestra retención nunca toca.

---

### Pregunta 6 — ¿Hay un plazo de preaviso obligatorio para un aumento de precio?

**Qué asumimos hoy.** **60 días** con tres contactos. Es una **decisión comercial nuestra**, no una
lectura de la norma.

**Qué cambia según la respuesta.** Sólo un número, **y sólo si el plazo legal fuera menor a 60
días** — en ese caso ya lo estamos cumpliendo de sobra. Si fuera **mayor**, hay que estirarlo.

---

## 3. Cuáles son urgentes y cuáles no

| # | pregunta | qué cambia | urgencia |
|---|---|---|---|
| **1** | el silencio como aceptación | **cambia el diseño** | **alta** — conviene resolverla **antes de implementar**; corregirla después no es editar un texto |
| **2** | ventana de revocación por renovación | **cambia el diseño** | **alta** — define si hay que seguir un estado más por suscripción |
| **4** | botón de arrepentimiento | **es un incumplimiento, no una feature faltante** | **alta** — el riesgo corre hoy |
| 3 | plazo de revocación | un número | media |
| 5 | hash del correo | no cambia ningún mecanismo; cambia lo que se promete | media |
| 6 | plazo de preaviso | un número, y sólo si es mayor a 60 días | baja |

---

## 4. Una séptima pregunta que conviene hacer, aunque no venía en el pliego

**No estaba en la consulta original** —la documentación interna la tiene como decisión tomada y no
reabierta— pero sería raro sentarse con un abogado y no preguntarla, porque **el riesgo crece con
cada cobro y nada va a avisar**:

> **¿Qué obligación de facturación tenemos por estas suscripciones, desde cuándo, y qué expone
> emitir un comprobante no fiscal mientras tanto?**

Hoy se emite un recibo propio por cada cobro, correlativo y sin huecos, que **nunca se llama
factura**. La emisión fiscal está diferida sin fecha. Conviene saber si eso es sostenible y hasta
cuándo.

---

## 5. Qué necesitamos de vuelta

Para poder volcar las respuestas al diseño sin interpretarlas, de cada pregunta necesitamos:

1. **sí o no**, o *«depende de X»* con la X dicha;
2. **la norma en que se apoya**, para poder citarla cuando alguien pregunte por qué el sistema hace
   lo que hace;
3. si hay un **requisito de forma** —plazo, medio, texto obligatorio—, cuál es exactamente;
4. si la respuesta **distingue entre consumidores finales y clientes comerciales**, dónde pasa esa
   línea. Es la distinción que más nos afecta: cobramos a las dos poblaciones con el mismo motor.

---

## 6. Lo que este pliego NO pregunta, a propósito

- **Cómo se implementa nada de esto.** Eso es nuestro.
- **Si el diseño es bueno.** No es materia de la consulta.
- **Nada sobre el proveedor de pagos.** Cuál sea es una decisión abierta nuestra y no cambia
  ninguna de las seis respuestas.
