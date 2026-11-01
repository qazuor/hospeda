import rec from '@marketing-assets/a1/events.json';
import type React from 'react';
import {
    AbsoluteFill,
    Img,
    interpolate,
    OffthreadVideo,
    Sequence,
    spring,
    staticFile,
    useCurrentFrame,
    useVideoConfig
} from 'remotion';
import { Bubble, HospedinActor } from './HospedinActor';
import {
    BEZEL,
    fitRecording,
    PAGE_TOP,
    PHONE_H,
    PHONE_W,
    PhoneFrame,
    Spotlight,
    Touch,
    Wipe
} from './Phone';
import { type Cue, SoundTrack } from './Sound';
import { Backdrop, ClosingCard, KineticText, StepChip } from './scene';
import {
    buildCuts,
    buildFocus,
    buildPieces,
    buildTimeMap,
    FPS,
    find,
    pieceFrames,
    RATE,
    type Recording,
    recordingSize,
    STAGES
} from './timeline';

const recording = rec as Recording;
/**
 * Size of the take. The current take predates the S24 Ultra profile (an older, narrower and
 * taller viewport), so it is letterboxed into the 412 × 750 page area until A1 is re-recorded (REGLAS.md).
 */
const { size: REC } = recordingSize({ rec: recording });
const { fit: FIT } = fitRecording({ size: REC });

/** Intro length = first bar of the music (2.18 s): the groove kicks in exactly when the tutorial starts. */
export const INTRO = 65;
const OUTRO = 120;

const pieces = buildPieces(recording);
const frames = pieceFrames(pieces);
const timeMap = buildTimeMap(pieces);
const cuts = buildCuts(pieces);
const { camera, spot } = buildFocus({ rec: recording, timeMap, cuts, scale: FIT.k });
const SCREEN = timeMap.length;
const OUTRO_AT = INTRO + SCREEN;

/** Total length of A1, for the Composition registration. */
export const A1_DURATION = OUTRO_AT + OUTRO;
/** Source second shown on the phone during the intro (exported so the still can be extracted). */
export const FIRST_SOURCE_TIME = pieces[0]?.from ?? 0;

const PHONE_LEFT = (1080 - PHONE_W) / 2;
const PHONE_TOP = 200;
/** Composition position of recording px (0, 0). */
const SCREEN_ORIGIN = {
    x: PHONE_LEFT + BEZEL + FIT.ox,
    y: PHONE_TOP + BEZEL + PAGE_TOP + FIT.oy
};
/** Rest focus (centre of the recording) in composition px: zoom 1 there is the identity. */
const ANCHOR = {
    x: SCREEN_ORIGIN.x + (REC.width / 2) * FIT.k,
    y: SCREEN_ORIGIN.y + (REC.height / 2) * FIT.k
};

/** First composition frame at which source time `t` is on screen, or undefined if it was cut. */
const frameOf = (t: number, tolerance = 0.12): number | undefined => {
    const i = timeMap.findIndex((s) => s >= t);
    const shown = timeMap[i];
    return shown === undefined || shown - t > tolerance ? undefined : INTRO + i;
};

const stageFrames = STAGES.map((s) => {
    const e = find(recording.events, s.mark);
    const i = e ? timeMap.findIndex((t) => t >= e.t) : -1;
    return { stage: s, at: i === -1 ? undefined : INTRO + i };
}).filter((s): s is { stage: (typeof STAGES)[number]; at: number } => s.at !== undefined);

const touches = recording.events
    .flatMap((e) =>
        e.kind === 'tap' && e.box
            ? [{ x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2, at: frameOf(e.t + 0.25) }]
            : []
    )
    .filter((t): t is { x: number; y: number; at: number } => t.at !== undefined);

const ACTOR_HOLD = 72;

