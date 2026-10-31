/**
 * Editing decisions for video A1, derived from the events the recorder logged.
 * Everything here is pure: given the recording, it returns which source seconds play when,
 * where the camera looks, what is highlighted and where the cuts are.
 */

import { recordingSizeOf, type Size } from '../../config/device';

/** One action recorded by record/record-a1.mts. Times are seconds since the screencast started. */
export type RecEvent = {
    readonly t: number;
    readonly end?: number;
    readonly kind: 'mark' | 'tap' | 'type' | 'hold';
    readonly label: string;
    /** Target box in device pixels of the recording (see {@link recordingSize}). */
    readonly box?: Box;
};

/** Axis-aligned rectangle in device pixels of the recording. */
export type Box = {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
};

/** The event log written by the recorder (events.json). */
export type Recording = {
    /** Device pixel ratio the take was recorded at. */
    readonly dpr?: number;
    /** CSS viewport the take was recorded at. */
    readonly viewport?: Size;
    readonly duration: number;
    readonly events: readonly RecEvent[];
};

/**
 * Size in device pixels of a take, from what the recorder logged. Takes that predate the log
 * fall back to the reference device (config/device.ts).
 *
 * @param input.rec - The recording.
 * @returns `{ size }` in device pixels.
 */
export const recordingSize = ({ rec }: { readonly rec: Recording }): { readonly size: Size } =>
    rec.dpr && rec.viewport
        ? {
              size: {
                  width: Math.round(rec.viewport.width * rec.dpr),
                  height: Math.round(rec.viewport.height * rec.dpr)
              }
          }
        : recordingSizeOf();

/** A kept stretch of the source. `cut` says how the edit enters it. */
export type Piece = {
    readonly from: number;
    readonly to: number;
    readonly cut: 'none' | 'jump' | 'wipe';
};

/** Camera state for one output frame: zoom and focus point in recording px. */
export type Camera = { readonly zoom: number; readonly fx: number; readonly fy: number };

/** Spotlight rectangle for one output frame, with its opacity `a` (0-1). */
export type Spot = Box & { readonly a: number };

/** Output frame rate of every composition. */
export const FPS = 30;
/** Playback speed of the kept source footage (overall 1.2x pace). */
export const RATE = 1.2;

/** Typing longer than this (source seconds) is jump-cut: show the start, cut to the end. */
const JUMP_MIN = 1.4;
const JUMP_HEAD = 0.75;
const JUMP_TAIL = 0.45;
const TAIL_AFTER_TOAST = 1.7;

/** First event with the given label, or undefined. */
export const find = (events: readonly RecEvent[], label: string): RecEvent | undefined =>
    events.find((e) => e.label === label);

/** Page loads are removed and covered by a brand wipe: [tap that navigates, mark of the new page]. */
const LOADS: ReadonlyArray<readonly [string, string]> = [
    ['publicar-otra', 'stage:crear'],
    ['crear', 'stage:hub'],
    ['info-basica', 'stage:datos']
];

/**
 * Splits the recording into the pieces that make the cut: page loads are dropped (wipe),
 * the middle of long typing is dropped (jump cut), the opening hold is trimmed.
 */
export const buildPieces = ({ events, duration }: Recording): Piece[] => {
    const firstTap = find(events, 'publicar-otra');
    const start = Math.max(0.4, (firstTap?.t ?? 1.6) - 1.5);
    const toast = find(events, 'toast:guardado');
    const stop = Math.min(duration, (toast?.t ?? duration) + TAIL_AFTER_TOAST);

    const removed: Array<{ from: number; to: number; cut: Piece['cut'] }> = [];
    for (const [tapLabel, stageLabel] of LOADS) {
        const tap = find(events, tapLabel);
        const stage = find(events, stageLabel);
        if (tap && stage) removed.push({ from: tap.t + 0.45, to: stage.t + 0.35, cut: 'wipe' });
    }
    for (const e of events) {
        if (e.kind !== 'type' || e.end === undefined || e.end - e.t < JUMP_MIN) continue;
        removed.push({ from: e.t + JUMP_HEAD, to: e.end - JUMP_TAIL, cut: 'jump' });
    }
    removed.sort((a, b) => a.from - b.from);

    const pieces: Piece[] = [];
    let cursor = start;
    let cut: Piece['cut'] = 'none';
    for (const r of removed) {
        if (r.to <= cursor || r.from >= stop) continue;
        if (r.from > cursor) pieces.push({ from: cursor, to: r.from, cut });
        cursor = Math.max(cursor, r.to);
        cut = r.cut;
    }
    if (cursor < stop) pieces.push({ from: cursor, to: stop, cut });
    return pieces;
};

