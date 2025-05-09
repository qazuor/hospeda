/**
 * Represents a tourist destination
 */
export interface Destination {
    /** Unique identifier for the destination */
    id: number;
    /** Name of the destination */
    name: string;
    /** Description of the destination */
    description: string;
    /** URL to the main image */
    image: string;
    /** Number of properties available in this destination */
    properties: number;
    /** Additional images of the destination */
    images?: string[];
    /** Key attractions at this destination */
    attractions?: string[];
    /** Location coordinates */
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}
