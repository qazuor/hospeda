# V32 · Compará antes de decidir — montaje

Prompts y montaje de **[V32](../../plan-videos.md#v32--compará-antes-de-decidir)**: un
corto de 20 s armado con **dos tiradas de Hailuo y una grabación de pantalla que ocupa
más de la mitad del video**.

Patrón **B** (presentador al costado), fondo **23** (inserto en el palmar). Es el patrón
que menos le pide al modelo y el que más tiempo de pantalla permite — clave acá, porque
**la tabla comparativa completa es el argumento del video**.

---

## El diálogo completo

> Tres alojamientos, una sola pantalla.
>
> Compará precio, capacidad y comodidades sin abrir cinco pestañas.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Tres alojamientos, una sola pantalla. | T1 | 13 | 2,3 s |
| **F2** | Compará precio, capacidad y comodidades sin abrir cinco pestañas. | T2 | 23 | 4,0 s |

**Hablado: 6,3 s de 20.** El resto es la pantalla sosteniendo la tabla y la placa.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **Compará antes de decidir.** |
| T2 | subtítulo palabra por palabra de F2, y después nada — la tabla habla sola |
| T4 | **Probalo en hospeda.com.ar** |

---

## El montaje — 20 segundos, 3 cortes

A diferencia de V9 y V31, acá **no hay inserto compuesto dentro de un recuadro chico**:
en T1 el rectángulo gris queda vacío tal como pide el patrón B, pero la grabación real
(T2) se muestra a **pantalla completa** — la regla del patrón B dice que el inserto
"puede durar lo que quiera", y una tabla comparativa a 311 px de ancho no se lee (ver
[`../grabaciones.md`](../grabaciones.md)). El corte de T1 a T2 es un **zoom hacia el
rectángulo** (una de las cinco transiciones permitidas por el plan) hasta que ese
rectángulo llena el cuadro y se revela la pantalla real.

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–2,5 | 2,5 | Hailuo · `@######ESCENA23#######` | entero con inserto | señala el rectángulo vacío | *"Tres alojamientos, una sola pantalla."* |
| **T2** | 2,5–14,5 | 12,0 | **grabación** P13 | pantalla completa | se agregan tres alojamientos al comparador y aparece la tabla | *"Compará precio, capacidad y comodidades sin abrir cinco pestañas."* (arranca al inicio de T2, el resto de la toma sostiene la tabla en silencio) |
| **T3** | 14,5–17,0 | 2,5 | Hailuo · `@######ESCENA23#######` | entero con inserto | vuelve a cámara, asiente conforme | — (sin diálogo, solo música) |
| **T4** | 17,0–20,0 | 3,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Mudo con el personaje en cuadro: 2,5 s de 20 (12,5%)** — es T3, la única sin lip sync.

> **Dos tiradas de Hailuo para imagen** —T1 y T3—, más **una tercera sólo por el
> audio** (ver [`voz.md`](voz.md)). T2 es la grabación P13 ("Comparador: agregar 3 y la
> tabla", acción) y T4 es la placa que ya existe.

---

### Por qué T2 dura 12 de los 20 segundos

Es la decisión central de este montaje. El plan dice explícitamente: **"la tabla
completa es el argumento: que se vea clara y se entiendan las diferencias."** Una tabla
con tres columnas de precio, capacidad y comodidades necesita tiempo de lectura real, no
solo el tiempo de la frase que la presenta. Por eso F2 se dice en los primeros ~4 s de
T2 y **el resto de la toma —unos 7,6 s— sostiene la tabla en silencio**, con música de
fondo, dando lugar a que el espectador la lea sin apuro. Es exactamente lo que el
patrón B habilita y lo que distingue a este video de uno con inserto chico: acá la
pantalla completa **es** el video durante más de la mitad de su duración.

### Texto en pantalla

- **T1**: **"Compará antes de decidir."** grande, entrando en el frame 1.
- **T2**: subtítulo palabra por palabra de F2 en los primeros segundos; después se
  retira y queda solo la tabla, sin texto superpuesto que la tape.
- **T4**: *Probalo en hospeda.com.ar*

Todo el texto va dentro de la zona segura: fuera de los **250 px de arriba, 420 de
abajo y 180 de la derecha** sobre 1080×1920.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 2,5 s | la frase son 2,3 s: en menos se corta |
| T3 | 4 s | 2,5 s | es una reacción sin frase, el mínimo alcanza y sobra |
| **voz** | **8 s** | sólo el audio | el guion entero son ~6,5 s: se pide el siguiente incremento disponible |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 2,5 | 2,5 | tirada T1 · 4 s | 0,0 → 2,5 | 1,5 |
| **T2** | 2,5 → 14,5 | 12,0 | grabación P13 · comparador | a elección | — |
| **T3** | 14,5 → 17,0 | 2,5 | tirada T3 · 4 s | 0,0 → 2,5 | 1,5 |
| **T4** | 17,0 → 20,0 | 3,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 2,28 | 2,3 | T1 | 0,22 |
| **F2** | 2,50 → 6,54 | 4,0 | T2 | — (T2 sigue 7,96 s más en silencio) |

> ⚠️ **La pista de voz NO se pega como un bloque único.** F1 y F2 se cortan por
> separado de la tirada de voz y se posicionan cada una en su lugar.

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 2,5 | T1 → T2 | **zoom hacia el rectángulo**, entra en la pantalla real | **alto** |
| 14,5 | T2 → T3 | **sale** de la pantalla, vuelve al personaje | medio |
| 17,0 | T3 → T4 | plano entero con inserto → placa | bajo |

**T1 → T2 · el riesgo es la transición en sí.** Es la única de las siete videos de este
lote que no usa corte seco puro: usa el "zoom hacia un objeto que ya está en escena"
permitido por las reglas de producción. Tiene que sentirse motivado — el rectángulo ya
está ahí desde el frame 1 de T1, señalado, así que el zoom hacia adentro se lee como
"entramos a esa pantalla", no como un efecto gratuito. Si el zoom se siente artificial,
la alternativa es un corte seco directo de T1 a T2 a pantalla completa, sacrificando la
continuidad espacial del recuadro.

**T2 → T3 · el riesgo es que se sienta un regreso brusco** después de 12 s inmerso en la
tabla. Por eso T3 no repite información: es puramente una reacción de cierre, corta y
sin pretensión de agregar nada nuevo.

### Lo demás

1. **Música desde el frame 1**, instrumental, tranquila, **120 BPM**.
2. **Los cortes van sobre el beat**, salvo el zoom de entrada a T2, que puede
   extenderse un poco más allá del pulso exacto porque es una transición, no un corte
   seco.
3. **Tirar el audio de las dos tiradas** y usar solo la pista de voz.
4. **Subtítulos palabra por palabra** solo mientras se habla; se retiran para que la
   tabla quede legible sin superposición.
5. **Sin transiciones vistosas.** El único movimiento permitido es el zoom de entrada a
   T2; todo lo demás es corte seco.

---

## Lo que sigue bloqueado

**T2 necesita la grabación P13** ("Comparador: agregar 3 y la tabla", acción — ver
[`../grabaciones.md`](../grabaciones.md)), de una sola toma, sin cortes, con una cuenta
de turista real.

---

## Qué mirar al revisar las tomas

**Que el rectángulo de T1 y T3 quede vacío y quieto.**

**Que arranque hablando en el frame 1** en T1.

**Que la tabla, en T2, se vea completa y legible** en algún momento del recorrido — si
la grabación corta la tercera columna fuera de cuadro, no sirve como argumento.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos tomas de
Hailuo.
