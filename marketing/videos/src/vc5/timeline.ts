/**
 * Editing decisions for video VC5 («Lo que ve el turista»), derived from the events that
 * record/record-vc5.mts logged: which source pieces each stage keeps and where the camera looks.
 * The rest of the edit is shared by every phone tutorial (src/tutorial/edit.ts).
 */
import type { Focus, Piece, Recording } from '../a1/timeline';
import { fitStage, holdWindows, mustFind, type TutorialStage } from '../tutorial/edit';

/** Output length of each stage, in frames. Stage 1 ends at 9.0 s, stage 2 at 17.5 s. */
const STAGE_FRAMES = [204, 255] as const;

/** The stages of VC5, in order. The page has no weather block, so there is no third stage. */
export const STAGES: readonly TutorialStage[] = [
    { step: '1/2', chip: 'En su idioma', say: 'Tu ficha, en su idioma.', pose: 'te-explico' },
    { step: '2/2', chip: 'Qué hay cerca', say: 'Mapa y qué hay cerca.', pose: 'descubri' }
];

/**
 * The kept pieces, grouped by stage. Static holds are trimmed freely (nothing moves, so the
 * join is invisible: cut `none`); every language switch and the return to Spanish is a page
 * load, dropped and covered by a brand wipe. Each stage lasts exactly its {@link STAGE_FRAMES}.
 */
export const buildStagePieces = ({ events }: Recording): Piece[][] => {
    const at = (label: string) => mustFind({ events, label, video: 'vc5' });
    const fotos = at('fotos');
    const descEs = at('desc-es');
    const menu = at('menu');
    const cutOut = at('cut:out');
    const descEn = at('desc-en');
    const descPt = at('desc-pt');
    const cerca = at('stage:cerca');
    const mapaEnd = (at('mapa').end ?? at('mapa').t) - 0.1;

    const stage1: Piece[] = [
        { from: fotos.t + 1.0, to: descEs.t + 1.0, cut: 'none' },
        { from: menu.t - 0.4, to: cutOut.t, cut: 'none' },
        { from: descEn.t, to: descEn.t + 1.55, cut: 'wipe' },
        { from: descPt.t, to: descPt.t, cut: 'wipe' }
    ];
    const stage2: Piece[] = [
        { from: cerca.t + 0.1, to: mapaEnd, cut: 'wipe' },
        { from: mapaEnd, to: mapaEnd, cut: 'none' }
    ];
    return [stage1, stage2].map((pieces, i) => fitStage({ pieces, frames: STAGE_FRAMES[i] ?? 0 }));
};

/**
 * Camera windows: each held block with a box (description, map, nearby cards). Taps get no
 * window: the menu and language targets sit at the screen edges, and centring the camera on
 * them pushes most of the phone out of frame. The touch ring marks them instead.
 */
export const buildWindows = ({ events }: Recording): Focus[] =>
    holdWindows({
        events,
        zoomOf: {
            'desc-es': 1.12,
            'desc-en': 1.12,
            'desc-pt': 1.12,
            mapa: 1.06,
            'cerca-1': 1.3,
            'cerca-2': 1.3,
            'cerca-3': 1.3
        }
    });
