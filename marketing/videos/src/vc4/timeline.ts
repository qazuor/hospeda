/**
 * Editing decisions for video VC4 («Publicá tu experiencia»), derived from the events that
 * record/record-vc4.mts logged. The recorder brackets every usable span with `keep:<name>` /
 * `keep:<name>:end` marks; this module strings them into stages and frames the camera on the
 * create-form fields.
 */
import type { Focus, Piece, RecEvent, Recording } from '../a1/timeline';
import { FPS, pieceFrames, RATE } from '../a1/timeline';
import { INTRO, mustFind, OUTRO, type TutorialStage } from '../tutorial/edit';

/** Total length of VC4, in frames (28 s). Stage 3 absorbs whatever stages 1 and 2 leave. */
const TOTAL_FRAMES = 28 * FPS;

/** The stages of VC4, in order. */
export const STAGES: readonly TutorialStage[] = [
    { step: '1/3', chip: 'Tu salida', say: 'Contás de qué se trata.', pose: 'te-explico' },
    { step: '2/3', chip: 'Fotos', say: 'Sumás tus mejores fotos.', pose: 'senalando' },
    { step: '3/3', chip: 'Publicada', say: '¡Y el turista ya la ve!', pose: 'es-facil' }
];

const at = (rec: Recording, label: string): RecEvent =>
    mustFind({ events: rec.events, label, video: 'vc4' });

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
 * 1. Name typed and category picked, then (jump) the summary typed.
 * 2. (wipe) The gallery upload, then (jumps) the filled gallery with the main-photo tap, and
 *    every photo in place.
 * 3. (wipe) The public listing, fitted so the video lasts {@link TOTAL_FRAMES}.
 */
export const buildStagePieces = (rec: Recording): Piece[][] => {
    const stage1: Piece[] = [
        { from: at(rec, 'campo-nombre').t - 0.35, to: at(rec, 'keep:nombre:end').t, cut: 'none' },
        kept(rec, 'resumen', 'jump')
    ];
    const stage2: Piece[] = [
        kept(rec, 'galeria', 'wipe'),
        kept(rec, 'galeria-lista', 'jump'),
        kept(rec, 'fotos-listas', 'jump')
    ];
    const left = TOTAL_FRAMES - INTRO - OUTRO - framesOf(stage1) - framesOf(stage2);
    const fichaFrom = at(rec, 'keep:ficha').t + 0.05;
    const fichaEnd = at(rec, 'keep:ficha:end').t;
    const fichaTo = fichaFrom + (left / FPS) * RATE;
    if (left < 4 * FPS || fichaTo > fichaEnd)
        throw new Error(
            `vc4: stage 3 needs ${(left / FPS).toFixed(1)} s but the take holds the listing for ${((fichaEnd - fichaFrom) / RATE).toFixed(1)} s; re-record with a longer hold`
        );
    return [stage1, stage2, [{ from: fichaFrom, to: fichaTo, cut: 'wipe' }]];
};

/** Camera windows: the name, the category and the summary fields. */
export const buildWindows = (rec: Recording): Focus[] => {
    const box = (label: string) => {
        const b = at(rec, label).box;
        if (!b) throw new Error(`vc4 recording: "${label}" has no box`);
        return b;
    };
    const name = at(rec, 'nombre');
    const type = at(rec, 'tipo');
    const summary = at(rec, 'resumen-listo');
    return [
        {
            from: at(rec, 'campo-nombre').t - 0.2,
            to: (name.end ?? name.t) + 0.3,
            box: box('nombre'),
            zoom: 1.25
        },
        { from: type.t - 0.4, to: type.end ?? type.t, box: box('tipo'), zoom: 1.2 },
        {
            from: at(rec, 'keep:resumen').t,
            to: summary.end ?? summary.t,
            box: box('resumen'),
            zoom: 1.2
        }
    ];
};
