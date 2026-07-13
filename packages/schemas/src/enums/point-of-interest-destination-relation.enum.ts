/**
 * Point of Interest ⇄ Destination relation kind (HOS-140).
 *
 * Distinguishes the two kinds of association a
 * `r_destination_point_of_interest` join row can represent:
 *
 * - PRIMARY: The POI is physically located in this destination — the
 *   default and the only kind that existed before HOS-140.
 * - NEARBY: The POI is not located in this destination, but is close
 *   enough to be worth cross-referencing from this destination's page
 *   (e.g. a POI physically inside Concordia surfaced on Colón's page).
 */
export enum PointOfInterestDestinationRelationEnum {
    PRIMARY = 'PRIMARY',
    NEARBY = 'NEARBY'
}
