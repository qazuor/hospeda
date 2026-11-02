/**
 * @file constructor-videos.mjs
 * @description Builds the prompts of the sales videos. Two production modes:
 * - `hailuo`: Hospedín shots generated in Hailuo / MiniMax (image to video), one
 *   voice-only take, real screen recordings, and an edit assembled by Claude Code.
 * - `claude`: motion-graphics tutorials built end to end by Claude Code with the
 *   Remotion pipeline in `marketing/videos/`.
 */

/** Root of the generated marketing assets, outside the repo. */
export const ASSETS = '/home/qazuor/projects/WEBS/marketing';

/** Spoken syllables per second, measured on the V1 voice take (18 syllables = 3.16 s). */
const SYL_PER_SEC = 5.7;
/** Pause between two lines of the voice take, in seconds. */
const PAUSE = 0.35;

const PHONE = `It is a modern Android flagship with a 19.5:9 screen: flat titanium frame, nearly
square corners, thin even bezels and a single tiny round punch-hole camera centred at
the top of the screen. No logos or brand names on it.`;

const KEEP = `KEEP UNCHANGED, exactly as in @######PERSONAJE####### and @######POSES#######: the large
rounded blue head and its silhouette, the green and teal band across the lower part of
the face, the floating orange sphere beside the head and its separation from it, the big
cartoon eyes and black eyebrows, the simple flat mouth from @######BOCAS#######, the
white hooded sweatshirt with its logo — reproduced exactly as @######LOGO#######, the
symbol AND the word hospeda below it — and the compact proportions with a large head and
short limbs. He stays a stylized 3D cartoon at all times and never becomes humanlike.`;

/**
 * Approximates the spoken syllables of a Spanish line.
 * @param {{ text: string }} input
 * @returns {number}
 */
export const syllables = ({ text }) => {
    const spoken = text
        .toLowerCase()
        .replace(/hospeda\.com\.ar/g, 'hospeda punto com punto ar')
        .replace(/[^a-záéíóúüñ\s]/g, ' ');
    const strong = /[aeoáéóíú]/;
    let count = 0;
    for (const word of spoken.split(/\s+/).filter(Boolean)) {
        const groups = word.match(/[aeiouáéíóúü]+/g) || [];
        for (const g of groups) {
            let n = 1;
            for (let i = 1; i < g.length; i += 1) {
                if (strong.test(g[i]) && strong.test(g[i - 1])) n += 1;
            }
            count += n;
        }
    }
    return count;
};

/**
 * Seconds a line takes to say at the measured pace.
 * @param {{ text: string }} input
 * @returns {number}
 */
export const secondsOf = ({ text }) => Math.round((syllables({ text }) / SYL_PER_SEC) * 100) / 100;

const fmt = (n) => n.toFixed(1).replace('.', ',');
const pct = (n) => Math.round(n * 100);
const halfUp = (n) => Math.ceil(n * 2) / 2;

/**
 * Lays the video out on a timeline: each shot gets its duration and its lines.
 * @param {{ video: object }} input
 * @returns {{ shots: Array<object>, total: number }}
 */
export const timelineOf = ({ video }) => {
    let at = 0;
    const shots = video.shots.map((s) => {
        const lines = (s.lines || []).map((i) => ({ i, ...video.lines[i] }));
        const speak =
            lines.reduce((acc, l) => acc + secondsOf(l), 0) + PAUSE * Math.max(0, lines.length - 1);
        const use = s.use || Math.max(1.5, halfUp(speak + 0.6));
        const request = s.source === 'hailuo' ? (use <= 5.5 ? 6 : 10) : null;
        const shot = { ...s, lines, speak, use, request, from: at, to: at + use };
        at += use;
        return shot;
    });
    return { shots, total: at };
};

const refsBlock = ({ shot, video }) => {
    const out = [
        `@######ESCENA####### is the starting point of this video: the same character, the same ${video.sceneDesc} behind him, the same full-body framing and the same light.`,
        '@######PERSONAJE####### and @######POSES####### define exactly how the character looks and his proportions.',
        '@######EXPRESIONES####### defines his facial expressions. @######BOCAS####### defines the mouth shapes he uses when he speaks.',
        '@######ACCIONES####### defines his body poses.',
        '@######LOGO####### is the exact brand logo printed on his sweatshirt: copy it as it is, never redraw it.'
    ];
    if (shot.lines.length)
        out.push('@######VOZ####### is the voice: clone that timbre, that accent and that age.');
    if (shot.screen)
        out.push(
            '@######PANTALLA####### is a real screenshot of a website open in a mobile browser: it is exactly what is displayed on the phone screen, and it must be reproduced faithfully, never redesigned or reinvented.'
        );
    return out.join(' ');
};

