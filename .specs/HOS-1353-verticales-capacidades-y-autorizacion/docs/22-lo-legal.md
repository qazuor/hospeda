---
title: Master Spec 22 — Lo que queda en manos de la consulta legal
linear: HOS-1353
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

Mitad **VERTICALES** del capítulo 22 (`09-master-spec/22-lo-legal.md`).

**Este capítulo no opina sobre derecho.** Es el pliego de la consulta: qué hay que preguntar,
**qué parte del diseño depende de cada respuesta**, y qué cambia si la respuesta no es la que se
asumió.

Los tres huecos se cierran acá **separando dos cosas que venían juntas**:

- lo que es una **pregunta legal** — no se resuelve por analogía ni con una búsqueda web, y queda
  abierta con su riesgo declarado;
- lo que es una **decisión de diseño** que alguien confundió con una legal — ésa se cierra, acá y
  ahora.

---

## 2. Las tres preguntas legales

### 2.3 Las señales de identidad: finalidad, plazo, y un conflicto concreto

`DEC-TRIAL-004` decidió que **sólo el correo normalizado** bloquea un trial nuevo, y que
teléfono, identificador fiscal y dispositivo **se registran y alertan pero nunca bloquean**. Su
implicación 2 dejó `M-LEGAL-02` abierto y lo declaró **prerequisito para implementar la parte de
observación**.

Las preguntas son tres —**finalidad declarada**, **plazo de conservación**, y **cómo se responde a
un pedido de acceso o supresión que puede llegar antes de los 180 días del §25**— y la tercera
destapa algo que no es legal sino nuestro. Está en §3.

---

## 3. El conflicto que este capítulo encontró, y la corrección que pide al núcleo

### 3.1 El defecto

Tres piezas que por separado están bien y juntas se anulan:

1. **`DEC-TRIAL-004`**: lo único que bloquea un trial nuevo es **el correo normalizado**.
2. **Capítulo 02 §4.1**: al día 180 se **anonimizan** los datos personales —nombre, **correo**,
   teléfono, dirección—.
3. **Capítulo 02 §4.2, regla 2**: la fila de `trial` **sobrevive** al borrado de la cuenta,
   *«conserva el `user + vertical` y las fechas; lo personal se anonimiza con el resto»*.

**El correo es a la vez el único bloqueo y el primer dato que se anonimiza.** Al día 180 —o antes,
si llega un pedido de supresión— la fila de `trial` sigue ahí y **ya no puede reconocer a nadie**.
La persona se registra de nuevo con la misma dirección y obtiene un trial nuevo.

**Y el capítulo 02 lo dice de frente**: la fila se conserva *«porque el trial no se devuelve, así
que la evidencia de que se consumió tiene que sobrevivir al borrado o el borrado se convierte en
la forma de conseguir otro»*. Eso es exactamente lo que pasa — no por lo que se borra, sino por lo
que se anonimiza.

### 3.2 La corrección

**Se guarda un hash irreversible del correo normalizado, no el correo.**

| | |
|---|---|
| **sirve para lo único que tiene que servir** | comparar un candidato contra lo consumido. `DEC-TRIAL-004` sólo necesita *«¿este correo ya consumió?»*, nunca *«¿cuál era?»* |
| **sobrevive a la anonimización** | no hay nada que anonimizar: no se puede leer de vuelta |
| **no cambia la decisión** | el bloqueo sigue siendo el correo normalizado, con sus mismos puntos y `+alias` |

**El capítulo 02 §4 queda corregido en el mismo commit**: lo que la fila de `trial` conserva es el
`user + vertical`, las fechas y **el hash**, no el correo.

### 3.3 Y esto es lo que hay que preguntarle al abogado, en esta forma

No *«¿cómo declaramos la finalidad?»*, que es una pregunta sin filo, sino:

> **¿Podemos conservar un hash irreversible del correo, después de borrada la cuenta y después de
> un pedido de supresión, con la única finalidad de no otorgar un segundo trial gratuito?**

Es la formulación útil porque tiene dos respuestas y las dos tienen consecuencia escrita:

- **si se puede** — se implementa como §3.2 y `M-LEGAL-02` se cierra declarando finalidad y plazo;
- **si no se puede** — **el trial de por vida deja de ser sostenible tras un borrado**, y eso hay
  que aceptarlo explícitamente. `DEC-TRIAL-004` ya aceptó la mitad de esto en su implicación 1
  —*«se esquiva con una segunda dirección de correo; el trial de por vida del §10.2 queda como
  intención, no como garantía»*—; sería la otra mitad, y **no cambiaría ningún mecanismo**, sólo lo
  que se promete.

---

## 4. El resumen, para llevar a la consulta

| # | pregunta | qué depende | qué pasa si la respuesta es la contraria |
|---|---|---|---|
| 5 | ¿se puede conservar un **hash del correo** tras un borrado, para no regalar un segundo trial? | `DEC-TRIAL-004` y el cap. 02 §4 | no cambia ningún mecanismo: cambia lo que se promete |

---

## Lo que este capítulo NO cierra

- **Las seis preguntas**, por definición. Lo que sí queda cerrado es **qué depende de cada una**,
  que es lo que permite implementar el resto sin esperarlas.
