/**
 * @file generar.mjs
 * @description Writes one Markdown file per sales piece under
 * `marketing/prompts/ventas/<carpeta>/` and, when given a path, a JSON with
 * every piece and its prompt for the prompts artifact.
 *
 * Usage: node marketing/prompts/ventas/_generador/generar.mjs [json-out]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachmentsOf, buildPrompt, filesToAttachOf } from './constructor.mjs';
import { ASSETS, promptsOf, secondsOf, timelineOf } from './constructor-videos.mjs';
import { ALOJAMIENTOS } from './datos-alojamientos.mjs';
import { COMER_Y_SALIR } from './datos-comer-y-salir.mjs';
import { ALIADOS, EXPERIENCIAS } from './datos-experiencias-aliados.mjs';
import { TRANSVERSAL } from './datos-transversal.mjs';
import { VIDEOS_CLAUDE, VIDEOS_HAILUO } from './datos-videos.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Groups in display order. */
export const GROUPS = [
    { id: 'transversal', name: 'Para todas las verticales', pieces: TRANSVERSAL },
    { id: 'alojamientos', name: 'Alojamientos', pieces: ALOJAMIENTOS },
    { id: 'comer-y-salir', name: 'Comer y salir', pieces: COMER_Y_SALIR },
    { id: 'experiencias', name: 'Experiencias', pieces: EXPERIENCIAS },
    { id: 'aliados', name: 'Aliados', pieces: ALIADOS }
];

/** Hand-written text pieces, copied as-is into the artifact. */
const TEXT_PIECES = [
    {
        id: 'T9',
        name: 'Kit del vendedor',
        para: 'Los vendedores (interno)',
        tipo: 'Texto',
        title: 'Perfiles, qué mandar, qué no prometer y objeciones',
        fileName: 't9-kit-del-vendedor.md'
    },
    {
        id: 'T10',
        name: 'Plantillas de mensajes',
        para: 'Los vendedores',
        tipo: 'Texto',
        title: 'WhatsApp, Instagram, email y firma',
        fileName: 't10-plantillas-de-mensajes.md'
    }
];

const README_HEAD = `# Material de venta — prompts

Prompts para generar con **ChatGPT** (el custom GPT de Hospeda) las piezas que usan los
vendedores por WhatsApp, Instagram y mail. Plan de origen: la conversación del 01/11/2026
(kit transversal + una sección por vertical + aliados).

> **No edites los \`.md\` de las piezas a mano.** Salen de \`_generador/\`: cambiá los datos
> ahí y corré \`node marketing/prompts/ventas/_generador/generar.mjs\`. Este README también se
> regenera.

## Cómo se usa

1. **Un chat nuevo por pieza.** Pegá el prompt entero y adjuntá lo que dice «Qué adjuntar».
2. **El logo, siempre:** \`apps/web/src/assets/images/logo.webp\`. Antes de cada imagen
   nueva (otra página, otra placa, otro formato o una corrección), el prompt hace que
   ChatGPT te lo pida de nuevo. Adjuntalo cada vez: si no, el logo se deforma.
3. **Hospedín**, cuando la pieza lo lleva: \`marketing/Hospedin.png\` y las guías del
   personaje (\`marketing/personaje-hospedin.md\`).
4. **Carruseles y PDF:** se genera una imagen por vez. Escribí «siguiente» para la próxima.
   Las páginas de los PDF salen como imágenes 2:3; el PDF lo armás vos después.
5. **Capturas:** las piezas que muestran la plataforma llevan una captura real, sacada con
   una cuenta de anfitrión (nunca la de super admin). Si no la adjuntás, la pantalla queda
   como un rectángulo con la palabra CAPTURA para pegarla después: ChatGPT no inventa la
   interfaz.

6. **Videos** (\`videos/\`): los \`VH\` se hacen con Hailuo (una tirada por toma, el logo
   adjunto otra vez en cada una, más una tirada solo para la voz) y el montaje lo arma
   Claude Code; los \`VC\` los hace Claude Code de punta a punta en Remotion. En los dos,
   Claude pide el logo antes del cierre y antes de cada render o corrección.

## Reglas de todo el kit

- **Cero precios**, salvo en la hoja de precios (T6), que se rehace con los valores del día.
- **Nada que no exista** como si funcionara: lo que viene lleva «Próximamente».
- **Sin métricas inventadas** ni testimonios inventados.
- **Ningún destino por encima de otro**; nunca la lista completa.
- **Sin cupones.**
- **Airbnb, Booking y Google** se nombran solo en calendario y reputación, nunca con su logo.
  En la importación de fichas se dice «Google, Mercado Libre y otras plataformas».
- La insignia dice «30 días de prueba gratis · Sin tarjeta», igual que los flyers de venta.

## Piezas
`;

const README_TAIL = `
### Textos (no son imágenes)

| Pieza | Para quién |
|---|---|
| [T9 · Kit del vendedor](textos/t9-kit-del-vendedor.md) | Los vendedores: perfiles, qué mandar, qué no prometer, objeciones |
| [T10 · Plantillas de mensajes](textos/t10-plantillas-de-mensajes.md) | WhatsApp, Instagram, email y firma |
`;

