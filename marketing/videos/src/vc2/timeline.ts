/**
 * Editing decisions for video VC2 («Ya lo tenés publicado: importalo»), derived from the events
 * that record/record-vc2.mts logged: the kept pieces per stage, the camera windows and the box
 * of the pasted link, which must never be legible.
 */
import type { Box, Focus, Piece, Recording } from '../a1/timeline';
import { FPS, RATE } from '../a1/timeline';
import { fitStage, holdWindows, mustFind, type TutorialStage } from '../tutorial/edit';

/** Output length of each stage, in frames. Stage 1 ends at 7.5 s, stage 2 at 16.0 s. */
const STAGE_FRAMES = [159, 255] as const;

/** The stages of VC2, in order. */
export const STAGES: readonly TutorialStage[] = [
    { step: '1/2', chip: 'Pegá el link', say: 'Pegás el link de tu aviso.', pose: 'senalando' },
    { step: '2/2', chip: 'Se completa', say: 'Y tu ficha se completa sola.', pose: 'es-facil' }
];

const at = (rec: Recording, label: string, nth = 0) =>
    mustFind({ events: rec.events, label, video: 'vc2', nth });

/**
 * The kept pieces, grouped by stage. Stage 1 is the tail of the form up to the «Importar» tap
 * (the import itself is dropped and covered by a brand wipe). Stage 2 is the filled form down
 * to the counts, then a jump cut over the price block to the imported amenities.
 */
export const buildStagePieces = (rec: Recording): Piece[][] => {
    const start = at(rec, 'stage:link').t;
    const importOut = at(rec, 'cut:out').t;
    const filledIn = at(rec, 'cut:in').t;
    const priceOut = at(rec, 'cut:out', 1).t;
    const amenitiesIn = at(rec, 'cut:in', 1).t;
    const stage1Seconds = ((STAGE_FRAMES[0] ?? 0) / FPS) * RATE;
    const stage1: Piece[] = [
        { from: Math.max(start, importOut - stage1Seconds), to: importOut, cut: 'none' }
    ];
    const stage2: Piece[] = [
        { from: filledIn + 0.05, to: priceOut, cut: 'wipe' },
        { from: amenitiesIn + 0.05, to: amenitiesIn + 0.05, cut: 'jump' }
    ];
    return [
        fitStage({ pieces: stage1, frames: STAGE_FRAMES[0] }),
        fitStage({ pieces: stage2, frames: STAGE_FRAMES[1] })
    ];
};

/** Box of the link field, as recorded at the paste. */
export const linkBox = (rec: Recording): Box => {
    const box = at(rec, 'link').box;
    if (!box) throw new Error('vc2 recording: the "link" paste has no box');
    return box;
};

/** Camera windows: the link field from the tap to the end of the paste, and the filled blocks. */
export const buildWindows = (rec: Recording): Focus[] => {
    const tap = at(rec, 'campo-url');
    const pasted = at(rec, 'link-pegado');
    return [
        {
            from: tap.t - 0.4,
            to: (pasted.end ?? pasted.t) + 0.2,
            box: linkBox(rec),
            zoom: 1.3
        },
        ...holdWindows({
            events: rec.events,
            zoomOf: { nombre: 1.22, descripcion: 1.1, comodidades: 1.15 }
        })
    ].sort((a, b) => a.from - b.from);
};
