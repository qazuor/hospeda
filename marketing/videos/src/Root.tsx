import type React from 'react';
import { AbsoluteFill, Composition, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { A1, A1_DURATION } from './a1/A1';

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
    </>
);
