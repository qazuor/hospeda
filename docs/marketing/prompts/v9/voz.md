# V9 · Tirada de voz

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**Este es el punto crítico del método.** Si cada toma clona `@######VOZ#######` por su cuenta, el
timbre varía entre toma y toma, y eso se nota mucho más que cualquier corte de imagen:
el oído es implacable con eso.

Entonces: **la voz se genera aparte, de corrido, con el guion entero**, y en edición se
descarta el audio que devuelve Hailuo y se pone esa pista única debajo de todo. Timbre
idéntico en los 20 segundos, garantizado.

**El texto es el de [El diálogo completo](montaje.md#el-diálogo-completo)**, que es el
único lugar donde vive para que no haya dos copias que se desincronicen. Al generarlo, respetar las dos pausas: después de F1 y después de F3.

**Cada toma dice exactamente una frase**, así que alinear la pista es trivial: se hace
coincidir el arranque de cada frase con el arranque del movimiento de boca de su toma.
Por eso los prompts igual piden el diálogo — para que la boca se mueva bien—, aunque
después ese audio se tire.

### De dónde sale la pista: una quinta tirada, sólo por el audio

**La voz de Hospedín no existe fuera de Hailuo.** `voz.wav` son 6,0 s extraídos de la
Toma 1 del V9 original, o sea que también nacieron de una generación. Así que la forma
más segura de conseguir la pista es **pedirle a Hailuo una tirada dedicada** con el
guion entero: mismo motor, mismo timbre que las cuatro tomas, cero herramientas nuevas.

Los números dan: 10,5 s hablados más las dos pausas son ~11,3 s, y el máximo de Hailuo
son 15. **Se pide de 15 s** —no menos— porque lo único que no se puede permitir es que
trunque la última frase; el sobrante se recorta y el video se descarta entero, sólo se
usa el audio.

> **La alternativa es un TTS con clonación de voz** alimentado con `voz.wav`: da control
> fino para regenerar una sola frase sin rehacer todo, y para los 37 videos
> probablemente termine siendo eso, porque escala mejor. Para esta prueba suma una
> herramienta y un riesgo de timbre que todavía no hace falta correr.

**Este prompt va deliberadamente pelado.** Solo se adjuntan dos referencias:

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|---|:-:|---|
| `@######VOZ#######` | `../personaje/voz.wav` | 2 | es lo que clona el timbre. Sin esto no hay nada |
| `@######ESCENA17#######` | `../escenas/escena17.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

`personaje.png`, `poses.png`, `bocas.png` y `expresiones.png` **no van**: definen cómo
se ve, y la imagen de este clip se descarta entera. Si el personaje deriva, da igual.

No es solo economía: **un prompt más corto obedece mejor**. Acá todo se juega en dos
bloques —el `TIMING`, que evita que estire las frases, y el `SOUND`, que saca el
ambiente— y rodearlos de instrucciones sobre la silueta de la cabeza les compite la
atención justo donde no hay que perderla.

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA17####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-20% he speaks the FIRST sentence.
20-23% a SHORT pause.
23-46% he speaks the SECOND sentence.
46-49% a SHORT pause.
49-76% he speaks the THIRD sentence.
76-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 76%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above. There is no
pause inside a sentence: each one is spoken in one flow.

FIRST sentence: [Spanish] En Hospeda no cobramos comisión por cada reserva.

SECOND sentence: [Spanish] Publicás tu alojamiento, el turista te escribe directo,

THIRD sentence: [Spanish] y la reserva, el pago y la relación con tu huésped siguen
siendo tuyos.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO beach sound,
NO water, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room, and nothing else is
audible at any point.
```

**Qué mirar en esta tirada:**

- **Que no haya ambiente audible.** Es lo más probable que desobedezca, porque el fondo
  es una playa. Si trae ruido de fondo, no sirve: al ponerla debajo de las cuatro tomas
  se duplica con el ambiente de cada una. Regenerar antes que intentar limpiarla.
- **Que la última frase esté completa.** Es lo único irrecuperable en edición.
- **Que no haya estirado la locución** para llenar los 15 s. Si las frases suenan
  lentas o con huecos largos entre medio, la pista no sirve para un montaje de cortes.
- **Que el timbre no cambie** entre la primera frase y la última.

---