/**
 * Prompt of one Hailuo shot (English, the language Hailuo follows best).
 * @param {{ shot: object, video: object }} input
 * @returns {string}
 */
export const hailuoShotPrompt = ({ shot, video }) => {
    const speakFrac = shot.lines.length ? Math.min(0.9, shot.speak / shot.request) : 0;
    const actFrac = shot.lines.length ? speakFrac : Math.min(0.85, (shot.use - 0.3) / shot.request);
    const parts = [
        `FORMAT: 3D animated character film, vertical 9:16, one continuous shot, no cuts, ${shot.request}
seconds. This clip is ONE SHOT INSIDE A LARGER EDIT: only its first ${fmt(shot.use)} seconds will
be used, so the action must happen early and then settle.`,
        `THE REFERENCES: ${refsBlock({ shot, video })}`,
        `OPENING COMPOSITION: ${shot.framing}`,
        `ACTION, IN ORDER: ${shot.lines.length ? 'In the VERY FIRST FRAME he is ALREADY SPEAKING — do not start with a pause, a breath or a look. ' : ''}${shot.action} When the action is over he holds the pose, breathing and blinking. He does not start any new movement.`,
        `TIMING, as fractions of the shot — never as seconds, so it still holds if the clip comes
out longer than requested:
0-${pct(actFrac)}% ${shot.lines.length ? 'he speaks the line(s) below in one flowing delivery while doing the action.' : 'he does the action, with no speech.'}
${pct(actFrac)}-100% he holds the final pose, breathing and blinking, with no new action. No drift, no creeping, no scale change.`
    ];
    if (shot.lines.length) {
        parts.push(
            `DIALOGUE: warm, clear, conversational male Argentine voice from @######VOZ#######, young
adult, moderate pace, close and friendly, not announcer-like. Mouth shapes from
@######BOCAS#######.

The character (S1) faces the camera and says: ${shot.lines.map((l) => `[Spanish] ${l.text}`).join(' ')}`
        );
    } else {
        parts.push(
            'DIALOGUE: none. He does not speak and his mouth stays closed or in a soft smile.'
        );
    }
    if (shot.phone !== false) {
        parts.push(
            `THE PHONE: its shape, proportions and screen aspect ratio are exactly those of the phone
in @######ESCENA#######. Do not reshape it and do not substitute a different phone model.
${PHONE}`
        );
    }
    if (shot.screen) {
        parts.push(
            `THE PHONE SCREEN: it always shows the screen from @######PANTALLA####### — the same layout,
colours, logo and texts, in the same position, sharp and free of glare. Never redesign it
and never invent a generic app screen.`
        );
    }
    parts.push(
        `CAMERA: ${shot.camera || 'locked off, with a very subtle handheld drift. No zoom, no pan.'}`,
        KEEP,
        `SOUND: ${video.ambience}. No music.`
    );
    return parts.join('\n\n');
};

/**
 * Prompt of the voice-only take: one continuous delivery of every line.
 * @param {{ video: object }} input
 * @returns {string}
 */
export const voicePrompt = ({ video }) => {
    const durs = video.lines.map((l) => secondsOf(l));
    const total = durs.reduce((a, b) => a + b, 0) + PAUSE * (durs.length - 1);
    let at = 0;
    const timing = [];
    const ords = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH'];
    durs.forEach((d, i) => {
        const a = at / 15;
        at += d;
        timing.push(`${pct(a)}-${pct(at / 15)}% he speaks the ${ords[i]} sentence.`);
        if (i < durs.length - 1) {
            timing.push(`${pct(at / 15)}-${pct((at + PAUSE) / 15)}% a SHORT pause.`);
            at += PAUSE;
        }
    });
    timing.push(`${pct(total / 15)}-100% SILENCE until the end.`);
    return `FORMAT: vertical 9:16, one continuous shot, no cuts, 15 seconds.

THIS CLIP IS GENERATED FOR ITS AUDIO ONLY. The picture will be thrown away; the only
thing that will be kept is the spoken voice track. Every instruction below exists to
produce one thing: a clean, continuous, uninterrupted recording of the character
speaking. Nothing about how the picture looks matters.

THE VOICE: @######VOZ####### is the voice. Clone that timbre, that accent and that age
exactly, and keep it identical from the first word to the last. Warm, clear,
conversational male Argentine voice, young adult, moderate pace, close and friendly,
not announcer-like.

THE PICTURE: start from @######ESCENA####### and simply keep the character facing the
camera, speaking, for the whole clip. Locked-off camera, no zoom, no pan, no cuts.

ACTION: He speaks the whole script straight through to the camera in a single continuous
delivery. He is ALREADY SPEAKING in the very first frame — no breath, no look, no pause
before the first word. When he has finished the last word he stops speaking completely
and stays silent until the clip ends.

TIMING, as fractions of the shot — THIS IS THE MOST IMPORTANT PART OF THIS PROMPT:
${timing.join('\n')}

DO NOT SPREAD THE SPEECH ACROSS THE CLIP. The delivery is at a normal conversational
pace. Do not slow it down, do not stretch it to fill the 15 seconds, and do not insert
any pause other than the short ones listed above.

${video.lines.map((l, i) => `${ords[i]} sentence: [Spanish] ${l.text}`).join('\n\n')}

SOUND — THIS IS CRITICAL: the ONLY sound in this clip is his speaking voice, the one
cloned from @######VOZ#######. Complete silence otherwise. NO ambience, NO outdoor
sound, NO wind, NO birds, NO background noise, NO music, NO sound effects, NO reverb,
NO echo. The voice is recorded close and dry, as if in a quiet room.`;
};

