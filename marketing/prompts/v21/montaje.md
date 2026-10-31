# V21 · Pagás con Mercado Pago — montaje

Prompts y montaje de **[V21](../../plan-videos.md#v21--pagás-con-mercado-pago)**: una
historia de 15 s armada con **dos tiradas de Hailuo, una grabación de pantalla y la
placa de cierre**.

Usa el **patrón C** — la reacción sin lip sync — sobre el **fondo 17**, primer plano.
Hospedín no habla nunca en cámara: reacciona, y todo el mensaje va en la voz en off y en
el texto en pantalla. La estructura sigue el molde de [V9](../v9/montaje.md).

---

## El diálogo completo

**Esto es lo que se escucha**, en off, de punta a punta. Hospedín nunca mueve la boca
para decir esto: es narración agregada en edición, no diálogo de las tomas.

> Los cobros los maneja Mercado Pago.
>
> Pagás con tarjeta o con plata de tu cuenta, y nosotros no guardamos los datos de tu
> tarjeta.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | Los cobros los maneja Mercado Pago. | T1 | 12 | 2,1 s |
| **F2** | Pagás con tarjeta o con plata de tu cuenta, y nosotros no guardamos los datos de tu tarjeta. | T2 | 30 | 5,3 s |

**Hablado: 7,4 s de 15.** El resto es el beat de reacción final, la grabación de
pantalla y la placa de cierre.

Y lo que se **lee** en pantalla, que no se dice en voz:

| Cuándo | Texto |
|---|---|
| T1 | **Pagás con Mercado Pago.** |
| T2 | subtítulo palabra por palabra de F1 y F2, y el logo de Mercado Pago bien visible |
| T3 | **No guardamos los datos de tu tarjeta.** (refuerzo, sin voz) |
| T4 | **Empezá en hospeda.com.ar** |

> El texto sale del [plan de videos](../../plan-videos.md#v21--pagás-con-mercado-pago) y
> no se cambia acá. Lo que **sí** es decisión de este video: el patrón C, porque la
> tarjeta se pide antes de la prueba y esta duda aparece en el peor momento — reaccionar
> en vez de argumentar baja la guardia mejor que un discurso.

---

## Por qué patrón C acá

**El logo de Mercado Pago es el que hace el trabajo**, no Hospedín. Patrón C —sin lip
sync— dedica el tiempo del plano a que el logo se lea bien en vez de a que la boca se
mueva. Es también el patrón más barato en acciones, así que el plano de reacción puede
sostenerse más tiempo sin que el personaje derive.

**Igual lleva `voz.md`.** Aunque Hospedín no hable en cámara en ninguna toma, la
narración se genera con la misma técnica que el resto de la serie —una tirada aparte,
solo por el audio— para que el timbre sea el mismo Hospedín de siempre.

---

## El fondo

**Fondo 17**, primer plano — el mismo que usa [V9 T1](../v9/t1.md). Es el fondo pensado
para remates, y acá sostiene el video entero: sin pantalla en el plano, sin objeto en la
mano, solo la cara.

---

## El montaje — 15 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–2,5 | 2,5 | Hailuo · `@######ESCENA17#######` | primer plano | duda que se resuelve en un gesto de señalar | *(off)* "Los cobros los maneja Mercado Pago." |
| **T2** | 2,5–8,5 | 6,0 | **grabación · A7** | pantalla completa | checkout con Mercado Pago, logo bien visible | *(off)* "Pagás con tarjeta o con plata de tu cuenta, y nosotros no guardamos los datos de tu tarjeta." |
| **T3** | 8,5–12,0 | 3,5 | Hailuo · `@######ESCENA17#######` | primer plano | encogimiento de hombros y guiño, sin hablar | — (solo música) |
| **T4** | 12,0–15,0 | 3,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, a 120 BPM.

**Ninguna toma de Hospedín tiene diálogo.** T1 y T3 son reacciones puras — sección
`NO DIALOGUE` en los dos prompts —, así que no llevan `BOCAS` ni `VOZ` como referencia:
no hay boca que sincronizar. La narración entera vive en `voz.md` y se pega encima en
edición, igual que en V9, solo que acá **ninguna** toma de personaje está lip-synced.

**Dos tiradas de Hailuo** —T1 y T3—, más **una tercera solo por el audio**
(ver [`voz.md`](voz.md)). T2 es grabación de pantalla y T4 es la placa que ya existe.

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 2,5 | 2,5 | tirada T1 · 4 s | 0,0 → 2,5 | 1,5 |
| **T2** | 2,5 → 8,5 | 6,0 | grabación A7 · checkout MP | a elección | — |
| **T3** | 8,5 → 12,0 | 3,5 | tirada T3 · 4 s | 0,0 → 3,5 | 0,5 |
| **T4** | 12,0 → 15,0 | 3,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** *Los cobros los maneja Mercado Pago.* | 0,00 → 2,10 | 2,1 | T1 | 0,40 |
| **F2** *Pagás con tarjeta o con plata de tu cuenta, y nosotros no guardamos los datos de tu tarjeta.* | 2,70 → 8,00 | 5,3 | T2 | 0,50 |

> F2 no arranca en el mismo instante del corte a T2: la pantalla tiene **0,2 s de
> asentamiento** antes de que la voz retome, para que el corte no se sienta pegado a la
> palabra. Es el mismo criterio que usa V9 en T2→T3.
>
> ⚠️ **La pista de voz NO se pega como un bloque único.** Se corta entre F1 y F2 y cada
> frase se posiciona en su lugar — ver [`voz.md`](voz.md).

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 2,5 | T1 → T2 | primer plano → pantalla completa | medio |
| 8,5 | T2 → T3 | pantalla completa → primer plano | bajo |
| 12,0 | T3 → T4 | primer plano → placa | bajo |

**T1 → T2 es el corte que hay que cuidar.** Es donde el video pasa de "una cara
reaccionando" a "la prueba concreta". El gesto de T1 —señalar hacia el costado— está
puesto ahí a propósito: motiva el corte, como si Hospedín estuviera indicando hacia
donde va a aparecer la pantalla.

### Lo demás

1. **Música desde el frame 1**, instrumental, tranquila y confiable —nada de urgencia:
   el tono de este video es "no hay nada que temer", no "date prisa"—, **120 BPM**.
2. **Tirar el audio de las dos tiradas** y usar solo `voz.md`.
3. **Subtítulos palabra por palabra** durante T1 y T2.
4. **El logo de Mercado Pago tiene que leerse sin ambigüedad** en T2: es el elemento que
   hace el trabajo argumental de todo el video. Si el logo queda chico o tapado por otra
   cosa en pantalla, encuadrar la grabación para que no pase eso, aunque se pierda algo
   de contexto alrededor.
5. **T3 refuerza en texto** lo que la voz ya dijo en T2 ("No guardamos los datos de tu
   tarjeta"), porque es el dato que más ansiedad calma y el video se ve sin sonido.

---

## Qué mirar al revisar las tomas

**Que ninguna de las dos tiradas hable.** Es el riesgo central del patrón C: con una
cara mirando a cámara, lo primero que un modelo inventa es que hable. Si en T1 o T3 se
mueve la boca como si dijera algo, la toma no sirve — hay que volver a pedirla insistiendo
en el bloque `NO DIALOGUE`.

**Que el gesto de T1 termine señalando hacia un costado**, no hacia el centro ni hacia
abajo: es lo que hace que el corte a T2 se sienta motivado.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos.
