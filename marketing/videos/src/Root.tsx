import type React from 'react';
import { AbsoluteFill, Composition, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { A1, A1_DURATION } from './a1/A1';
import { VC1, VC1_DURATION } from './vc1/VC1';
import { VC2, VC2_DURATION } from './vc2/VC2';
import { VC3, VC3_DURATION } from './vc3/VC3';
import { VC4, VC4_DURATION } from './vc4/VC4';
import { VC5, VC5_DURATION } from './vc5/VC5';

/** Placeholder scene: solid brand-dark background with the mascot bobbing in. */
export const Test: React.FC = () => {
    const frame = useCurrentFrame();
    const scale = interpolate(frame, [0, 20], [0.8, 1], { extrapolateRight: 'clamp' });
    return (
        <AbsoluteFill
            style={{ backgroundColor: '#0D2B3E', justifyContent: 'center', alignItems: 'center' }}
        >
            <Img
                src={staticFile('hospedin/main-raw.png')}
                style={{ height: 1500, transform: `scale(${scale})` }}
            />
        </AbsoluteFill>
    );
};

/** Registers every composition of the project. */
export const RemotionRoot: React.FC = () => (
    <>
        <Composition
            id="Test"
            component={Test}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={90}
        />
        <Composition
            id="A1"
            component={A1}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={A1_DURATION}
        />
        <Composition
            id="VC1"
            component={VC1}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={VC1_DURATION}
        />
        <Composition
            id="VC2"
            component={VC2}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={VC2_DURATION}
        />
        <Composition
            id="VC5"
            component={VC5}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={VC5_DURATION}
        />
        <Composition
            id="VC3"
            component={VC3}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={VC3_DURATION}
        />
        <Composition
            id="VC4"
            component={VC4}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={VC4_DURATION}
        />
    </>
);