/** Output frames of each piece, so the video sequences and the time map agree exactly. */
export const pieceFrames = (pieces: readonly Piece[]): number[] =>
    pieces.map((p) => Math.round(((p.to - p.from) / RATE) * FPS));

/** Maps every output frame of the screen part to a source time in seconds. */
export const buildTimeMap = (pieces: readonly Piece[]): number[] => {
    const frames = pieceFrames(pieces);
    const map: number[] = [];
    pieces.forEach((p, i) => {
        for (let f = 0; f < (frames[i] ?? 0); f++) map.push(p.from + (f / FPS) * RATE);
    });
    return map;
};

/** Output frames (screen-relative) where each cut happens. */
export const buildCuts = (
    pieces: readonly Piece[]
): Array<{ frame: number; cut: Piece['cut'] }> => {
    const frames = pieceFrames(pieces);
    const cuts: Array<{ frame: number; cut: Piece['cut'] }> = [];
    let acc = 0;
    pieces.forEach((p, i) => {
        if (i > 0 && p.cut !== 'none') cuts.push({ frame: acc, cut: p.cut });
        acc += frames[i] ?? 0;
    });
    return cuts;
};

type Focus = {
    readonly from: number;
    readonly to: number;
    readonly box: Box;
    readonly zoom: number;
};

const focusWindows = (events: readonly RecEvent[], size: Size): Focus[] => {
    const out: Focus[] = [];
    for (const e of events) {
        if (!e.box) continue;
        if (e.kind === 'type')
            out.push({ from: e.t - 0.45, to: (e.end ?? e.t) + 0.5, box: e.box, zoom: 1.4 });
        if (e.kind === 'tap') out.push({ from: e.t - 0.55, to: e.t + 0.6, box: e.box, zoom: 1.3 });
    }
    const toast = find(events, 'toast:guardado');
    // The toast has no recorded box; it sits near the bottom of the screen (~155 CSS px tall band).
    if (toast)
        out.push({
            from: toast.t,
            to: toast.t + 1.5,
            box: { x: 30, y: size.height - 462, w: size.width - 60, h: 190 },
            zoom: 1.3
        });
    return out.sort((a, b) => a.from - b.from);
};

/** Focus windows closer than this (seconds) are bridged: the camera pans instead of pumping out and in. */
const BRIDGE_GAP = 1.6;
const MIN_MOVE_FRAMES = 22;
const MAX_MOVE_FRAMES = 44;
/** Average on-screen speed a move is sized for (px per frame); the sine ease peaks at ~1.57x this. */
const PAN_SPEED = 34;

/** Sine ease-in-out: peaks at ~1.57x the average speed (a cubic peaks at 3x and reads as a whip). */
export const easeInOut = (x: number): number =>
    -(Math.cos(Math.PI * Math.min(1, Math.max(0, x))) - 1) / 2;

const sameCamera = (a: Camera, b: Camera): boolean =>
    a.zoom === b.zoom && a.fx === b.fx && a.fy === b.fy;

/** On-screen offset of the phone centre for a camera, used to size moves by real travel. */
const phoneOffset = (c: Camera, size: Size, scale: number): { x: number; y: number } => ({
    x: (size.width / 2 - c.fx) * scale * c.zoom,
    y: (size.height / 2 - c.fy) * scale * c.zoom
});

const moveFrames = (a: Camera, b: Camera, size: Size, scale: number): number => {
    const pa = phoneOffset(a, size, scale);
    const pb = phoneOffset(b, size, scale);
    return Math.round(
        Math.min(
            MAX_MOVE_FRAMES,
            Math.max(MIN_MOVE_FRAMES, Math.hypot(pa.x - pb.x, pa.y - pb.y) / PAN_SPEED)
        )
    );
};

const activeWindow = (windows: readonly Focus[], t: number): Focus | undefined =>
    windows.filter((w) => t >= w.from && t <= w.to).at(-1);

/**
 * Camera and spotlight per output frame.
 *
 * Camera: each change of target is one sine-eased move sized by on-screen travel, centred on the
 * change, never overlapping the previous move. At a wipe the camera snaps (the wipe hides it).
 * Spotlight: the active field stays lit while the rest of the screen dims; it fades in and out.
 *
 * @param input.rec - The recording and its events.
 * @param input.timeMap - Source second of every output frame ({@link buildTimeMap}).
 * @param input.cuts - Cuts of the edit ({@link buildCuts}).
 * @param input.scale - Recording px → composition px at zoom 1 (sizes moves by on-screen travel).
 * @returns `{ camera, spot }`, one entry per output frame.
 */