/**
 * Renders the Markdown file of one piece.
 * @param {{ piece: object, group: object }} input
 * @returns {string}
 */
const renderPiece = ({ piece, group }) => {
    const units = piece.pages || piece.slides;
    const lines = [
        `# ${piece.id} · ${piece.name}`,
        '',
        `Material de venta · ${group.name}. Índice en [\`../README.md\`](../README.md).`,
        '',
        'Prompt para **ChatGPT** (el generador de imágenes del custom GPT de Hospeda).',
        '',
        '---',
        '',
        `- **Para quién:** ${piece.para}`,
        `- **Tipo:** ${piece.tipo}`,
        `- **Formatos:** ${piece.formats.join(' y ')}${piece.pages ? ' (una imagen por página; el PDF se arma después)' : ''}`,
        `- **Insignia de prueba gratis:** ${piece.badge ? 'sí' : 'no'}`
    ];
    if (piece.prioridad5) lines.push('- **Prioridad 5:** no se genera todavía.');
    lines.push('', '**Qué adjuntar:**', '', ...filesToAttachOf(piece).map((a) => `- ${a}`));
    if (units) {
        lines.push(
            '',
            `**Cómo se genera:** una ${piece.pages ? 'página' : 'placa'} por vez, en el mismo chat. Después de la primera, escribí «siguiente»; antes de cada imagen nueva te va a pedir el logo otra vez.`
        );
    } else if (piece.formats.length > 1) {
        lines.push(
            '',
            `**Cómo se genera:** primero ${piece.formats[0]}; después pedile «ahora en ${piece.formats.slice(1).join(' y después en ')}». Antes de cada formato te va a pedir el logo otra vez.`
        );
    }
    for (const n of piece.notes || []) lines.push('', `> **${n.label}:** ${n.text}`);
    lines.push('', '````', buildPrompt(piece), '````', '');
    return lines.join('\n');
};

const fmt = (n) => n.toFixed(1).replace('.', ',');

/**
 * Renders the Markdown file of one sales video.
 * @param {{ video: object }} input
 * @returns {string}
 */
const renderVideo = ({ video }) => {
    const hailuo = video.mode === 'hailuo';
    const lines = [
        `# ${video.id} · ${video.name}`,
        '',
        `Video de venta · ${video.vertical}. Índice en [\`../README.md\`](../README.md).`,
        '',
        hailuo
            ? 'Se hace con **Hailuo / MiniMax** (*image to video*) para las tomas de Hospedín, una tirada solo para la voz, grabaciones reales y un **montaje que arma Claude Code** en Remotion.'
            : 'Lo hace **Claude Code** de punta a punta con el pipeline de Remotion de `marketing/videos/`.',
        '',
        '---',
        '',
        `- **Para quién:** ${video.para}`,
        '- **Formato:** vertical 9:16, 1080×1920, para WhatsApp e Instagram',
        `- **Insignia de prueba gratis:** ${video.badge ? 'sí, en el cierre' : 'no'}`
    ];
    if (hailuo) {
        const { shots, total } = timelineOf({ video });
        lines.push(
            `- **Duración:** ${fmt(total)} s`,
            '',
            '## Lo que se escucha',
            '',
            '| Frase | Toma | Dura (aprox.) |',
            '|---|:-:|:-:|',
            ...video.lines.map(
                (l, i) =>
                    `| ${l.text} | ${shots.find((s) => (s.lines || []).some((x) => x.i === i))?.id ?? '—'} | ${fmt(secondsOf(l))} s |`
            ),
            '',
            '## El montaje',
            '',
            '| Toma | Tiempo | De dónde sale |',
            '|---|---|---|',
            ...shots.map(
                (s) =>
                    `| ${s.id} | ${fmt(s.from)}–${fmt(s.to)} | ${s.source === 'hailuo' ? `Hailuo (se pide ${s.request} s)` : s.source === 'grabacion' ? `grabación ${s.recording}` : 'cierre con el logo, en Remotion'} |`
            ),
            '',
            '## Cómo se hace',
            '',
            '1. **Una tirada de Hailuo por toma.** En cada una se adjuntan sus archivos, **el logo incluido, otra vez en cada tirada**, y se reemplazan los marcadores `@######NOMBRE#######` a mano.',
            '2. **La tirada de voz** genera el audio de todo el video de corrido; su imagen se descarta.',
            `3. **Las tiradas descargadas** van a \`${ASSETS}/video-lab/ventas/${video.id.toLowerCase()}/\` (\`t1.mp4\`, \`t3.mp4\`, …, \`voz.mp4\`).`,
            '4. **El montaje** lo arma Claude Code con el último prompt: graba las pantallas, arma el cierre con el logo y renderiza.',
            '',
            `> \`${ASSETS}\` es la carpeta de assets de marketing (\`HOSPEDA_MARKETING_ASSETS_DIR\`), fuera del repo.`
        );
    } else {
        lines.push(`- **Duración:** ${video.length}`, '', `**La idea:** ${video.idea}`);
    }
    for (const n of video.notes || []) lines.push('', `> **${n.label}:** ${n.text}`);
    for (const p of promptsOf({ video })) {
        lines.push('', `## ${p.label}`, '');
        if (p.attach)
            lines.push(
                '**Adjuntar y reemplazar:**',
                '',
                ...p.attach.map((a) => `- \`${a.split(' → ')[0]}\` → ${a.split(' → ')[1]}`),
                ''
            );
        lines.push('````', p.text, '````');
    }
    lines.push('');
    return lines.join('\n');
};

