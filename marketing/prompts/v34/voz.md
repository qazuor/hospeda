# V34 · Tirada de voz — fija, se genera una sola vez

Genera **la pista de audio de todo el video** en una sola tirada. La imagen se
descarta: sólo se usa la voz.

Montaje y hoja de corte: [`montaje.md`](montaje.md).

---

**El guion de V34 no cambia semana a semana** — lo único que varía en cada edición es lo
que se ve en pantalla en T2 (la agenda de esa semana). Por eso esta tirada **se genera
UNA SOLA VEZ, para siempre**, exactamente igual que T1 y T3: es lo que hace posible
armar la edición semanal en veinte minutos, porque la generación con IA queda hecha de
antemano y cada semana solo hace falta grabar la pantalla nueva y montar.

Las tres frases suman **11,2 s hablados** más dos pausas cortas, unos **11,6 s** en
total — bien por debajo del techo de Hailuo. **Se pide 15 s**, el máximo, para no
truncar la última frase.

Usa como cuadro de partida **el fondo 29** (variante base de la rotación), aunque el
video final rote entre 29, 16 y 28: como la imagen se descarta, el fondo elegido acá no
tiene que coincidir con el que se use esa semana en T1 y T3.

| Marcador | Archivo a adjuntar | Veces | Por qué |
|---|:-:|:-:|---|
| `@######VOZ#######` | `../../personaje/voz.wav` | 2 | es lo que clona el timbre |
| `@######ESCENA29#######` | `../../escenas/escena29.png` | 1 | el modo *image to video* exige un cuadro de partida |

**Total: 2 marcadores, 3 apariciones.**

```
FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA29####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
0-18% he speaks the FIRST sentence.
18-21% a SHORT pause.
21-64% he speaks the SECOND sentence.
64-66% a SHORT pause.
66-91% he speaks the THIRD sentence.
91-100% SILENCE until the end.

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace and finishes at 91%. Do not slow it down, do not stretch it to fill the 15 seconds,
and do not insert any pause other than the two short ones listed above.

FIRST sentence: [Spanish] ¿Buscás qué hacer este fin de semana?

SECOND sentence: [Spanish] En Hospeda vamos juntando eventos, fiestas y actividades de
los destinos de Entre Ríos.

THIRD sentence: [Spanish] Entrá, elegí tu destino y fijate qué hay durante tu visita.

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO music, NO
sound effects, NO reverb, NO echo. The voice is recorded close and dry, as if in a quiet
room, and nothing else is audible at any point.
```

**Qué mirar en esta tirada:** que no haya ambiente audible, que la última frase esté
completa, y que el timbre no cambie de punta a punta. Como se usa para siempre, vale la
pena regenerarla las veces que haga falta hasta que salga limpia.

---
