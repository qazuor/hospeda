/**
 * Editing decisions for video VC1 («Publicá tu alojamiento en tres pasos»), derived from the
 * events that record/record-vc1.mts logged. The recorder brackets every usable span with
 * `keep:<name>` / `keep:<name>:end` marks; this module strings them into stages and frames the
 * camera on each block.
 */
import type { Box, Focus, Piece, RecEvent, Recording } from '../a1/timeline';
import { FPS, pieceFrames, RATE, recordingSize } from '../a1/timeline';
import { INTRO, mustFind, OUTRO, type TutorialStage } from '../tutorial/edit';

/** Total length of VC1, in frames (31 s). Stage 3 absorbs whatever stages 1 and 2 leave. */
const TOTAL_FRAMES = 31 * FPS;

/**
 * Gap, in recording px, between the bottom of the capacity fields and the top of the price card
 * below them on the same page (measured on the take: 585 → 652 CSS px at DPR 3).
 */
const PRICE_CARD_GAP = 190;

/** The stages of VC1, in order. */
export const STAGES: readonly TutorialStage[] = [
    { step: '1/3', chip: 'Datos básicos', say: 'Primero, lo básico.', pose: 'te-explico' },
    {
        step: '2/3',
        chip: 'Fotos y mapa',
        say: 'Subís las fotos y marcás dónde está.',
        pose: 'senalando'
    },
    { step: '3/3', chip: 'Listo', say: '¡Y ya está publicado!', pose: 'es-facil' }
];

const at = (rec: Recording, label: string, nth = 0): RecEvent =>
    mustFind({ events: rec.events, label, video: 'vc1', nth });

/** The span between `keep:<name>` and `keep:<name>:end`, as a piece. */
const kept = (rec: Recording, name: string, cut: Piece['cut'], lead = 0.05): Piece => ({
    from: at(rec, `keep:${name}`).t + lead,
    to: at(rec, `keep:${name}:end`).t,
    cut
});

const framesOf = (pieces: readonly Piece[]): number =>
    pieceFrames(pieces).reduce((sum, n) => sum + n, 0);

/**
 * The kept pieces, grouped by stage.
 * 1. Name typed and type picked, then (jump) the capacity counts.
 * 2. (wipe) The map pin, then (jumps) the gallery upload, the filled gallery and the main photo,
 *    and the publish prompt with the «Publicar ahora» tap.
 * 3. (wipe) The public listing, fitted so the video lasts {@link TOTAL_FRAMES}.
 */
export const buildStagePieces = (rec: Recording): Piece[][] => {
    const nameTap = at(rec, 'campo-nombre').t;
    const stage1: Piece[] = [
        { from: nameTap - 0.35, to: at(rec, 'keep:mini:end').t, cut: 'none' },
        kept(rec, 'capacidad', 'jump')
    ];
    const stage2: Piece[] = [
        kept(rec, 'mapa', 'wipe'),
        kept(rec, 'galeria', 'jump'),
        {
            from: at(rec, 'keep:galeria-lista').t + 0.05,
            to: at(rec, 'keep:principal:end').t,
            cut: 'jump'
        },
        kept(rec, 'lista', 'jump')
    ];
    const left = TOTAL_FRAMES - INTRO - OUTRO - framesOf(stage1) - framesOf(stage2);
    const fichaFrom = at(rec, 'keep:ficha').t + 0.05;
    const fichaEnd = at(rec, 'keep:ficha:end').t;
    const fichaTo = fichaFrom + (left / FPS) * RATE;
    if (left < 4 * FPS || fichaTo > fichaEnd)
        throw new Error(
            `vc1: stage 3 needs ${(left / FPS).toFixed(1)} s but the take holds the listing for ${((fichaEnd - fichaFrom) / RATE).toFixed(1)} s; re-record with a longer hold`
        );
    return [stage1, stage2, [{ from: fichaFrom, to: fichaTo, cut: 'wipe' }]];
};

/**
 * Box of the price card under the capacity fields, down to the bottom of the screen. It is
 * redacted while the capacity span is on screen: no price, not even an empty price field.
 */
export const priceBox = (rec: Recording): Box => {
    const grid = at(rec, 'capacidad').box;
    if (!grid) throw new Error('vc1 recording: "capacidad" has no box');
    const { size } = recordingSize({ rec });
    const top = grid.y + grid.h + PRICE_CARD_GAP;
    return { x: 30, y: top, w: size.width - 60, h: size.height - top };
};

/** Source second where the capacity span starts (for the price redaction). */
export const capacityStart = (rec: Recording): number => at(rec, 'keep:capacidad').t;

/** Camera windows: the name and type fields, the capacity block, the map and the prompt. */
export const buildWindows = (rec: Recording): Focus[] => {
    const box = (label: string) => {
        const b = at(rec, label).box;
        if (!b) throw new Error(`vc1 recording: "${label}" has no box`);
        return b;
    };
    const name = at(rec, 'nombre');
    const type = at(rec, 'tipo');
    const capacity = at(rec, 'capacidad');
    const map = at(rec, 'mapa');
    const dialog = at(rec, 'dialogo');
    return [
        {
            from: at(rec, 'campo-nombre').t - 0.2,
            to: (name.end ?? name.t) + 0.3,
            box: box('nombre'),
            zoom: 1.25
        },
        { from: type.t - 0.2, to: type.end ?? type.t, box: box('tipo'), zoom: 1.2 },
        {
            from: at(rec, 'keep:capacidad').t,
            to: (capacity.end ?? capacity.t) + 0.3,
            box: box('capacidad'),
            zoom: 1.25
        },
        { from: map.t, to: at(rec, 'keep:mapa:end').t, box: box('mapa'), zoom: 1.12 },
        { from: dialog.t, to: at(rec, 'keep:lista:end').t, box: box('dialogo'), zoom: 1.1 }
    ];
};
