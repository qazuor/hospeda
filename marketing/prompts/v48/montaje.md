# V48 · Vos ponés el precio, vos contestás, vos decidís — montaje

Prompts y montaje de **V48**, del backlog de solo-personaje:
[`../../plan-videos.md`](../../plan-videos.md#los-35-de-solo-personaje--backlog-aprobado)
— una historia de 11 s armada con **tres tiradas de Hailuo y una tirada sólo por el
audio**. Le habla al **anfitrión**.

Usa el **patrón D** — objeto en la mano, la llave — sobre el **fondo 11**, junto al
alambrado de un autódromo de día. Es puramente solo-personaje: **sin grabación de
pantalla, sin captura**. Molde: [`../v14/montaje.md`](../v14/montaje.md) y
[`../v22/t1.md`](../v22/t1.md) (mismo mecanismo de reemplazo del celular por un objeto
de `acciones.png`).

---

## El diálogo completo

**Hospedín habla en las tres tomas**, con lip sync: tres frases muy cortas, una por
toma, en el mismo ritmo staccato del título. Esto es lo que dice, de punta a punta:

> Vos ponés el precio.
>
> Vos contestás.
>
> Vos decidís.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **S1** | Vos ponés el precio. | T1 | 6 | 1,1 s |
| **S2** | Vos contestás. | T2 | 4 | 0,7 s |
| **S3** | Vos decidís. | T3 | 4 | 0,7 s |

**Hablado: 2,5 s de 11.** Son tres golpes cortos, no una frase larga repartida: el
video es puro ritmo de montaje, con la llave sostenida en alto de punta a punta como
argumento visual mientras las palabras hacen el resto.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **Vos ponés el precio.** |
| T2 | **Vos contestás.** |
| T3 | **Vos decidís.** |
| T4 (placa) | **El alojamiento sigue siendo tuyo.** seguido del logo y **hospeda.com.ar** |

> ⚠️ **Cero precios concretos.** El video habla del control —quién decide, quién
> responde—, nunca de un número ni de una cifra en pesos. Está grounded en
> [`../../plan-videos.md`](../../plan-videos.md) línea 428: "En Hospeda no cobramos
> comisión por cada reserva. Publicás tu alojamiento, el turista te escribe directo, y
> la reserva, el pago y la relación con tu huésped siguen siendo tuyos." **Vos ponés el
> precio** viene de que el anfitrión carga su propio precio en la ficha; **vos
> contestás** viene del contacto directo sin intermediarios; **vos decidís** viene de
> que la relación con el huésped —aceptar, coordinar, cobrar— sigue siendo del
> anfitrión, no de una plataforma que decide por él.

---

## El patrón, el fondo y el objeto

**Patrón D — la llave — sobre el fondo 11**, junto al alambrado perimetral de un
autódromo de día: ningún fondo del 1 al 12 estaba repetido todavía en la serie.

**La llave.** El fondo 11 muestra a Hospedín con un celular vacío en la mano; en las
tres tomas de este video **se reemplaza por la llave** de la pose CON LA LLAVE de
`acciones.png` —una llave de puerta simple, con llavero, sostenida en alto hacia
cámara—, igual que ya hace [V22](../v22/t1.md) con la lamparita sobre el fondo 4. La
llave **es el argumento del video**: mientras el alojamiento siga en manos del
anfitrión, la llave sigue siendo suya — no hace falta decirlo con palabras, alcanza con
sostenerla en alto las tres tomas.

**Tres tomas, la misma llave en alto, cada vez más cerca**: T1 es el encuadre de
establecimiento; T2 se acerca; T3 cierra en primer plano para el remate, con la llave
junto a la cara. Es el mismo recurso de acercamiento progresivo que usa
[V40](../v40/montaje.md), aplicado acá en tres cortes más rápidos por lo corto de cada
frase.

> **La gente del fondo 11 va desenfocada y casi quieta** en las tres tomas —está en la
> lista de fondos con gente de [`../fondos.md`](../fondos.md#dos-cosas-que-se-rompen-al-animar)—:
> las tribunas del autódromo no pueden robarle atención a la llave ni a Hospedín.

---

## El montaje — 11 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–1,5 | 1,5 | Hailuo · `@######ESCENA11#######` | entero (tal cual la referencia) | sostiene la llave en alto, habla, remata con un asentimiento chico | *"Vos ponés el precio."* |
| **T2** | 1,5–3,0 | 1,5 | Hailuo · `@######ESCENA11#######` | medio, más cerca | sigue sosteniendo la llave, la otra mano se toca el pecho, habla | *"Vos contestás."* |
| **T3** | 3,0–5,0 | 2,0 | Hailuo · `@######ESCENA11#######` | primer plano, el más cerrado | la llave junto a la cara, habla el remate, asiente firme y sonríe | *"Vos decidís."* |
| **T4** | 5,0–11,0 | 6,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**, con
> un pulso staccato en los tres primeros cortes que marca cada declaración.

**Tres tiradas de Hailuo** —T1, T2 y T3—, más **una tirada sólo por el audio** (ver
[`voz.md`](voz.md); las tres frases juntas son apenas 2,5 s hablados, muy por debajo del
límite de 15 s de una sola generación).

---

> **De dónde salen estas duraciones.** Sílabas a 5,7 por segundo: S1 son 6 → 1,1 s ·
> S2 son 4 → 0,7 s · S3 son 4 → 0,7 s.

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 1,5 s | la frase son 1,1 s; el resto de la tirada se descarta |
| T2 | 4 s | 1,5 s | la frase son 0,7 s; el resto de la tirada se descarta |
| T3 | 4 s | 2,0 s | la frase son 0,7 s; el resto de la tirada se descarta |
| **voz** | 7 s | S1 + S2 + S3 (2,5 s de habla más dos pausas cortas) | cubre T1, T2 y T3 enteros |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 11,0 s a 120 BPM.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 1,5 | 1,5 | tirada T1 · 4 s | 0,0 → 1,5 | 2,5 |
| **T2** | 1,5 → 3,0 | 1,5 | tirada T2 · 4 s | 0,0 → 1,5 | 2,5 |
| **T3** | 3,0 → 5,0 | 2,0 | tirada T3 · 4 s | 0,0 → 2,0 | 2,0 |
| **T4** | 5,0 → 11,0 | 6,0 | `placas/final.png` | fijo | — |

> **Las tres tomas de Hailuo sobran mucho más de lo habitual**: al pedirse siempre al
> mínimo de 4 s para frases de menos de 1,2 s, el sobrante es grande a propósito — deja
> margen sin tener que pedirle al modelo una frase que no existe.

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **S1** *Vos ponés el precio.* | 0,00 → 1,05 | 1,1 | T1 | 0,45 |
| **S2** *Vos contestás.* | 1,50 → 2,20 | 0,7 | T2 | 0,80 |
| **S3** *Vos decidís.* | 3,00 → 3,70 | 0,7 | T3 | 1,30 |

> **El aire de T3 es más largo que en el resto de la serie (1,30 s) a propósito**: no es
> tiempo vacío, es el asentimiento firme y la sonrisa del remate, descritos en el
> `TIMING` de [`t3.md`](t3.md) — el gesto ocupa ese tramo, no queda quieto sin hacer
> nada.
>
> **La pista de voz sale de una sola tirada** (ver [`voz.md`](voz.md)): las tres frases
> entran juntas y sobran de 7 s de contenido. En edición se corta entre cada una,
> colocándolas en su lugar exacto sobre T1, T2 y T3 — no se pega como bloque único.

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 1,5 | T1 → T2 | entero, llave en alto → medio más cerca, mano al pecho | bajo |
| 3,0 | T2 → T3 | medio → primer plano, remate | bajo |
| 5,0 | T3 → T4 | primer plano → placa | bajo |

**Ningún corte de este video es de riesgo alto**: la llave se mantiene en alto de punta
a punta y el personaje nunca desaparece del cuadro, así que el único cuidado real es que
cada acercamiento se note lo suficiente para no sentirse una repetición — ver la regla 2
del montaje en [`../README.md`](../README.md).

### Lo demás

1. **Música desde el frame 1**, instrumental, con un pulso marcado y staccato en los
   tres primeros cortes —cada declaración cae sobre un golpe—, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las tres tiradas de Hospedín** y usar sólo la pista de voz de
   [`voz.md`](voz.md).
4. **Subtítulos palabra por palabra** en las tres tomas.
5. **Nada de transiciones.** Corte seco en los tres.

---

## Qué mirar al revisar las tomas

**Que la llave se vea igual en las tres tiradas**: mismo tamaño, mismo llavero, sostenida
en el mismo lugar aproximado, tal como la define la pose CON LA LLAVE de `acciones.png`.

**Que las tres tiradas arranquen hablando en el frame 1**, sin respiro ni mirada previa.

**Que el acercamiento entre T1, T2 y T3 se note progresivo y real**, no un salto brusco
ni una repetición del mismo encuadre.

**Que la llave nunca tape la cara, el logo del buzo ni el círculo naranja** en ninguna
de las tres.

**Que la gente de las tribunas quede desenfocada y casi quieta** en las tres tomas.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las tres.

**Que no se mencione ni se muestre ningún precio concreto**, ni en la voz ni en los
textos en pantalla ni en la placa de cierre.
