import rec from '@marketing-assets/vc5/events.json';
import type React from 'react';
import {
    AbsoluteFill,
    Freeze,
    interpolate,
    OffthreadVideo,
    Sequence,
    spring,
    staticFile,
    useCurrentFrame,
    useVideoConfig
} from 'remotion';
import { Bubble, HospedinActor } from '../a1/HospedinActor';
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
} from '../a1/Phone';
import { type Cue, SoundTrack } from '../a1/Sound';
import { Backdrop, ClosingCard, KineticText, StepChip } from '../a1/scene';
import {
    buildCuts,
    buildFocus,
    buildTimeMap,
    FPS,
    pieceFrames,
    RATE,
    type Recording,
    recordingSize
} from '../a1/timeline';
import { buildStagePieces, buildWindows, INTRO, OUTRO, STAGES } from './timeline';

const recording = rec as Recording;
const { size: REC } = recordingSize({ rec: recording });
const { fit: FIT } = fitRecording({ size: REC });
const SRC = staticFile('vc5/screen.mp4');

const stagePieces = buildStagePieces(recording);
const pieces = stagePieces.flat();
const frames = pieceFrames(pieces);
const timeMap = buildTimeMap(pieces);
const cuts = buildCuts(pieces);
const { camera, spot } = buildFocus({
    rec: recording,
    timeMap,
    cuts,
    scale: FIT.k,
    windows: buildWindows({ events: recording.events })
});
const SCREEN = timeMap.length;
const OUTRO_AT = INTRO + SCREEN;

/** Total length of VC5, for the Composition registration. */
export const VC5_DURATION = OUTRO_AT + OUTRO;

/** Composition frame where each stage starts. */
const stageStarts = stagePieces.map(
    (_, i) =>
        INTRO + pieceFrames(stagePieces.slice(0, i).flat()).reduce((sum, length) => sum + length, 0)
);

const PHONE_LEFT = (1080 - PHONE_W) / 2;
const PHONE_TOP = 200;
const SCREEN_ORIGIN = {
    x: PHONE_LEFT + BEZEL + FIT.ox,
    y: PHONE_TOP + BEZEL + PAGE_TOP + FIT.oy
};
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

const touches = recording.events
    .flatMap((e) =>
        e.kind === 'tap' && e.box
            ? [{ x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2, at: frameOf(e.t + 0.25) }]
            : []
    )
    .filter((t): t is { x: number; y: number; at: number } => t.at !== undefined);

const wipes = cuts.filter((c) => c.cut === 'wipe').map((c) => INTRO + c.frame);
const ACTOR_HOLD = 72;

const CUES: Cue[] = [
    { at: INTRO - 36, file: 'swell.wav', volume: 0.55 },
    { at: INTRO - 12, file: 'whoosh.wav', volume: 0.45 },
    { at: OUTRO_AT, file: 'whoosh.wav', volume: 0.45 },
    ...touches.map((t) => ({ at: t.at, file: 'tap.wav', volume: 0.7 })),
    ...wipes.map((w) => ({ at: w - 8, file: 'whoosh-short.wav', volume: 0.55 })),
    ...stageStarts.map((s) => ({ at: s + 4, file: 'pop.wav', volume: 0.45 }))
];

/** A still of the take at a source second, sized like the playing video. */
const Still: React.FC<{ readonly t: number }> = ({ t }) => (
    <Freeze frame={Math.round(t * FPS)}>
        <OffthreadVideo
            src={SRC}
            muted
            style={{ width: '100%' }}
        />
    </Freeze>
);

/**
 * Video VC5 «Lo que ve el turista»: a real public listing as a tourist sees it. Intro (hook +
 * Hospedín, tilted phone) → stage 1 (photos, description, the page in English and Portuguese,
 * brand wipes over each load) → stage 2 (map and nearby places with distances) → closing card.
 * The listing has no weather block, so the brief's third stage is not in the cut.
 */
