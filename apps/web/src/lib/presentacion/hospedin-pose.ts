/**
 * @file hospedin-pose.ts
 * @description The Hospedín cutout poses, as a plain TypeScript type so `.ts`
 * modules (the presentation list in `lib/attribution/presentation-links.ts`) can
 * name a pose without importing an `.astro` component. `HospedinFigure.astro`
 * re-exports it.
 */

/** The poses available as cutouts. */
export type HospedinPose =
    | 'camara'
    | 'lamparita'
    | 'saludando'
    | 'senalando'
    | 'te-explico'
    | 'telefono'
    | 'vamos';
