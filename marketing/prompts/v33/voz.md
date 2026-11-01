# V33 · Tirada de voz — regla para la serie

A diferencia de las otras seis carpetas de este lote, V33 **no tiene una tirada de voz
fija**: el guion cambia por edición porque **F2 (los atractivos) tiene largo distinto en
cada destino**. Este documento da la regla para generarla, no un prompt con números ya
cerrados.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

## El texto, con los huecos

El molde completo, tal como vive en
[el plan de videos](../../plan-videos.md#v33--descubrí-un-destino--serie):

> (Destino) tiene mucho más para conocer de lo que entra en una escapada de un día.
>
> (Los tres o cuatro atractivos).
>
> En Hospeda estamos reuniendo toda esa información para que puedas descubrir qué
> visitar y organizar mejor tu viaje.

F1 y F3 son fijas (solo F1 lleva el nombre del destino). F2 la escribe quien arma cada
edición, a partir de las fichas de destino del plan de placas (categoría 8) — ver
[`../../plan-videos.md`](../../plan-videos.md#v33--descubrí-un-destino--serie). Ese
contenido **todavía no está escrito para ningún destino**: es la dependencia que bloquea
toda la serie (ver "Lo que sigue bloqueado" en `montaje.md`).

## Cómo calcular la tirada, por edición

1. **Contar sílabas de las tres frases con el texto real** (nombre del destino incluido
   en F1, atractivos ya redactados en F2), a 5,7 sílabas por segundo, igual que en el
   resto de este lote.
2. **Sumar F1 + F2 + F3 más dos pausas cortas** (~0,2 s cada una). Ese es el total que
   tiene que caber en una sola tirada de Hailuo.
3. **Si el total da 13,5 s o menos**: una sola tirada de voz, con el guion entero,
   pidiendo 15 s (el máximo), igual que en V9 y V31. Escribir el prompt siguiendo
   exactamente la estructura de [`../v9/voz.md`](../v9/voz.md) — tres oraciones con dos
   pausas cortas en el bloque TIMING, `@######VOZ#######` como referencia de timbre y una
   escena de arranque cualquiera del destino (usar `@######ESCENA-DESTINO#######`, la
   misma que T3).
4. **Si el total supera 13,5 s** (probable si F2 lista cuatro atractivos con
   descripción): dividir en **dos tiradas**, cortando en el límite de oración más
   natural — lo más simple es **Tirada A = F1 + F2** y **Tirada B = F3**, igual que se
   resolvió en V35 y V37 de este mismo lote (ver [`../v35/voz.md`](../v35/voz.md) como
   referencia de formato). Cada tirada pide el siguiente incremento de Hailuo por
   encima de lo que necesita, nunca menos.
5. **Las dos tiradas (si hacen falta) usan la misma `@######VOZ#######`** para que el
   timbre no cambie entre F1/F2 y F3, aunque sean generaciones separadas.

## Qué no cambia nunca

- El **timbre** de `@######VOZ#######` es el mismo en las cinco carpetas de este lote y
  en las tiradas de V33: no se clona de nuevo por destino.
- El bloque `SOUND` sigue pidiendo silencio total salvo la voz — sin ambiente del
  destino, aunque el video final sí lleve ambiente de fondo en las tomas T1 y T3 (ese
  ambiente se descarta de la tirada de voz igual que en el resto del lote).
- La regla de **no estirar la locución** para llenar el clip: la entrega es a ritmo
  conversacional y el resto del clip queda en silencio.

---
