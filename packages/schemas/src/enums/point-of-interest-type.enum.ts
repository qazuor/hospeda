/**
 * Point of Interest type enum — closed taxonomy for landmark categorization.
 *
 * HOS-113 OQ-3 (resolved): closed enum, no free-text categories.
 *
 * - BEACH: Coastal/riverside beach.
 * - STADIUM: Sports stadium or arena (e.g. autódromo, football stadium).
 * - PARK: Public park or green space.
 * - MUSEUM: Museum or cultural exhibition space.
 * - PLAZA: Public square or plaza.
 * - MONUMENT: Monument, memorial, or historic marker.
 * - VIEWPOINT: Scenic lookout or panoramic viewpoint.
 * - NATURAL: Natural landmark (river, forest, reserve) not covered above.
 * - OTHER: Anything not covered by the other categories.
 */
export enum PointOfInterestTypeEnum {
    BEACH = 'BEACH',
    STADIUM = 'STADIUM',
    PARK = 'PARK',
    MUSEUM = 'MUSEUM',
    PLAZA = 'PLAZA',
    MONUMENT = 'MONUMENT',
    VIEWPOINT = 'VIEWPOINT',
    NATURAL = 'NATURAL',
    OTHER = 'OTHER'
}
