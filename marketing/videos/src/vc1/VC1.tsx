import rec from '@marketing-assets/vc1/events.json';
import type React from 'react';
import { staticFile } from 'remotion';
import type { Recording } from '../a1/timeline';
import { buildTutorialEdit } from '../tutorial/edit';
import { Mask } from '../tutorial/Mask';
import { PhoneTutorial } from '../tutorial/PhoneTutorial';
import { buildStagePieces, buildWindows, capacityStart, priceBox, STAGES } from './timeline';

const recording = rec as Recording;
const EDIT = buildTutorialEdit({
    rec: recording,
    stages: buildStagePieces(recording),
    windows: buildWindows(recording),
    // The capacity framing holds from the first frame after its jump cut.
    snapAtJumps: true
});

/** The price card is redacted for the whole capacity span, which ends at the stage-2 wipe. */
const PRICE_FROM = (EDIT.frameOf(capacityStart(recording), 0.5) ?? EDIT.stageStarts[0] ?? 0) - 1;
const PRICE_TO = EDIT.stageStarts[1] ?? EDIT.outroAt;

/** Total length of VC1, for the Composition registration. */
export const VC1_DURATION = EDIT.duration;

/**
 * Video VC1 «Publicá tu alojamiento en tres pasos»: a host creates a listing from scratch on
 * staging. Intro → stage 1 (name, type, capacity) → stage 2 (map pin, photos, publish prompt)
 * → stage 3 (the public listing) → closing with the trial badge.
 */
export const VC1: React.FC = () => (
    <PhoneTutorial
        edit={EDIT}
        src={staticFile('vc1/screen.mp4')}
        stages={STAGES}
        hook={'¿Querés publicar\ntu alojamiento?'}
        closingTitle={'Publicá tu\nalojamiento'}
        closingBadge="30 días de prueba gratis · Sin tarjeta"
        screenOverlay={
            <Mask
                box={priceBox(recording)}
                from={PRICE_FROM}
                to={PRICE_TO}
                fit={EDIT.fit}
            />
        }
    />
);