const LOGO_RULE = `EL LOGO: antes de armar el cierre, y otra vez antes de cada render nuevo o de cada
corrección, pedime el logo. Usá exactamente el archivo que te pase (por defecto
apps/web/src/assets/images/logo.webp): sin redibujarlo, sin recolorearlo, sin
deformarlo y sin vectorizarlo a mano.`;

const CONTENT_RULES = `REGLAS DE CONTENIDO (no se negocian):
- Cero precios en pantalla y en la voz.
- Nada que no exista como si funcionara; lo que viene dice «Próximamente».
- Pantallas reales de Hospeda, grabadas con una cuenta del seed, nunca con super admin.
- Ningún destino por encima de otro; sin cupones; sin métricas ni testimonios inventados.
- Airbnb, Booking y Google se nombran sólo en calendario y reputación, nunca con su logo.
- Voseo rioplatense en todo el texto.`;

/**
 * Prompt for Claude Code that assembles a Hailuo video in Remotion.
 * @param {{ video: object }} input
 * @returns {string}
 */
export const editPrompt = ({ video }) => {
    const { shots, total } = timelineOf({ video });
    const sheet = shots
        .map(
            (s) =>
                `| ${s.id} | ${fmt(s.from)} → ${fmt(s.to)} | ${fmt(s.use)} | ${s.source === 'hailuo' ? `tirada ${s.id} · ${s.request} s, se usa 0,0 → ${fmt(s.use)}` : s.source === 'grabacion' ? `grabación ${s.recording}` : 'cierre en Remotion'} | ${s.lines.map((l) => `«${l.text}»`).join(' ') || '—'} |`
        )
        .join('\n');
    return `Armá en Remotion el video de venta ${video.id} · «${video.name}» (${fmt(total)} s).

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md, marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. Usá la composición
src/a1/ como molde. Trabajá en un worktree cortado de staging; lo generado (tomas,
audio, renders) vive en ${ASSETS}/video-lab/, nunca en el repo.

MATERIAL QUE TE PASO en ${ASSETS}/video-lab/ventas/${video.id.toLowerCase()}/:
${shots
    .filter((s) => s.source === 'hailuo')
    .map((s) => `- ${s.id.toLowerCase()}.mp4: la tirada ${s.id} de Hailuo.`)
    .join('\n')}
- voz.mp4: la tirada de voz. Usá SOLO su audio; tirá el audio de las demás tiradas.

${
    shots.some((s) => s.source === 'grabacion')
        ? `GRABACIÓN: la grabás vos con el grabador de marketing/videos, con el dispositivo de
referencia (config/device.ts) y la puesta en escena de demo (DEMO_HIDE_CSS).
${shots
    .filter((s) => s.source === 'grabacion')
    .map((s) => `- ${s.id}: ${s.recording}. ${s.recordingHow}`)
    .join('\n')}

`
        : ''
}HOJA DE CORTE (cortes secos, en múltiplos de 0,5 s):
| Toma | En la timeline | Dura | De dónde sale | Voz |
|---|---|:-:|---|---|
${sheet}

LA VOZ: la pista es una sola tirada; cortala entre frases y ubicá cada frase en su toma.

TEXTOS EN PANTALLA (exactos, Geologica para títulos, Roboto para el resto):
${video.onScreen.map((t) => `- ${t}`).join('\n')}

EL CIERRE (${fmt(shots[shots.length - 1].use)} s): logo que entra, «${video.cta}» palabra por palabra, píldora
hospeda.com.ar${video.badge ? ' y la insignia «30 días de prueba gratis · Sin tarjeta»' : ''}. Fondo con las colinas de A1.

${LOGO_RULE}

MÚSICA Y SONIDO: la base sintetizada de tools/audio, con acento en cada corte de toma.
Subtítulos palabra por palabra dentro de la zona segura. Audio a -14 LUFS.

${CONTENT_RULES}

ENTREGA: render 1080×1920, 30 fps, en ${ASSETS}/video-lab/out/${video.id.toLowerCase()}.mp4. Un render
por vez: después del primero esperá mis correcciones. El sonido lo valido yo.`;
};