const buildCues = (): Cue[] => {
    const cues: Cue[] = [
        { at: INTRO - 36, file: 'swell.wav', volume: 0.55 },
        { at: INTRO - 12, file: 'whoosh.wav', volume: 0.45 },
        { at: OUTRO_AT, file: 'whoosh.wav', volume: 0.45 }
    ];
    for (const t of touches) cues.push({ at: t.at, file: 'tap.wav', volume: 0.7 });
    for (const c of cuts)
        if (c.cut === 'wipe')
            cues.push({ at: INTRO + c.frame - 8, file: 'whoosh-short.wav', volume: 0.55 });
    for (const s of stageFrames) cues.push({ at: s.at + 4, file: 'pop.wav', volume: 0.45 });
    const toast = find(recording.events, 'toast:guardado');
    const toastAt = toast ? frameOf(toast.t, 0.5) : undefined;
    if (toastAt) cues.push({ at: toastAt, file: 'ding.wav', volume: 0.65 });
    let k = 0;
    recording.events
        .filter((e) => e.kind === 'type' && e.end !== undefined)
        .forEach((e) => {
            timeMap.forEach((t, i) => {
                if (t >= e.t && t <= (e.end ?? 0) && i % 3 === 0)
                    cues.push({ at: INTRO + i, file: `key-${(k++ % 3) + 1}.wav`, volume: 0.3 });
            });
        });
    return cues;
};
const CUES = buildCues();

/**
 * Video A1: a host creates an accommodation and adds its description.
 * Intro (Hospedín + hook, tilted phone) → tutorial on a realistic phone with spotlight, eased
 * camera, jump cuts and brand wipes → closing card. Music bed, SFX and a sting on the logo.
 */
