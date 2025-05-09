import type { Accommodation } from '../types/Accommodation';

export const accommodations: Record<string, Accommodation[]> = {
    '1': [
        {
            id: 1,
            title: 'Cabaña frente al río con vista panorámica',
            description: 'Hermosa cabaña con vista directa al río Uruguay.',
            location: 'Concepción del Uruguay, Entre Ríos',
            price: 15000,
            rating: 4.9,
            reviews: 28,
            image: 'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
            images: [
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
                'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg',
                'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg'
            ],
            features: ['2 habitaciones', 'Cocina completa', 'Vista al río', 'Parrilla']
        },
        {
            id: 2,
            title: 'Apartamento céntrico moderno',
            description: 'Moderno apartamento en el centro de la ciudad.',
            location: 'Concepción del Uruguay, Entre Ríos',
            price: 12000,
            rating: 4.7,
            reviews: 42,
            image: 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
            images: [
                'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
                'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
                'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg',
                'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg',
                'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg'
            ],
            features: ['1 habitación', 'Baño privado', 'Cocina equipada', 'WiFi']
        }
    ],
    '2': [
        {
            id: 3,
            title: 'Casa familiar con pileta y jardín',
            description: 'Espaciosa casa ideal para grupos y familias.',
            location: 'Gualeguaychú, Entre Ríos',
            price: 18000,
            rating: 4.8,
            reviews: 35,
            image: 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
            images: [
                'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
                'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
                'https://images.pexels.com/photos/213811/pexels-photo-213811.jpeg',
                'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
                'https://images.pexels.com/photos/1643389/pexels-photo-1643389.jpeg',
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg'
            ],
            features: ['3 habitaciones', 'Parque', 'Pileta', 'Estacionamiento privado']
        },
        {
            id: 4,
            title: 'Loft moderno cerca del corsódromo',
            description: 'Ideal para disfrutar el carnaval y la vida nocturna.',
            location: 'Gualeguaychú, Entre Ríos',
            price: 13000,
            rating: 4.6,
            reviews: 22,
            image: 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
            images: [
                'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
                'https://images.pexels.com/photos/1643389/pexels-photo-1643389.jpeg',
                'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg',
                'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                'https://images.pexels.com/photos/213811/pexels-photo-213811.jpeg',
                'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg'
            ],
            features: ['1 ambiente', 'Cocina integrada', 'Aire acondicionado', 'WiFi']
        }
    ],
    '3': [
        {
            id: 5,
            title: 'Departamento frente al lago Salto Grande',
            description: 'Disfrutá de la tranquilidad y la vista al lago.',
            location: 'Concordia, Entre Ríos',
            price: 14000,
            rating: 4.7,
            reviews: 30,
            image: 'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
            images: [
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
                'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg',
                'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
                'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
                'https://images.pexels.com/photos/213811/pexels-photo-213811.jpeg',
                'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
                'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg'
            ],
            features: ['2 habitaciones', 'Balcón con vista', 'WiFi', 'Cochera']
        },
        {
            id: 6,
            title: 'Cabaña en zona de termas',
            description: 'A metros del parque termal, ideal para descansar.',
            location: 'Concordia, Entre Ríos',
            price: 11000,
            rating: 4.5,
            reviews: 18,
            image: 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
            images: [
                'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
                'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg',
                'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg',
                'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
                'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                'https://images.pexels.com/photos/1643389/pexels-photo-1643389.jpeg',
                'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
                'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg'
            ],
            features: ['1 dormitorio', 'Cocina', 'Parrilla', 'WiFi']
        }
    ],
    '4': [
        {
            id: 7,
            title: 'Bungalow dentro del complejo termal',
            description: 'Acceso directo al parque acuático y termas.',
            location: 'Federación, Entre Ríos',
            price: 16000,
            rating: 4.9,
            reviews: 40,
            image: 'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
            images: [
                'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
                'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg',
                'https://images.pexels.com/photos/1643389/pexels-photo-1643389.jpeg',
                'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                'https://images.pexels.com/photos/213811/pexels-photo-213811.jpeg',
                'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
                'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg',
                'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg',
                'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg'
            ],
            features: ['2 habitaciones', 'Aire acondicionado', 'WiFi', 'Cochera']
        },
        {
            id: 8,
            title: 'Cabaña rústica con vista al lago',
            description: 'Perfecta para descansar y disfrutar de la naturaleza.',
            location: 'Federación, Entre Ríos',
            price: 12500,
            rating: 4.6,
            reviews: 25,
            image: 'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
            images: [
                'https://images.pexels.com/photos/2360673/pexels-photo-2360673.jpeg',
                'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg',
                'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg'
            ],
            features: ['1 habitación', 'Galería con parrilla', 'Vista al lago', 'Estacionamiento']
        }
    ]
};

export function getAllAccommodations() {
    return Object.values(accommodations).flat();
}

export function getAccommodationsByDestination(id: string) {
    return accommodations[id] || [];
}

export function getAccommodationById(id: string) {
    return getAllAccommodations().find((a) => a.id === Number(id));
}

export function getFeaturedAccommodations() {
    const indexes = new Set<number>();

    const allAccommodations: Accommodation[] = getAllAccommodations();

    while (indexes.size < 3 && indexes.size < allAccommodations.length) {
        const randomIndex = Math.floor(Math.random() * allAccommodations.length);
        indexes.add(randomIndex);
    }
    const randomIndexes = Array.from(indexes);
    return randomIndexes.map((i) => allAccommodations[i]);
}
