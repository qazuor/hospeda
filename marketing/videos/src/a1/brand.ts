import { loadFont as loadGeologica } from '@remotion/google-fonts/Geologica';
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';

/** Hospeda palette, from marketing/personaje-hospedin.md (character + plates). */
export const BRAND = {
    blue: '#3AA7D9',
    teal: '#1EA7A1',
    green: '#8CC63F',
    orange: '#F5A623',
    ink: '#0D2B3E',
    white: '#FFFFFF',
    sky: '#EAF6FC'
} as const;

/** The web app's fonts: Geologica for headings, Roboto for body (FontsLoader.astro). */
export const headingFont = loadGeologica('normal', {
    weights: ['500', '700'],
    subsets: ['latin']
}).fontFamily;
/** Body font family (Roboto 400/500), loaded from Google Fonts at render time. */
export const bodyFont = loadRoboto('normal', {
    weights: ['400', '500'],
    subsets: ['latin']
}).fontFamily;
