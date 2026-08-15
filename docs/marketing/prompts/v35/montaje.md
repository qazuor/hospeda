# V35 · Buscamos editores locales — montaje

Prompts y montaje de **[V35](../../plan-videos.md#v35--buscamos-editores-locales)**: un
corto de 25 s armado con **dos tiradas de Hailuo, una tarjeta de texto y la placa de
cierre**.

Patrón **D** (objeto en la mano — la notebook), fondo **2** (muelle de las islas).

---

## El diálogo completo

> ¿Conocés bien tu ciudad y te gusta recomendar lugares?
>
> Buscamos gente que quiera colaborar como editor de Hospeda, mejorando la información
> de destinos, lugares y eventos.
>
> Queremos contenido con conocimiento local, no escrito desde una oficina a quinientos
> kilómetros.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura |
|:-:|---|:-:|:-:|:-:|
| **F1** | ¿Conocés bien tu ciudad y te gusta recomendar lugares? | T1 | 18 | 3,2 s |
| **F2** | Buscamos gente que quiera colaborar como editor de Hospeda, mejorando la información de destinos, lugares y eventos. | T3 | 41 | 7,2 s |
| **F3** | Queremos contenido con conocimiento local, no escrito desde una oficina a quinientos kilómetros. | T3 | 35 | 6,1 s |

**Hablado: 16,5 s de 25.** El resto es la tarjeta de texto y la placa.

> **"La última frase es el gancho"**, dice el plan — es F3, y es justamente la que
> queda junto a F2 en el mismo plano continuo de T3, sin un corte que la aísle del resto
> de la explicación. Se decidió así porque separarla en una cuarta toma habría exigido
> un segundo fondo que este video no tiene asignado (ver la nota de por qué en
> [`t3.md`](t3.md)); el énfasis igual queda, por el cambio de tono dentro del mismo
> plano.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | **¿Sos de la zona?** |
| T2 | *"Menos oficina. Más territorio."* |
| T3 | subtítulo palabra por palabra de F2 y F3 |
| T4 | **Postulate en hospeda.com.ar** |

---

## El montaje — 25 segundos, 3 cortes

| # | Tiempo | Dura | De dónde sale | Qué pasa | Voz |
|---|---|:-:|---|---|---|
| **T1** | 0,0–3,5 | 3,5 | Hailuo · [`t1.md`](t1.md) | con la notebook, pregunta gancho | *F1* |
| **T2** | 3,5–5,0 | 1,5 | tarjeta de texto fija sobre `escena2.png` | beat visual, sin Hospedín en movimiento | — (solo música) |
| **T3** | 5,0–19,0 | 14,0 | Hailuo · [`t3.md`](t3.md) | con la notebook, explica y remata | *F2 + F3* |
| **T4** | 19,0–25,0 | 6,0 | `placas/final.png` | logo y CTA | — (solo música) |

> **Todos los cortes caen en múltiplos de 0,5 s**, sobre una música a **120 BPM**.

**Mudo con el personaje en cuadro: 0 s de 25** — T1 y T3 llevan su frase cada una.

> **Dos tiradas de Hailuo para imagen** —T1 y T3—, más **dos tiradas aparte sólo por el
> audio** (ver [`voz.md`](voz.md)). T2 no es Hailuo ni grabación: es la misma imagen
> `escena2.png` congelada, con texto superpuesto en edición — no hace falta generar nada
> nuevo.

---

### Por qué T2 existe

Con un solo fondo asignado (2), T1 y T3 comparten el mismo plano si se cortan
directamente una contra la otra — violaría la regla 2 del montaje. T2 resuelve esto sin
generar un segundo fondo: es un respiro gráfico de 1,5 s que además adelanta, en texto,
el argumento que F3 va a cerrar en voz.

### Texto en pantalla

- **T1**: **"¿Sos de la zona?"** grande, entrando en el frame 1.
- **T2**: *"Menos oficina. Más territorio."*
- **T3**: subtítulo palabra por palabra de F2 y F3.
- **T4**: *Postulate en hospeda.com.ar*

Todo el texto va dentro de la zona segura: fuera de los **250 px de arriba, 420 de
abajo y 180 de la derecha** sobre 1080×1920.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 4 s | 3,5 s | la frase son 3,2 s: en menos se corta |
| T3 | 15 s | 14,0 s | las dos frases juntas son 13,6 s: se pide el máximo por seguridad |
| **voz A** (F1) | **4 s** | sólo el audio | la frase son 3,2 s |
| **voz B** (F2+F3) | **15 s** | sólo el audio | ~13,6 s hablados, se pide el máximo |

---

## En edición

### La hoja de corte

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip | Sobra |
|---|---|:-:|---|---|:-:|
| **T1** | 0,0 → 3,5 | 3,5 | tirada T1 · 4 s | 0,0 → 3,5 | 0,5 |
| **T2** | 3,5 → 5,0 | 1,5 | `escena2.png` fija + texto | fijo | — |
| **T3** | 5,0 → 19,0 | 14,0 | tirada T3 · 15 s | 0,0 → 14,0 | 1,0 |
| **T4** | 19,0 → 25,0 | 6,0 | `placas/final.png` | fijo | — |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 3,16 | 3,2 | T1 | 0,34 |
| **F2** | 5,00 → 12,19 | 7,2 | T3 | — (sigue directo en F3) |
| **F3** | 12,39 → 18,53 | 6,1 | T3 | 0,47 |

> ⚠️ **Las dos tiradas de voz NO se pegan como bloque único entre sí.** Tirada A cubre
> F1 y se posiciona en T1; Tirada B cubre F2+F3 y se posiciona en T3.

### Los tres cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 3,5 | T1 → T2 | Hospedín → tarjeta de texto fija | bajo |
| 5,0 | T2 → T3 | tarjeta fija → Hospedín | bajo |
| 19,0 | T3 → T4 | Hospedín → placa | bajo |

T1 y T3 comparten fondo y plano pero no son consecutivas — T2 se interpone —, así que la
regla 2 del montaje sigue cumplida.

### Lo demás

1. **Música desde el frame 1**, instrumental, con energía de convocatoria, **120 BPM**.
2. **Los cortes van sobre el beat.**
3. **Tirar el audio de las dos tiradas de Hailuo** y usar solo las dos tiradas de voz.
4. **Subtítulos palabra por palabra** en T1 y T3.
5. **Nada de transiciones.** Corte seco en los tres.

---

## Qué mirar al revisar las tomas

**Que T1 y T3 arranquen hablando en el frame 1.**

**Que T3 no se sienta apurada** al encadenar F2 y F3 — la segunda frase, el gancho, tiene
que notarse como un cambio de énfasis, no como una continuación plana.

**Que el logo del buzo quede visible** en algún punto de cada toma pese a la notebook
tapando parte del frente — ver la nota `THE LOGO` en cada prompt.

**Que el círculo naranja no se pegue a la cabeza** en ninguna de las dos tomas de
Hailuo.