export const buildFocus = ({
    rec,
    timeMap,
    cuts,
    scale
}: {
    readonly rec: Recording;
    readonly timeMap: readonly number[];
    readonly cuts: ReadonlyArray<{ frame: number; cut: Piece['cut'] }>;
    readonly scale: number;
}): { camera: Camera[]; spot: Spot[] } => {
    const { size } = recordingSize({ rec });
    const rest: Camera = { zoom: 1, fx: size.width / 2, fy: size.height / 2 };
    const windows = focusWindows(rec.events, size);
    const bridged = windows.map((w, i) => {
        const next = windows[i + 1];
        return next && next.from - w.to < BRIDGE_GAP ? { ...w, to: Math.max(w.to, next.from) } : w;
    });
    const wipes = cuts.filter((c) => c.cut === 'wipe').map((c) => c.frame);

    const targets = timeMap.map((t) => {
        const w = activeWindow(bridged, t);
        return w ? { zoom: w.zoom, fx: w.box.x + w.box.w / 2, fy: w.box.y + w.box.h / 2 } : rest;
    });

    const moves: Array<{ start: number; to: Camera; frames: number }> = [];
    let lastEnd = 0;
    for (let i = 1; i < targets.length; i++) {
        const target = targets[i];
        const previous = targets[i - 1];
        if (!target || !previous || sameCamera(target, previous)) continue;
        const atWipe = wipes.some((w) => Math.abs(w - i) <= 8);
        const frames = atWipe ? 1 : moveFrames(previous, target, size, scale);
        const start = atWipe ? i : Math.max(lastEnd, i - Math.floor(frames / 2));
        moves.push({ start, to: target, frames });
        lastEnd = start + frames;
    }

    const camera: Camera[] = [];
    let from = rest;
    let to = rest;
    let moveStart = -MAX_MOVE_FRAMES;
    let duration = MIN_MOVE_FRAMES;
    let next = 0;
    for (let f = 0; f < timeMap.length; f++) {
        let move = moves[next];
        while (move && f >= move.start) {
            from = camera[f - 1] ?? rest;
            to = move.to;
            moveStart = move.start;
            duration = move.frames;
            next++;
            move = moves[next];
        }
        const p = easeInOut((f - moveStart + 1) / duration);
        camera.push({
            zoom: from.zoom + (to.zoom - from.zoom) * p,
            fx: from.fx + (to.fx - from.fx) * p,
            fy: from.fy + (to.fy - from.fy) * p
        });
    }

    // Spotlight: raw (unbridged) windows, so it only lights a field while it is being used.
    const spot: Spot[] = [];
    let cur: Spot = { x: size.width / 2, y: size.height / 2, w: 0, h: 0, a: 0 };
    for (const t of timeMap) {
        const w = activeWindow(windows, t);
        const target = w ? { ...w.box, a: 1 } : { ...cur, a: 0 };
        const k = 0.3;
        cur = cur.a < 0.02 && w ? { ...w.box, a: cur.a } : cur;
        cur = {
            x: cur.x + (target.x - cur.x) * k,
            y: cur.y + (target.y - cur.y) * k,
            w: cur.w + (target.w - cur.w) * k,
            h: cur.h + (target.h - cur.h) * k,
            a: cur.a + (target.a - cur.a) * 0.2
        };
        spot.push(cur);
    }
    return { camera, spot };
};

/** A stage of the tutorial: a short spoken line from Hospedín and the persistent step chip. */
export type Stage = {
    readonly mark: string;
    readonly step?: string;
    readonly chip?: string;
    readonly say: string;
    readonly pose: import('./HospedinActor').Pose;
};

/** The stages of A1, in order, keyed by the recorder's marks. */
export const STAGES: readonly Stage[] = [
    { mark: 'stage:propiedades', say: 'Entrá a Mis propiedades', pose: 'senalando' },
    {
        mark: 'stage:crear',
        step: '1/3',
        chip: 'Datos básicos',
        say: 'Paso 1: los datos básicos',
        pose: 'te-explico'
    },
    {
        mark: 'stage:hub',
        step: '2/3',
        chip: 'Tu panel',
        say: 'Paso 2: desde tu panel completás todo',
        pose: 'es-facil'
    },
    {
        mark: 'stage:datos',
        step: '3/3',
        chip: 'Descripción',
        say: 'Paso 3: contá qué lo hace único',
        pose: 'enumerando'
    },
    { mark: 'toast:guardado', say: '¡Listo, guardado!', pose: 'vamos' }
];
