import type React from 'react';
import { Audio, interpolate, Sequence, staticFile } from 'remotion';

/** A one-shot sound effect at a composition frame. */
export type Cue = { readonly at: number; readonly file: string; readonly volume: number };

type SoundTrackProps = {
    readonly cues: readonly Cue[];
    /** Frame where the music starts fading out, and where the closing sting must land its impact. */
    readonly musicOut: number;
    readonly stingImpact: number;
    readonly total: number;
};

/** Impact of outro-sting.wav, seconds into the file (tools/audio/README.md). */
const STING_IMPACT_S = 0.409;
const FPS = 30;

/** Music bed (fades out at the end), closing sting and every SFX cue. */
export const SoundTrack: React.FC<SoundTrackProps> = ({ cues, musicOut, stingImpact, total }) => {
    const stingStart = Math.round(stingImpact - STING_IMPACT_S * FPS);
    return (
        <>
            <Audio
                src={staticFile('audio/music.wav')}
                volume={(f) =>
                    interpolate(f, [0, 6, musicOut, musicOut + 30], [0, 0.9, 0.9, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp'
                    })
                }
            />
            <Sequence
                from={stingStart}
                durationInFrames={Math.max(1, total - stingStart)}
            >
                <Audio
                    src={staticFile('audio/outro-sting.wav')}
                    volume={0.95}
                />
            </Sequence>
            {cues.map((c, i) => (
                <Sequence
                    // biome-ignore lint/suspicious/noArrayIndexKey: static cue list; the same file can repeat on the same frame
                    key={`${c.file}-${c.at}-${i}`}
                    from={Math.max(0, c.at)}
                    durationInFrames={30}
                >
                    <Audio
                        src={staticFile(`audio/${c.file}`)}
                        volume={c.volume}
                    />
                </Sequence>
            ))}
        </>
    );
};
