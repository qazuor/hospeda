export interface CoordinatesType {
    lat: string;
    long: string;
}

export interface BaseLocationType {
    state: string;
    zipCode: string;
    country: string;
    coordinates?: CoordinatesType;
}

export interface FullLocationType extends BaseLocationType {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    department?: string;
}
