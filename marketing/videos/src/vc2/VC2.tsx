import rec from '@marketing-assets/vc2/events.json';
import type React from 'react';
import { staticFile } from 'remotion';
import type { Recording } from '../a1/timeline';
import { buildTutorialEdit } from '../tutorial/edit';
import { Mask } from '../tutorial/Mask';
import { PhoneTutorial } from '../tutorial/PhoneTutorial';
import { buildStagePieces, buildWindows, linkBox, STAGES } from './timeline';

const recording = rec as Recording;
const EDIT = buildTutorialEdit({
    rec: recording,
    stages: buildStagePieces(recording),
    windows: buildWindows(recording)
});

/** Total length of VC2, for the Composition registration. */
export const VC2_DURATION = EDIT.duration;

const LINK = linkBox(recording);
const pasteAt = recording.events.find((e) => e.label === 'link')?.t ?? 0;
/** The pasted link stays blurred from the paste until the wipe covers the screen. */
const MASK_FROM = (EDIT.frameOf(pasteAt, 0.5) ?? EDIT.stageStarts[0] ?? 0) - 1;
const MASK_TO = EDIT.stageStarts[1] ?? EDIT.outroAt;

/**
 * Video VC2 «Ya lo tenés publicado: importalo»: a host pastes the link of their listing on
 * another platform and the Hospeda form fills itself. Intro → stage 1 (open the import, paste,
 * import; the link is blurred) → stage 2 (the filled form: name, type, city, description,
 * counts, imported amenities; the price block is skipped) → closing with the trial badge.
 */
export const VC2: React.FC = () => (
    <PhoneTutorial
        edit={EDIT}
        src={staticFile('vc2/screen.mp4')}
        stages={STAGES}
        hook={'¿Ya estás publicado\nen otro lado?'}
        closingTitle={'Publicá tu\nalojamiento'}
        closingBadge="30 días de prueba gratis · Sin tarjeta"
        screenOverlay={
            <Mask
                box={LINK}
                from={MASK_FROM}
                to={MASK_TO}
                fit={EDIT.fit}
            />
        }
    />
);
