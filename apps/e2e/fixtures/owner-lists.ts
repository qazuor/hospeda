/**
 * Role-list names of «Mis alojamientos» (HOS-2626 split the page into one list
 * per state: «Mis alojamientos: Publicadas (n)», «...: Borradores (n)», ...).
 * A card lookup by name does not care which state holds it, so it targets every
 * state list; the «Publicar» affordance only exists on drafts.
 */

/** Matches every per-state list of «Mis alojamientos». */
export const ALL_PROPERTY_LISTS = /^Mis alojamientos/;

/** Matches the drafts list of «Mis alojamientos». */
export const DRAFT_PROPERTY_LIST = /^Mis alojamientos: Borradores/;