export const A1: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const s = Math.min(Math.max(frame - INTRO, 0), SCREEN - 1);
    const inScreen = frame >= INTRO && frame < OUTRO_AT;
    const cam = (inScreen ? camera[s] : undefined) ?? {
        zoom: 1,
        fx: REC.width / 2,
        fy: REC.height / 2
    };
    const curSpot = spot[s];

    // Jump cuts get a tiny zoom punch so they read as an edit, not a glitch.
    const lastJump = cuts.filter((c) => c.cut === 'jump' && INTRO + c.frame <= frame).at(-1);
    const punch = lastJump
        ? interpolate(frame - INTRO - lastJump.frame, [0, 7], [1.035, 1], {
              extrapolateRight: 'clamp'
          })
        : 1;
    const zoom = cam.zoom * punch;
    const fx = SCREEN_ORIGIN.x + cam.fx * FIT.k;
    const fy = SCREEN_ORIGIN.y + cam.fy * FIT.k;

    // Phone staging: tilted at the right in the intro, straight in the tutorial, out at the end.
    const enter = spring({
        frame: frame - (INTRO - 16),
        fps,
        config: { damping: 17, stiffness: 110 }
    });
    const leave = spring({ frame: frame - OUTRO_AT, fps, config: { damping: 18, stiffness: 100 } });
    const introIn = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 90 } });
    const tilt = (1 - enter) * 1 + leave;
    const phoneTransform = `translate(${(1 - enter) * 300 + leave * 520}px, ${(1 - introIn) * 900 + (1 - enter) * 160 + leave * 1500}px) perspective(2200px) rotateY(${tilt * -24}deg) rotateX(${tilt * 8}deg) rotateZ(${tilt * 5}deg) scale(${1 - (1 - enter) * 0.38 - leave * 0.45})`;

    const parallax = { x: (ANCHOR.x - fx) * (zoom - 1), y: (ANCHOR.y - fy) * (zoom - 1) };
    const current = stageFrames.filter((st) => st.at <= frame).at(-1);
    const chipStage = stageFrames.filter((st) => st.stage.step && st.at <= frame).at(-1);
    const chipVisible = chipStage
        ? interpolate(
              frame,
              [chipStage.at, chipStage.at + 10, OUTRO_AT - 10, OUTRO_AT],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )
        : 0;

    let offset = INTRO;
    return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
            <Backdrop parallax={parallax} />

            <AbsoluteFill
                style={{
                    transformOrigin: '0 0',
                    transform: `translate(${ANCHOR.x - fx * zoom}px, ${ANCHOR.y - fy * zoom}px) scale(${zoom})`
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        left: PHONE_LEFT,
                        top: PHONE_TOP,
                        width: PHONE_W,
                        height: PHONE_H,
                        transform: phoneTransform,
                        transformOrigin: '50% 50%'
                    }}
                >
                    <PhoneFrame
                        fit={FIT}
                        overlay={
                            <>
                                {inScreen && curSpot && (
                                    <Spotlight
                                        spot={curSpot}
                                        fit={FIT}
                                    />
                                )}
                                {touches.map((t) => (
                                    <Touch
                                        key={t.at}
                                        x={t.x}
                                        y={t.y}
                                        at={t.at}
                                        fit={FIT}
                                    />
                                ))}
                                {cuts
                                    .filter((c) => c.cut === 'wipe')
                                    .map((c) => (
                                        <Wipe
                                            key={c.frame}
                                            at={INTRO + c.frame}
                                        />
                                    ))}
                            </>
                        }
                    >
                        {frame < INTRO && (
                            <Img
                                src={staticFile('a1/first.png')}
                                style={{ width: '100%' }}
                            />
                        )}
                        {pieces.map((p, i) => {
                            const from = offset;
                            const length = frames[i] ?? 0;
                            offset += length;
                            return (
                                <Sequence
                                    key={p.from}
                                    from={from}
                                    durationInFrames={length}
                                >
                                    <OffthreadVideo
                                        src={staticFile('a1/screen.mp4')}
                                        startFrom={Math.round(p.from * FPS)}
                                        playbackRate={RATE}
                                        muted
                                        style={{ width: '100%' }}
                                    />
                                </Sequence>
                            );
                        })}
                        {frame >= OUTRO_AT && (
                            <Img
                                src={staticFile('a1/last.png')}
                                style={{ width: '100%' }}
                            />
                        )}
                    </PhoneFrame>
                </div>
            </AbsoluteFill>

            {frame < INTRO + 4 && (
                <>
                    <div style={{ position: 'absolute', top: 130, left: 0, right: 0 }}>
                        <KineticText
                            text={'¿Querés publicar\ntu alojamiento?'}
                            at={6}
                            size={88}
                            out={INTRO - 14}
                        />
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            left: -40,
                            bottom: 40,
                            transform: `translateX(${interpolate(frame, [INTRO - 16, INTRO], [0, -760], { extrapolateLeft: 'clamp' })}px)`
                        }}
                    >
                        <HospedinActor
                            pose="main"
                            height={1080}
                            at={2}
                        />
                    </div>
                </>
            )}

            {inScreen && chipStage && (
                <StepChip
                    step={chipStage.stage.step ?? ''}
                    label={chipStage.stage.chip ?? ''}
                    since={chipStage.at}
                    visible={chipVisible}
                />
            )}

            {inScreen && current && frame < current.at + ACTOR_HOLD + 14 && (
                <>
                    <Bubble
                        text={current.stage.say}
                        at={current.at + 8}
                        out={current.at + ACTOR_HOLD}
                        style={{ right: 300, bottom: 520 }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            right: -10,
                            bottom: 30,
                            transform: `translateX(${(1 - spring({ frame: frame - current.at, fps, config: { damping: 15, stiffness: 140 } })) * 520 + interpolate(frame, [current.at + ACTOR_HOLD, current.at + ACTOR_HOLD + 12], [0, 560], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`
                        }}
                    >
                        <HospedinActor
                            pose={current.stage.pose}
                            height={520}
                            at={current.at}
                        />
                    </div>
                </>
            )}

            {frame >= OUTRO_AT && (
                <>
                    <ClosingCard at={OUTRO_AT + 8} />
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 30,
                            display: 'flex',
                            justifyContent: 'center'
                        }}
                    >
                        <HospedinActor
                            pose="vamos"
                            height={820}
                            at={OUTRO_AT + 14}
                        />
                    </div>
                </>
            )}

            <SoundTrack
                cues={CUES}
                musicOut={OUTRO_AT + 10}
                stingImpact={OUTRO_AT + 8}
                total={A1_DURATION}
            />
        </AbsoluteFill>
    );
};
