# V29 · Un fin de semana en Concepción del Uruguay — montaje

Prompts y montaje de **[V29](../../plan-videos.md#v29--un-fin-de-semana-en-concepción-del-uruguay)**:
un **largo de 45 s** armado con **tres tiradas de Hailuo y cinco grabaciones de pantalla
encadenadas**, más la placa de cierre. Publicación.

Es el video que más funciones muestra en un solo recorrido, y el que más grabaciones de
pantalla encadena de todo el lote.

---

## El diálogo completo

Voz en off del [plan de videos](../../plan-videos.md#v29--un-fin-de-semana-en-concepción-del-uruguay),
sin cambios:

> Supongamos que querés pasar un fin de semana en Concepción del Uruguay.
>
> En Hospeda conocés el destino, buscás alojamiento, encontrás dónde comer, qué
> actividades hay, qué eventos coinciden con tu visita y qué lugares visitar.
>
> No se trata solo de encontrar dónde dormir: se trata de organizar todo el viaje.

Repartido en las tomas:

| | Frase | Toma | Sílabas | Dura | Hospedín en cámara |
|:-:|---|:-:|:-:|:-:|:-:|
| **F1** | Supongamos que querés pasar un fin de semana en Concepción del Uruguay. | T1 | 23 | 4,04 s | **sí, habla** |
| **F2a** | En Hospeda conocés el destino, | T2 | 11 | 1,93 s | no — VO sobre la pantalla |
| **F2b** | buscás alojamiento, | T2 | 7 | 1,23 s | no |
| **F2c** | encontrás dónde comer, | T3 | 7 | 1,23 s | no |
| **F2d** | qué actividades hay, | T4 | 7 | 1,23 s | no |
| **F2e** | qué eventos coinciden con tu visita | T5 | 13 | 2,28 s | no |
| **F2f** | y qué lugares visitar. | T6 | 8 | 1,40 s | no |
| **F3** | No se trata solo de encontrar dónde dormir: se trata de organizar todo el viaje. | T7 | 27 | 4,74 s | **sí, habla — remate** |
| — | *(sin voz, cierre)* | T8 | — | ~6,0 s | sí, sin hablar |

**Hablado: 18,08 s de 45 (40%).** Es la proporción más baja de los cinco videos del lote,
y es la correcta para éste: la Oración 2 nombra las cinco secciones en una sola frase
continua, pero **cada cláusula tiene que caer sobre SU pantalla**, así que el peso real
del video está en las cinco grabaciones encadenadas, no en la voz.

> **Por qué alojamiento no tiene pantalla propia.** El guion narra seis paradas (destino,
> alojamiento, gastronomía, actividades, eventos, lugares) pero
> [`grabaciones.md`](../grabaciones.md) sólo etiqueta **cinco** grabaciones para V29 (P7,
> P8, P9, P10, P11) — ninguna de P2 (listado) ni P5 (ficha) menciona este video. La
> lectura que sostiene este montaje: la página de destino (P7) ya incluye alojamientos
> destacados en su recorrido, así que "buscás alojamiento" cae dentro de la misma T2 que
> "conocés el destino", sin necesitar una sexta grabación. Si al filmar P7 no queda claro
> ese tramo, hay que reconsiderar sumar P2 como una sexta toma.

Y lo que se **lee** en pantalla:

| Cuándo | Texto |
|---|---|
| T1 | subtítulo palabra por palabra de F1 |
| T2–T6 | subtítulo palabra por palabra de F2, más un rótulo corto por sección (Destino · Gastronomía · Actividades · Eventos · Lugares) |
| T7 | subtítulo palabra por palabra de F3 |
| T8 | **"Armá tu escapada"** entrando de a poco |
| T9 | **Armá tu escapada en hospeda.com.ar** |

---

## Puesta en escena

**Patrón B · presentador al costado**, fondo **23 · inserto lateral en el palmar**
([`../fondos.md`](../fondos.md#23--inserto-lateral-en-el-palmar--patrón-b)), por
asignación de la tabla [Puesta en escena por video](../../plan-videos.md#puesta-en-escena-por-video):
*"45 s recorriendo cinco secciones."*

**Por qué Hospedín no está generado durante los 45 s enteros.** El patrón B es
deliberadamente el más barato porque *"la grabación puede durar lo que quiera, porque no
depende de la generación"*
([`patrones-de-puesta-en-escena.md`](../patrones-de-puesta-en-escena.md#b--el-presentador-al-costado)).
Hailuo tiene un techo de 15 s por tirada, así que generar 45 s continuos de Hospedín
sosteniendo la pose no es una opción. La resolución: **dos tiradas cortas de Hospedín —
apertura (T1) y cierre (T8)—**, y en el medio la pantalla lleva todo el peso visual con
cinco grabaciones encadenadas sin volver a generar al personaje. Es la aplicación literal
de la ventaja del patrón B, no un atajo: el personaje aparece donde el guion lo necesita
—diciendo la idea y cerrándola— y desaparece exactamente donde el mensaje pasa a ser
"mirá todo esto que se puede hacer."

**El remate (T7) cambia a patrón I · primer plano** sobre `escena17` — la misma
combinación *"cualquiera → I"* que usan V26 y V30.

---

## El montaje — 45 segundos, 8 cortes

| # | Tiempo | Dura | De dónde sale | Plano | Qué pasa | Voz |
|---|---|:-:|---|---|---|---|
| **T1** | 0,0–4,5 | 4,5 | Hailuo · `@######ESCENA23#######` | entero + inserto | señala el rectángulo vacío | *"Supongamos que querés pasar un fin de semana en Concepción del Uruguay."* |
| **T2** | 4,5–8,5 | 4,0 | **grabación** · P7 | pantalla | página de destino, incluye alojamientos destacados | *"En Hospeda conocés el destino, buscás alojamiento,"* |
| **T3** | 8,5–12,5 | 4,0 | **grabación** · P8 | pantalla | gastronomía: listado y ficha | *"encontrás dónde comer,"* |
| **T4** | 12,5–16,5 | 4,0 | **grabación** · P9 | pantalla | experiencias: listado y ficha | *"qué actividades hay,"* |
| **T5** | 16,5–20,5 | 4,0 | **grabación** · P10 | pantalla | agenda de eventos | *"qué eventos coinciden con tu visita"* |
| **T6** | 20,5–24,5 | 4,0 | **grabación** · P11 | pantalla | puntos de interés | *"y qué lugares visitar."* |
| **T7** | 24,5–30,0 | 5,5 | Hailuo · `@######ESCENA17#######` | primer plano | remate, expresión cálida | *"No se trata solo de encontrar dónde dormir: se trata de organizar todo el viaje."* |
| **T8** | 30,0–36,0 | 6,0 | Hailuo · `@######ESCENA23#######` | entero + inserto | gesto de cierre, sostiene, el texto arma el CTA | — (solo música, texto entrando) |
| **T9** | 36,0–45,0 | 9,0 | `placas/final.png` | placa | logo y CTA | — (solo música) |

**Tres tiradas de Hailuo** —T1, T7 y T8—, más **dos tiradas solo por el audio** (ver
[`voz.md`](voz.md)). T2 a T6 son grabación de pantalla y no se generan.

---

## ⚠️ Sobre la regla de plano y las cinco pantallas seguidas

**T2 a T6 son cinco cortes seguidos de "pantalla".** La regla 2 del molde —"dos tomas
seguidas nunca comparten tamaño de plano"— existe para que dos encuadres del PERSONAJE
casi iguales no se lean como error. Acá no aplica de la misma forma: las cinco son
distintas pantallas de la app compuestas dentro del **mismo** rectángulo flotante de
`escena23`, que no cambia de tamaño ni de posición en ningún momento — es, en los hechos,
**un solo plano sostenido con el contenido cambiando adentro**, no cinco planos nuevos.
Es exactamente el "encadenar grabaciones" que describe la tabla de puesta en escena para
este video, y es la razón por la que V29 es "el que más grabaciones de pantalla
encadena": encadenar ES el recurso, no una excepción a disimular.

Donde la regla 2 sí se cumple, y hay que cuidarla, es en los bordes de esa cadena: T1
(cuerpo entero) → T2 (pantalla) y T6 (pantalla) → T7 (primer plano) → T8 (cuerpo entero)
→ T9 (placa). Ahí sí hay cinco cambios de escala reales.

---

## Cómo se recorta cada tirada

| Tirada | Se pide | Se usa | Por qué |
|---|:-:|:-:|---|
| T1 | 6 s | 4,5 s | la frase son 4,04 s |
| T7 | 8 s | 5,5 s | la frase son 4,74 s |
| T8 | 8 s | 6,0 s | cierre sostenido, sin frase que lo acote |
| **voz · parte 1** | **15 s** | sólo el audio | cubre F1 + F2 completa (13,79 s) |
| **voz · parte 2** | **6 s** | sólo el audio | cubre F3 (4,74 s) |

---

## En edición

### La hoja de corte

Todo en segundos, para un montaje de 45,0 s.

| Toma | En la timeline | Dura | Clip fuente | Se usa del clip |
|---|---|:-:|---|---|
| **T1** | 0,0 → 4,5 | 4,5 | tirada T1 · 6 s | 0,0 → 4,5 |
| **T2** | 4,5 → 8,5 | 4,0 | grabación · P7 | a elección |
| **T3** | 8,5 → 12,5 | 4,0 | grabación · P8 | a elección |
| **T4** | 12,5 → 16,5 | 4,0 | grabación · P9 | a elección |
| **T5** | 16,5 → 20,5 | 4,0 | grabación · P10 | a elección |
| **T6** | 20,5 → 24,5 | 4,0 | grabación · P11 | a elección |
| **T7** | 24,5 → 30,0 | 5,5 | tirada T7 · 8 s | 0,0 → 5,5 |
| **T8** | 30,0 → 36,0 | 6,0 | tirada T8 · 8 s | 0,0 → 6,0 |
| **T9** | 36,0 → 45,0 | 9,0 | `placas/final.png` | fijo |

### Dónde cae cada frase de la voz

| Frase | En la timeline | Dura | Cae dentro de | Aire hasta el corte |
|---|---|:-:|:-:|:-:|
| **F1** | 0,00 → 4,04 | 4,04 | T1 | 0,46 |
| **F2a+F2b** | 4,50 → 7,66 | 3,16 | T2 | 0,84 |
| **F2c** | 8,50 → 9,73 | 1,23 | T3 | 2,77 (la pantalla sigue en silencio) |
| **F2d** | 12,50 → 13,73 | 1,23 | T4 | 2,77 (ídem) |
| **F2e** | 16,50 → 18,78 | 2,28 | T5 | 1,72 |
| **F2f** | 20,50 → 21,90 | 1,40 | T6 | 2,60 (ídem) |
| **F3** | 24,50 → 29,24 | 4,74 | T7 | 0,76 |

> ⚠️ **F2c, F2d y F2f dejan bastante más aire que 0,55 s.** No es silencio muerto: cada
> pantalla se sostiene en cuadro después de su palabra clave para que la sección se
> alcance a leer, igual que se explica en la nota de V26/V27. La regla del aire mínimo
> (0,4 s) se respeta en las siete; el máximo de 0,55 es una referencia para diálogo
> hablado, no para un plano de pantalla que sigue mostrando contenido.

### Los ocho cortes, uno por uno

| En | Corte | Qué pasa | Riesgo |
|:-:|---|---|:-:|
| 4,5 | T1 → T2 | cuerpo entero + inserto → pantalla | medio: **entra** a la pantalla |
| 8,5 | T2 → T3 | pantalla → pantalla | bajo, es la cadena deliberada |
| 12,5 | T3 → T4 | pantalla → pantalla | bajo, ídem |
| 16,5 | T4 → T5 | pantalla → pantalla | bajo, ídem |
| 20,5 | T5 → T6 | pantalla → pantalla | bajo, ídem |
| 24,5 | T6 → T7 | pantalla → primer plano | medio: **sale** de la pantalla, la regla 2 se cumple |
| 30,0 | T7 → T8 | primer plano → cuerpo entero + inserto | bajo |
| 36,0 | T8 → T9 | cuerpo entero → placa | bajo |

### Lo demás

1. **Música desde el frame 1**, instrumental, que crece de intensidad hacia T6-T7, 120
   BPM.
2. **Tirar el audio de las tres tiradas de Hailuo**; usar solo la pista de voz.
3. **Subtítulos palabra por palabra**, más un rótulo corto por sección durante T2–T6, para
   que se entienda qué se está mostrando incluso sin sonido.
4. **Nada de transiciones.** Corte seco en los ocho.

---

## Qué mirar al revisar las tomas

**Que el rectángulo de `escena23` quede vacío, plano y quieto** en T1 y T8 — es el punto
más frágil de las dos tiradas.

**Que las cinco grabaciones (P7 a P11) mantengan el mismo tamaño de recuadro** al
componerlas: si una queda más grande o más chica que las otras, la cadena se nota.

**Que T7 arranque hablando en el frame 1** y que el círculo naranja entre completo en el
cuadro.