export const VC5: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const s = Math.min(Math.max(frame - INTRO, 0), SCREEN - 1);
    const inScreen = frame >= INTRO && frame < OUTRO_AT;
    const cam = (inScreen ? camera[s] : undefined) ?? {
        zoom: 1,
        fx: REC.width / 2,
        fy: REC.height / 2
    };
    const zoom = cam.zoom;
    const fx = SCREEN_ORIGIN.x + cam.fx * FIT.k;
    const fy = SCREEN_ORIGIN.y + cam.fy * FIT.k;

    const enter = spring({
        frame: frame - (INTRO - 16),
        fps,
        config: { damping: 17, stiffness: 110 }
    });
    const leave = spring({ frame: frame - OUTRO_AT, fps, config: { damping: 18, stiffness: 100 } });
    const introIn = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 90 } });
    const tilt = 1 - enter + leave;
    const phoneTransform = `translate(${(1 - enter) * 300 + leave * 520}px, ${(1 - introIn) * 900 + (1 - enter) * 160 + leave * 1500}px) perspective(2200px) rotateY(${tilt * -24}deg) rotateX(${tilt * 8}deg) rotateZ(${tilt * 5}deg) scale(${1 - (1 - enter) * 0.38 - leave * 0.45})`;
    const parallax = { x: (ANCHOR.x - fx) * (zoom - 1), y: (ANCHOR.y - fy) * (zoom - 1) };

    const stageIndex = stageStarts.filter((at) => at <= frame).length - 1;
    const stage = STAGES[stageIndex];
    const stageAt = stageStarts[stageIndex] ?? INTRO;
    const chipVisible = interpolate(
        frame,
        [INTRO, INTRO + 10, OUTRO_AT - 10, OUTRO_AT],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    const curSpot = spot[s];
    const firstT = pieces[0]?.from ?? 0;
    const lastT = pieces.at(-1)?.to ?? 0;

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
                                {wipes.map((at) => (
                                    <Wipe
                                        key={at}
                                        at={at}
                                        tintLogo={false}
                                    />
                                ))}
                            </>
                        }
                    >
                        {frame < INTRO && <Still t={firstT} />}
                        {pieces.map((p, i) => {
                            const from = offset;
                            const length = frames[i] ?? 0;
                            offset += length;
                            return (
                                <Sequence
                                    key={`${p.from}-${p.to}`}
                                    from={from}
                                    durationInFrames={length}
                                >
                                    <OffthreadVideo
                                        src={SRC}
                                        startFrom={Math.round(p.from * FPS)}
                                        playbackRate={RATE}
                                        muted
                                        style={{ width: '100%' }}
                                    />
                                </Sequence>
                            );
                        })}
                        {frame >= OUTRO_AT && <Still t={lastT} />}
                    </PhoneFrame>
                </div>
            </AbsoluteFill>

            {frame < INTRO + 4 && (
                <>
                    <div style={{ position: 'absolute', top: 130, left: 0, right: 0 }}>
                        <KineticText
                            text={'¿Cómo te ve\nel turista?'}
                            at={6}
                            size={92}
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

            {inScreen && stage && (
                <StepChip
                    step={stage.step}
                    label={stage.chip}
                    since={stageAt}
                    visible={chipVisible}
                />
            )}

            {inScreen && stage && frame < stageAt + ACTOR_HOLD + 14 && (
                <>
                    <Bubble
                        text={stage.say}
                        at={stageAt + 8}
                        out={stageAt + ACTOR_HOLD}
                        style={{ right: 300, bottom: 520 }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            right: -10,
                            bottom: 30,
                            transform: `translateX(${(1 - spring({ frame: frame - stageAt, fps, config: { damping: 15, stiffness: 140 } })) * 520 + interpolate(frame, [stageAt + ACTOR_HOLD, stageAt + ACTOR_HOLD + 12], [0, 560], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`
                        }}
                    >
                        <HospedinActor
                            pose={stage.pose}
                            height={520}
                            at={stageAt}
                        />
                    </div>
                </>
            )}

            {frame >= OUTRO_AT && (
                <>
                    <ClosingCard
                        at={OUTRO_AT + 8}
                        title={'Sumate a Hospeda'}
                        logo={{ src: 'brand/logo-full.png', width: 560 }}
                        slogan={null}
                    />
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
                total={VC5_DURATION}
            />
        </AbsoluteFill>
    );
};
