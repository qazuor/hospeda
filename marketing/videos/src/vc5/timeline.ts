/**
 * Editing decisions for video VC5 («Lo que ve el turista»), derived from the events that
 * record/record-vc5.mts logged. Pure: given the recording, it returns the kept pieces of the
 * source, the stages and the focus windows. Time mapping, cuts and the camera come from A1's
 * timeline (src/a1/timeline.ts), which is generic over pieces and focus windows.
 */
import type { Pose } from '../a1/HospedinActor';
import { type Focus, FPS, type Piece, RATE, type RecEvent, type Recording } from '../a1/timeline';

/** Output length of the intro: 2.2 s (≈ the first bar of the music). */
export const INTRO = 66;
/** Output length of each stage, in frames. Stage 1 ends at 9.0 s, stage 2 at 17.5 s. */
const STAGE_FRAMES = [204, 255] as const;
/** Output length of the closing: 4 s. */
export const OUTRO = 120;

/** A tutorial stage: Hospedín's single line, the step chip and the pieces it plays. */
export type Vc5Stage = {
    readonly step: string;
    readonly chip: string;
    readonly say: string;
    readonly pose: Pose;
};

/** The stages of VC5, in order. The page has no weather block, so there is no third stage. */
export const STAGES: readonly Vc5Stage[] = [
    { step: '1/2', chip: 'En su idioma', say: 'Tu ficha, en su idioma.', pose: 'te-explico' },
    { step: '2/2', chip: 'Qué hay cerca', say: 'Mapa y qué hay cerca.', pose: 'descubri' }
];

const must = (events: readonly RecEvent[], label: string, nth = 0): RecEvent => {
    const e = events.filter((x) => x.label === label)[nth];
    if (!e)
        throw new Error(
            `VC5 recording has no "${label}" event #${nth}; re-record with pnpm record:vc5`
        );
    return e;
};

/** Source seconds that fill `frames` output frames at {@link RATE}. */
const secondsFor = (frames: number): number => (frames / FPS) * RATE;

/**
 * The kept pieces, grouped by stage. Static holds are trimmed freely (nothing moves, so the
 * join is invisible: cut `none`); every language switch and the return to Spanish is a page
 * load, dropped and covered by a brand wipe. The last piece of each stage is stretched or
 * trimmed so the stage lasts exactly its {@link STAGE_FRAMES}.
 */
export const buildStagePieces = ({ events }: Recording): Piece[][] => {
    const fotos = must(events, 'fotos');
    const descEs = must(events, 'desc-es');
    const menu = must(events, 'menu');
    const cutOut = must(events, 'cut:out');
    const descEn = must(events, 'desc-en');
    const descPt = must(events, 'desc-pt');
    const cerca = must(events, 'stage:cerca');
    const mapa = must(events, 'mapa');

    const stage1: Piece[] = [
        { from: fotos.t + 1.0, to: descEs.t + 1.0, cut: 'none' },
        { from: menu.t - 0.4, to: cutOut.t, cut: 'none' },
        { from: descEn.t, to: descEn.t + 1.55, cut: 'wipe' },
        { from: descPt.t, to: descPt.t, cut: 'wipe' }
    ];
    const stage2: Piece[] = [
        { from: cerca.t + 0.1, to: (mapa.end ?? mapa.t) - 0.1, cut: 'wipe' },
        { from: (mapa.end ?? mapa.t) - 0.1, to: (mapa.end ?? mapa.t) - 0.1, cut: 'none' }
    ];
    return [stage1, stage2].map((pieces, i) => {
        const target = STAGE_FRAMES[i] ?? 0;
        const head = pieces.slice(0, -1);
        const used = head.reduce((acc, p) => acc + Math.round(((p.to - p.from) / RATE) * FPS), 0);
        const last = pieces.at(-1);
        if (!last) return pieces;
        return [...head, { ...last, to: last.from + secondsFor(target - used) }];
    });
};

/**
 * Camera windows: each held block with a box (description, map, nearby cards). Taps get no
 * window: the menu and language targets sit at the screen edges, and centring the camera on
 * them pushes most of the phone out of frame. The touch ring marks them instead.
 *
 * @param input.events - The recorder's events.
 * @returns Focus windows sorted by start.
 */
export const buildWindows = ({ events }: { readonly events: readonly RecEvent[] }): Focus[] => {
    const zoomOf: Record<string, number> = {
        'desc-es': 1.12,
        'desc-en': 1.12,
        'desc-pt': 1.12,
        mapa: 1.06,
        'cerca-1': 1.3,
        'cerca-2': 1.3,
        'cerca-3': 1.3
    };
    const out: Focus[] = [];
    for (const e of events) {
        if (!e.box) continue;
        const zoom = zoomOf[e.label];
        if (e.kind === 'hold' && zoom)
            out.push({ from: e.t - 0.25, to: (e.end ?? e.t) + 0.2, box: e.box, zoom });
    }
    return out.sort((a, b) => a.from - b.from);
};
