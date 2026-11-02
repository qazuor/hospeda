import rec from '@marketing-assets/vc3/events.json';
import type React from 'react';
import { staticFile } from 'remotion';
import type { Recording } from '../a1/timeline';
import { buildTutorialEdit } from '../tutorial/edit';
import { Mask } from '../tutorial/Mask';
import { PhoneTutorial } from '../tutorial/PhoneTutorial';
import {
    buildStagePieces,
    buildWindows,
    HERO_FILL,
    PRICE_TIER_BADGE,
    restStart,
    STAGES
} from './timeline';

const recording = rec as Recording;
const EDIT = buildTutorialEdit({
    rec: recording,
    stages: buildStagePieces(recording),
    windows: buildWindows(recording),
    // Each framing holds from the first frame after its jump cut.
    snapAtJumps: true
});

/** The price-tier badge is hidden while the top of the public listing is on screen. */
const BADGE_FROM = (EDIT.stageStarts[2] ?? EDIT.outroAt) - 1;
const BADGE_TO = EDIT.frameOf(restStart(recording), 0.5) ?? EDIT.outroAt;

/** Total length of VC3, for the Composition registration. */
export const VC3_DURATION = EDIT.duration;

/**
 * Video VC3 «Sumá tu local»: a venue owner publishes a parrilla on staging. Intro → stage 1
 * (name, category, summary) → stage 2 (photos and the map pin, the latter BORROWED from the
 * accommodation editor until the venue map ships) → stage 3 (the public listing) → closing.
 */
export const VC3: React.FC = () => (
    <PhoneTutorial
        edit={EDIT}
        src={staticFile('vc3/screen.mp4')}
        stages={STAGES}
        hook={'¿Querés sumar\ntu local?'}
        closingTitle={'Sumá tu\nlocal'}
        closingBadge="30 días de prueba gratis · Sin tarjeta"
        screenOverlay={
            <Mask
                box={PRICE_TIER_BADGE}
                from={BADGE_FROM}
                to={BADGE_TO}
                fit={EDIT.fit}
                inset={0}
                fill={HERO_FILL}
                bar={false}
            />
        }
    />
);