/**
 * Prompt for Claude Code that builds a motion-graphics tutorial end to end.
 * @param {{ video: object }} input
 * @returns {string}
 */
export const claudePrompt = ({
    video
}) => `Hacé en Remotion el video de venta ${video.id} · «${video.name}» (${video.length}).

PARA QUIÉN: ${video.para}.
LA IDEA: ${video.idea}

ANTES DE EMPEZAR, leé: marketing/videos/REGLAS.md (todas sus reglas valen: formato,
dispositivo de referencia, nivel estudio, sonido), marketing/videos/README.md,
marketing/personaje-hospedin.md y marketing/prompts/grabaciones.md. La composición
src/a1/ es el molde: intro → tutorial → cierre. Trabajá en un worktree cortado de
staging; lo generado vive en ${ASSETS}/video-lab/, nunca en el repo.

GRABACIÓN (pantallas reales, vista mobile del dispositivo de referencia):
- Cuenta: ${video.account}.
- Qué grabar: ${video.recording}
${video.recordSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
- Escribí el grabador como record/record-${video.id.toLowerCase()}.mts, siguiendo record-a1.mts
  (eventos con su caja en pantalla, scroll suave, DEMO_HIDE_CSS).

GUION:
- Intro (2,2 s): «${video.intro}» palabra por palabra, con Hospedín grande.
${video.stages.map((s, i) => `- Etapa ${i + 1} · chip «${i + 1}/${video.stages.length} · ${s.chip}»: Hospedín entra y dice «${s.says}». ${s.show}`).join('\n')}
- Cierre (4 s): logo, «${video.cta}» palabra por palabra, píldora hospeda.com.ar${video.badge ? ', insignia «30 días de prueba gratis · Sin tarjeta»' : ''}, Hospedín festejando (pose vamos).

${LOGO_RULE}

${CONTENT_RULES}
${video.extraRules ? `${video.extraRules.map((r) => `- ${r}`).join('\n')}\n` : ''}
ENTREGA: render 1080×1920, 30 fps, en ${ASSETS}/video-lab/out/${video.id.toLowerCase()}.mp4. Antes de
grabar, mostrame el guion con los tiempos. Un render por vez: después del primero esperá
mis correcciones. El sonido lo valido yo.`;

/**
 * Every prompt of a video, in the order they are used.
 * @param {{ video: object }} input
 * @returns {Array<{ label: string, text: string, attach?: Array<string> }>}
 */
export const promptsOf = ({ video }) => {
    if (video.mode === 'claude')
        return [{ label: 'Prompt para Claude Code', text: claudePrompt({ video }) }];
    const { shots } = timelineOf({ video });
    const base = (shot) => [
        `@######ESCENA####### → ${ASSETS}/escenas/${video.scene}.png`,
        `@######PERSONAJE####### → ${ASSETS}/personaje/personaje.png`,
        `@######POSES####### → ${ASSETS}/personaje/poses.png`,
        `@######EXPRESIONES####### → ${ASSETS}/personaje/expresiones.png`,
        `@######BOCAS####### → ${ASSETS}/personaje/bocas.png`,
        `@######ACCIONES####### → ${ASSETS}/personaje/acciones.png`,
        '@######LOGO####### → apps/web/src/assets/images/logo.webp (otra vez en cada tirada)',
        ...(shot.lines.length ? [`@######VOZ####### → ${ASSETS}/personaje/voz.wav`] : []),
        ...(shot.screen ? [`@######PANTALLA####### → ${shot.screen}`] : [])
    ];
    const out = shots
        .filter((s) => s.source === 'hailuo')
        .map((s) => ({
            label: `Hailuo · tirada ${s.id} (se pide ${s.request} s, se usa ${fmt(s.use)} s)`,
            text: hailuoShotPrompt({ shot: s, video }),
            attach: base(s)
        }));
    out.push({
        label: 'Hailuo · tirada de voz (15 s, sólo el audio)',
        text: voicePrompt({ video }),
        attach: [
            `@######VOZ####### → ${ASSETS}/personaje/voz.wav`,
            `@######ESCENA####### → ${ASSETS}/escenas/${video.scene}.png`
        ]
    });
    out.push({ label: 'Montaje · prompt para Claude Code', text: editPrompt({ video }) });
    return out;
};
