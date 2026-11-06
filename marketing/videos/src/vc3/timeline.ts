/**
 * Editing decisions for video VC3 («Sumá tu local»), derived from the events that
 * record/record-vc3.mts logged. The recorder brackets every usable span with `keep:<name>` /
 * `keep:<name>:end` marks; this module strings them into stages and frames the camera.
 *
 * BORROWED SHOT: the `mapa` span of stage 2 was filmed on an ACCOMMODATION's map editor (venues
 * have no map yet; owner-approved exception, scoped to this shot). It enters and leaves with
 * cuts so it reads as part of the venue flow. Re-record stage 2 once the venue map ships.
 */
import type { Box, Focus, Piece, RecEvent, Recording } from '../a1/timeline';
import { FPS, pieceFrames, RATE } from '../a1/timeline';
import { INTRO, mustFind, OUTRO, type TutorialStage } from '../tutorial/edit';

/** Total length of VC3, in frames (28 s). Stage 3 absorbs whatever stages 1 and 2 leave. */
const TOTAL_FRAMES = 28 * FPS;

/**
 * The price-tier badge («Moderado») of the public listing, in recording px, while the page is
 * at the top (measured on vc3-take2: 242–475 × 470–542 in the 1080 px screencast, × 1236 / 1080),
 * with a small margin. No price indicator goes on screen, so it is filled with the hero colour.
 */
export const PRICE_TIER_BADGE: Box = { x: 270, y: 530, w: 282, h: 98 };
/** Background of the public listing's hero, behind {@link PRICE_TIER_BADGE}. */
export const HERO_FILL = '#DFF1FF';

/** The stages of VC3, in order. */
export const STAGES: readonly TutorialStage[] = [
    { step: '1/3', chip: 'Tu local', say: 'Contás qué es tu local.', pose: 'te-explico' },
    { step: '2/3', chip: 'Fotos y mapa', say: 'Fotos y dónde encontrarte.', pose: 'senalando' },
    { step: '3/3', chip: 'Publicado', say: '¡Listo, ya te encuentran!', pose: 'es-facil' }
];

const at = (rec: Recording, label: string): RecEvent =>
    mustFind({ events: rec.events, label, video: 'vc3' });

/** The span between `keep:<name>` and `keep:<name>:end`, as a piece. */
const kept = (rec: Recording, name: string, cut: Piece['cut'], lead = 0.05): Piece => ({
    from: at(rec, `keep:${name}`).t + lead,
    to: at(rec, `keep:${name}:end`).t,
    cut
});

const framesOf = (pieces: readonly Piece[]): number =>
    pieceFrames(pieces).reduce((sum, n) => sum + n, 0);

/** Source second where the scrolled public page rests (the badge is off screen by then). */
export const restStart = (rec: Recording): number => at(rec, 'ficha-abajo').t + 0.05;

/**
 * The kept pieces, grouped by stage.
 * 1. Name typed and category picked, then (jump) the summary typed.
 * 2. (wipe) The gallery tap, (jump) the filled gallery, (wipe) the BORROWED map pin, (jump) the
 *    main-photo tap, and (jump) every photo in place.
 * 3. (wipe) The top of the public listing, then (jump) the page scrolled down, fitted so the
 *    video lasts {@link TOTAL_FRAMES}.
 */
export const buildStagePieces = (rec: Recording): Piece[][] => {
    const stage1: Piece[] = [
        { from: at(rec, 'campo-nombre').t - 0.35, to: at(rec, 'keep:nombre:end').t, cut: 'none' },
        kept(rec, 'resumen', 'jump')
    ];
    const galleryEnd = at(rec, 'keep:galeria:end').t;
    const stage2: Piece[] = [
        { from: at(rec, 'keep:galeria').t + 0.05, to: at(rec, 'subir-galeria').t + 1, cut: 'wipe' },
        { from: galleryEnd - 1.3, to: galleryEnd, cut: 'jump' },
        // BORROWED SHOT: accommodation map editor standing in for the venue map.
        kept(rec, 'mapa', 'wipe'),
        kept(rec, 'principal', 'jump'),
        kept(rec, 'fotos-listas', 'jump')
    ];
    const left = TOTAL_FRAMES - INTRO - OUTRO - framesOf(stage1) - framesOf(stage2);
    const topHold = at(rec, 'ficha');
    const top: Piece = { from: topHold.t + 0.05, to: topHold.end ?? topHold.t + 2, cut: 'wipe' };
    const restFrom = restStart(rec);
    const restEnd = at(rec, 'keep:ficha:end').t;
    const restTo = restFrom + ((left - framesOf([top])) / FPS) * RATE;
    if (left < 4 * FPS || restTo > restEnd)
        throw new Error(
            `vc3: stage 3 needs ${(left / FPS).toFixed(1)} s but the take holds the listing for ${((restEnd - restFrom + top.to - top.from) / RATE).toFixed(1)} s; re-record with a longer hold`
        );
    return [stage1, stage2, [top, { from: restFrom, to: restTo, cut: 'jump' }]];
};

/** Camera windows: the name, category and summary fields, and the (borrowed) map. */
export const buildWindows = (rec: Recording): Focus[] => {
    const box = (label: string) => {
        const b = at(rec, label).box;
        if (!b) throw new Error(`vc3 recording: "${label}" has no box`);
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
        },
        // BORROWED SHOT: framed on the map only.
        {
            from: at(rec, 'keep:mapa').t,
            to: at(rec, 'keep:mapa:end').t,
            box: box('mapa'),
            zoom: 1.3
        }
    ];
};