/**
 * Writes the video files and returns their index rows and artifact entries.
 * @returns {{ index: Array<string>, json: Array<object> }}
 */
const generateVideos = () => {
    mkdirSync(join(ROOT, 'videos'), { recursive: true });
    const index = ['### Videos', '', '| Video | Vertical | Cómo se hace |', '|---|---|---|'];
    const json = [];
    for (const video of [...VIDEOS_HAILUO, ...VIDEOS_CLAUDE]) {
        const file = `${video.id.toLowerCase()}-${video.slug}.md`;
        writeFileSync(join(ROOT, 'videos', file), renderVideo({ video }));
        const how = video.mode === 'hailuo' ? 'Hailuo + montaje de Claude' : 'Claude (Remotion)';
        index.push(
            `| [${video.id} · ${video.name}](videos/${file}) | ${video.vertical} | ${how} |`
        );
        const prompts = promptsOf({ video }).map((p) => ({
            label: p.label,
            text: p.attach ? `${p.text}` : p.text,
            attach: p.attach || []
        }));
        json.push({
            id: video.id,
            group: 'videos',
            groupName: 'Videos',
            name: video.name,
            para: video.para,
            tipo: `Video · ${how}`,
            vertical: video.vertical,
            mode: video.mode,
            formats: ['9:16'],
            badge: Boolean(video.badge),
            hospedin: true,
            capture: true,
            photo: false,
            units: prompts.length,
            isPdf: false,
            prioridad5: false,
            title: video.lines?.[0]?.text || video.intro,
            notes: video.notes || [],
            file: `marketing/prompts/ventas/videos/${file}`,
            prompt: prompts.map((p) => p.text).join('\n\n'),
            prompts
        });
    }
    index.push('');
    return { index, json };
};

/**
 * Writes every piece file and the folder index.
 * @param {{ jsonOut?: string }} input
 * @returns {{ count: number }}
 */
const generate = ({ jsonOut }) => {
    const index = [];
    const json = [];
    let count = 0;
    for (const group of GROUPS) {
        mkdirSync(join(ROOT, group.id), { recursive: true });
        index.push(`### ${group.name}`, '', '| Pieza | Para quién | Tipo |', '|---|---|---|');
        for (const piece of group.pieces) {
            const file = `${piece.id.toLowerCase()}-${piece.slug}.md`;
            writeFileSync(join(ROOT, group.id, file), renderPiece({ piece, group }));
            index.push(
                `| [${piece.id} · ${piece.name}](${group.id}/${file}) | ${piece.para} | ${piece.tipo} |`
            );
            json.push({
                id: piece.id,
                group: group.id,
                groupName: group.name,
                name: piece.name,
                para: piece.para,
                tipo: piece.tipo,
                formats: piece.formats,
                badge: Boolean(piece.badge),
                hospedin: Boolean(
                    piece.hospedin || (piece.pages || piece.slides || []).some((u) => u.hospedin)
                ),
                capture: Boolean(
                    piece.capture || (piece.pages || piece.slides || []).some((u) => u.capture)
                ),
                photo: Boolean((piece.pages || piece.slides || []).some((u) => u.photo)),
                units: (piece.pages || piece.slides || []).length,
                isPdf: Boolean(piece.pages),
                prioridad5: Boolean(piece.prioridad5),
                title:
                    piece.texts?.title ||
                    (piece.pages || piece.slides)?.[0]?.texts?.title ||
                    piece.name,
                notes: piece.notes || [],
                attach: filesToAttachOf(piece),
                file: `marketing/prompts/ventas/${group.id}/${file}`,
                prompt: buildPrompt(piece)
            });
            count += 1;
        }
        index.push('');
    }
    const videos = generateVideos();
    index.push(...videos.index);
    json.push(...videos.json);
    writeFileSync(join(ROOT, 'README.md'), `${README_HEAD}\n${index.join('\n')}\n${README_TAIL}`);
    for (const t of TEXT_PIECES) {
        json.push({
            ...t,
            group: 'textos',
            groupName: 'Textos para vendedores',
            formats: [],
            notes: [],
            isText: true,
            file: `marketing/prompts/ventas/textos/${t.fileName}`,
            prompt: readFileSync(join(ROOT, 'textos', t.fileName), 'utf8')
        });
    }
    if (jsonOut) writeFileSync(jsonOut, JSON.stringify(json));
    return { count };
};

const { count } = generate({ jsonOut: process.argv[2] });
process.stdout.write(`${count} piezas generadas\n`);
