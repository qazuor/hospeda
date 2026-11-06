import rec from '@marketing-assets/vc4/events.json';
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
    windows: buildWindows(recording),
    // The summary framing holds from the first frame after its jump cut.
    snapAtJumps: true
});

/** Total length of VC4, for the Composition registration. */
export const VC4_DURATION = EDIT.duration;

/**
 * Video VC4 «Publicá tu experiencia»: an experience owner publishes a river kayak outing on
 * staging. Intro → stage 1 (name, category, summary) → stage 2 (photos) → stage 3 (the public
 * listing) → closing with the trial badge.
 */
export const VC4: React.FC = () => (
    <PhoneTutorial
        edit={EDIT}
        src={staticFile('vc4/screen.mp4')}
        stages={STAGES}
        hook={'¿Querés mostrar\ntu salida?'}
        closingTitle={'Publicá tu\nexperiencia'}
        closingBadge="30 días de prueba gratis · Sin tarjeta"
    />
);
