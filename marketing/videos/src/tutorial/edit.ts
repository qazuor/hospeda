/**
 * The edit of a phone tutorial (VC videos): from a recording, its kept pieces grouped by stage
 * and its focus windows, everything the {@link PhoneTutorial} composition needs per frame.
 * Pure and computed once per video at module load. Time mapping, cuts and the camera come from
 * A1's timeline (src/a1/timeline.ts).
 */

import type { Size } from '../../config/device';
import type { Pose } from '../a1/HospedinActor';
import { fitRecording, type RecordingFit } from '../a1/Phone';
import type { Cue } from '../a1/Sound';
import {
    buildCuts,
    buildFocus,
    buildTimeMap,
    type Camera,
    type Focus,
    FPS,
    type Piece,
    pieceFrames,
    RATE,
    type RecEvent,
    type Recording,
    recordingSize,
    type Spot
} from '../a1/timeline';

/** Output length of the intro: 2.2 s (≈ the first bar of the music). */
export const INTRO = 66;
/** Output length of the closing: 4 s. */
export const OUTRO = 120;

/** A tutorial stage: Hospedín's single line and the persistent step chip. */
export type TutorialStage = {
    readonly step: string;
    readonly chip: string;
    readonly say: string;
    readonly pose: Pose;
};

/** Everything the composition reads, per video. */
export type TutorialEdit = {
    readonly rec: Recording;
    readonly size: Size;
    readonly fit: RecordingFit;
    readonly pieces: readonly Piece[];
    readonly frames: readonly number[];
    readonly timeMap: readonly number[];
    readonly cuts: ReadonlyArray<{ frame: number; cut: Piece['cut'] }>;
    readonly camera: readonly Camera[];
    readonly spot: readonly Spot[];
    /** Composition frame where each stage starts. */
    readonly stageStarts: readonly number[];
    /** Composition frame where the closing starts. */
    readonly outroAt: number;
    /** Total composition length in frames. */
    readonly duration: number;
    readonly touches: ReadonlyArray<{ x: number; y: number; at: number }>;
    /** Composition frames of the brand wipes. */
    readonly wipes: readonly number[];
    /** Composition frames of the jump cuts. */
    readonly jumps: readonly number[];
    readonly cues: readonly Cue[];
    /** First composition frame at which source second `t` is on screen, if it was kept. */
    readonly frameOf: (t: number, tolerance?: number) => number | undefined;
};

/**
 * Event with the given label (the `nth` one), or a throw that says how to fix the take.
 *
 * @param input.events - The recorder's events.
 * @param input.label - Event label.
 * @param input.video - Video id, for the error message.
 * @param input.nth - Which occurrence (default the first).
 */
export const mustFind = ({
    events,
    label,
    video,
    nth = 0
}: {
    readonly events: readonly RecEvent[];
    readonly label: string;
    readonly video: string;
    readonly nth?: number;
}): RecEvent => {
    const e = events.filter((x) => x.label === label)[nth];
    if (!e)
        throw new Error(
            `${video} recording has no "${label}" event #${nth}; re-record with pnpm record:${video}`
        );
    return e;
};

/**
 * Stretches or trims the last piece of a stage so the stage lasts exactly `frames` output
 * frames. The other pieces keep their length.
 */
export const fitStage = ({
    pieces,
    frames
}: {
    readonly pieces: readonly Piece[];
    readonly frames: number;
}): Piece[] => {
    const head = pieces.slice(0, -1);
    const used = pieceFrames(head).reduce((sum, n) => sum + n, 0);
    const last = pieces.at(-1);
    if (!last) return [...pieces];
    return [...head, { ...last, to: last.from + ((frames - used) / FPS) * RATE }];
};

/**
 * Focus windows from the recorder's boxed holds, one zoom per label.
 *
 * @param input.events - The recorder's events.
 * @param input.zoomOf - Zoom per hold label; labels not listed get no window.
 */
export const holdWindows = ({
    events,
    zoomOf
}: {
    readonly events: readonly RecEvent[];
    readonly zoomOf: Readonly<Record<string, number>>;
}): Focus[] =>
    events
        .flatMap((e) => {
            const zoom = zoomOf[e.label];
            return e.kind === 'hold' && e.box && zoom
                ? [{ from: e.t - 0.25, to: (e.end ?? e.t) + 0.2, box: e.box, zoom }]
                : [];
        })
        .sort((a, b) => a.from - b.from);

/**
 * Builds the whole edit of a phone tutorial.
 *
 * @param input.rec - The recording (events.json).
 * @param input.stages - Kept pieces, one group per stage, in order.
 * @param input.windows - Camera/spotlight focus windows.
 * @returns The {@link TutorialEdit}.
 */
export const buildTutorialEdit = ({
    rec,
    stages,
    windows
}: {
    readonly rec: Recording;
    readonly stages: readonly (readonly Piece[])[];
    readonly windows: readonly Focus[];
}): TutorialEdit => {
    const { size } = recordingSize({ rec });
    const { fit } = fitRecording({ size });
    const pieces = stages.flat();
    const frames = pieceFrames(pieces);
    const timeMap = buildTimeMap(pieces);
    const cuts = buildCuts(pieces);
    const { camera, spot } = buildFocus({ rec, timeMap, cuts, scale: fit.k, windows });
    const outroAt = INTRO + timeMap.length;
    const stageStarts = stages.map(
        (_, i) => INTRO + pieceFrames(stages.slice(0, i).flat()).reduce((sum, n) => sum + n, 0)
    );
    const frameOf = (t: number, tolerance = 0.12): number | undefined => {
        const i = timeMap.findIndex((s) => s >= t);
        const shown = timeMap[i];
        return shown === undefined || shown - t > tolerance ? undefined : INTRO + i;
    };
    const touches = rec.events
        .flatMap((e) =>
            e.kind === 'tap' && e.box
                ? [{ x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2, at: frameOf(e.t + 0.25) }]
                : []
        )
        .filter((t): t is { x: number; y: number; at: number } => t.at !== undefined);
    const wipes = cuts.filter((c) => c.cut === 'wipe').map((c) => INTRO + c.frame);
    const jumps = cuts.filter((c) => c.cut === 'jump').map((c) => INTRO + c.frame);
    const cues: Cue[] = [
        { at: INTRO - 36, file: 'swell.wav', volume: 0.55 },
        { at: INTRO - 12, file: 'whoosh.wav', volume: 0.45 },
        { at: outroAt, file: 'whoosh.wav', volume: 0.45 },
        ...touches.map((t) => ({ at: t.at, file: 'tap.wav', volume: 0.7 })),
        ...wipes.map((w) => ({ at: w - 8, file: 'whoosh-short.wav', volume: 0.55 })),
        ...jumps.map((j) => ({ at: j - 2, file: 'whoosh-short.wav', volume: 0.3 })),
        ...stageStarts.map((s) => ({ at: s + 4, file: 'pop.wav', volume: 0.45 }))
    ];
    return {
        rec,
        size,
        fit,
        pieces,
        frames,
        timeMap,
        cuts,
        camera,
        spot,
        stageStarts,
        outroAt,
        duration: outroAt + OUTRO,
        touches,
        wipes,
        jumps,
        cues,
        frameOf
    };
};
