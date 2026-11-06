import rec from '@marketing-assets/vc5/events.json';
import type React from 'react';
import { staticFile } from 'remotion';
import type { Recording } from '../a1/timeline';
import { buildTutorialEdit } from '../tutorial/edit';
import { PhoneTutorial } from '../tutorial/PhoneTutorial';
import { buildStagePieces, buildWindows, STAGES } from './timeline';

const recording = rec as Recording;
const EDIT = buildTutorialEdit({
    rec: recording,
    stages: buildStagePieces(recording),
    windows: buildWindows(recording)
});

/** Total length of VC5, for the Composition registration. */
export const VC5_DURATION = EDIT.duration;

/**
 * Video VC5 «Lo que ve el turista»: a real public listing as a tourist sees it. Intro →
 * stage 1 (photos, description, the page in English and Portuguese, brand wipes over each
 * load) → stage 2 (map and nearby places with distances) → closing card.
 * The listing has no weather block, so the brief's third stage is not in the cut.
 */
export const VC5: React.FC = () => (
    <PhoneTutorial
        edit={EDIT}
        src={staticFile('vc5/screen.mp4')}
        stages={STAGES}
        hook={'¿Cómo te ve\nel turista?'}
        closingTitle="Sumate a Hospeda"
    />
);
