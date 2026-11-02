import type React from 'react';
import {
    AbsoluteFill,
    Freeze,
    interpolate,
    OffthreadVideo,
    Sequence,
    spring,
    useCurrentFrame,
    useVideoConfig
} from 'remotion';
import { Bubble, HospedinActor } from '../a1/HospedinActor';
import { BEZEL, PAGE_TOP, PHONE_H, PHONE_W, PhoneFrame, Spotlight, Touch, Wipe } from '../a1/Phone';
import { SoundTrack } from '../a1/Sound';
import { Backdrop, ClosingCard, KineticText, StepChip } from '../a1/scene';
import { FPS, RATE } from '../a1/timeline';
import { INTRO, type TutorialEdit, type TutorialStage } from './edit';

const PHONE_LEFT = (1080 - PHONE_W) / 2;
const PHONE_TOP = 200;
/** Frames Hospedín stays on screen after entering at a stage change. */
const ACTOR_HOLD = 72;

/** Props of {@link PhoneTutorial}. */
export type PhoneTutorialProps = {
    readonly edit: TutorialEdit;
    /** The take, as a staticFile() URL. */
    readonly src: string;
    readonly stages: readonly TutorialStage[];
    /** Intro hook, word by word (`\n` breaks lines). */
    readonly hook: string;
    /** Closing call to action (`\n` breaks lines). */
    readonly closingTitle: string;
    /** Optional badge under the URL pill in the closing (e.g. the trial). */
    readonly closingBadge?: string;
    /** Extra layers drawn over the page, in whole-screen coordinates (e.g. masks). */
    readonly screenOverlay?: React.ReactNode;
};

/**
 * A phone tutorial in the A1 house style, shared by the VC videos: intro (hook + big Hospedín,
 * tilted phone that straightens) → the edited take on the S24 Ultra with eased camera,
 * spotlight, touches, brand wipes (logo as-is) and jump cuts, Hospedín entering at each stage
 * with one line and a step chip → closing card with the full logo and Hospedín celebrating.
 */
export const PhoneTutorial: React.FC<PhoneTutorialProps> = ({
    edit,
    src,
    stages,
    hook,
    closingTitle,
    closingBadge,
    screenOverlay
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const { size, fit, pieces, frames, timeMap, camera, spot, stageStarts, outroAt } = edit;
    const screenOrigin = {
        x: PHONE_LEFT + BEZEL + fit.ox,
        y: PHONE_TOP + BEZEL + PAGE_TOP + fit.oy
    };
    const anchor = {
        x: screenOrigin.x + (size.width / 2) * fit.k,
        y: screenOrigin.y + (size.height / 2) * fit.k
    };

    const s = Math.min(Math.max(frame - INTRO, 0), timeMap.length - 1);
    const inScreen = frame >= INTRO && frame < outroAt;
    const cam = (inScreen ? camera[s] : undefined) ?? {
        zoom: 1,
        fx: size.width / 2,
        fy: size.height / 2
    };
    // Jump cuts get a tiny zoom punch so they read as an edit, not a glitch.
    const lastJump = edit.jumps.filter((j) => j <= frame).at(-1);
    const punch =
        lastJump === undefined
            ? 1
            : interpolate(frame - lastJump, [0, 7], [1.035, 1], { extrapolateRight: 'clamp' });
    const zoom = cam.zoom * punch;
    const fx = screenOrigin.x + cam.fx * fit.k;
    const fy = screenOrigin.y + cam.fy * fit.k;

    const enter = spring({
        frame: frame - (INTRO - 16),
        fps,
        config: { damping: 17, stiffness: 110 }
    });
    const leave = spring({ frame: frame - outroAt, fps, config: { damping: 18, stiffness: 100 } });
    const introIn = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 90 } });
    const tilt = 1 - enter + leave;
    const phoneTransform = `translate(${(1 - enter) * 300 + leave * 520}px, ${(1 - introIn) * 900 + (1 - enter) * 160 + leave * 1500}px) perspective(2200px) rotateY(${tilt * -24}deg) rotateX(${tilt * 8}deg) rotateZ(${tilt * 5}deg) scale(${1 - (1 - enter) * 0.38 - leave * 0.45})`;
    const parallax = { x: (anchor.x - fx) * (zoom - 1), y: (anchor.y - fy) * (zoom - 1) };

    const stageIndex = stageStarts.filter((at) => at <= frame).length - 1;
    const stage = stages[stageIndex];
    const stageAt = stageStarts[stageIndex] ?? INTRO;
    const chipVisible = interpolate(
        frame,
        [INTRO, INTRO + 10, outroAt - 10, outroAt],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    const curSpot = spot[s];
    const still = (t: number): React.ReactNode => (
        <Freeze frame={Math.round(t * FPS)}>
            <OffthreadVideo
                src={src}
                muted
                style={{ width: '100%' }}
            />
        </Freeze>
    );

    let offset = INTRO;
    return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
            <Backdrop parallax={parallax} />

            <AbsoluteFill
                style={{
                    transformOrigin: '0 0',
                    transform: `translate(${anchor.x - fx * zoom}px, ${anchor.y - fy * zoom}px) scale(${zoom})`
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
                        fit={fit}
                        overlay={
                            <>
                                {screenOverlay}
                                {inScreen && curSpot && (
                                    <Spotlight
                                        spot={curSpot}
                                        fit={fit}
                                    />
                                )}
                                {edit.touches.map((t) => (
                                    <Touch
                                        key={t.at}
                                        x={t.x}
                                        y={t.y}
                                        at={t.at}
                                        fit={fit}
                                    />
                                ))}
                                {edit.wipes.map((at) => (
                                    <Wipe
                                        key={at}
                                        at={at}
                                        tintLogo={false}
                                    />
                                ))}
                            </>
                        }
                    >
                        {frame < INTRO && still(pieces[0]?.from ?? 0)}
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
                                        src={src}
                                        startFrom={Math.round(p.from * FPS)}
                                        playbackRate={RATE}
                                        muted
                                        style={{ width: '100%' }}
                                    />
                                </Sequence>
                            );
                        })}
                        {frame >= outroAt && still(pieces.at(-1)?.to ?? 0)}
                    </PhoneFrame>
                </div>
            </AbsoluteFill>

            {frame < INTRO + 4 && (
                <>
                    <div style={{ position: 'absolute', top: 130, left: 0, right: 0 }}>
                        <KineticText
                            text={hook}
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

            {frame >= outroAt && (
                <>
                    <ClosingCard
                        at={outroAt + 8}
                        title={closingTitle}
                        logo={{ src: 'brand/logo-full.png', width: 560 }}
                        slogan={null}
                        badge={closingBadge}
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
                            at={outroAt + 14}
                        />
                    </div>
                </>
            )}

            <SoundTrack
                cues={edit.cues}
                musicOut={outroAt + 10}
                stingImpact={outroAt + 8}
                total={edit.duration}
            />
        </AbsoluteFill>
    );
};
