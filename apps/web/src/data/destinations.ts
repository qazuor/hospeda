import type { Destination } from '../types/Destination';

export const destinations: Record<string, Destination> = {
    '1': {
        id: 1,
        name: 'Concepción del Uruguay',
        description:
            'Histórica ciudad del litoral entrerriano, con playas, balnearios y un patrimonio cultural destacado a orillas del río Uruguay.',
        image: 'https://images.pexels.com/photos/208701/pexels-photo-208701.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        properties: 32,
        attractions: ['Playas', 'Balnearios', 'Palacio San José', 'Paseo Costero'],
        images: [
            'https://images.pexels.com/photos/208701/pexels-photo-208701.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/2525901/pexels-photo-2525901.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/2525903/pexels-photo-2525903.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
        ],
        coordinates: {
            latitude: -32.4825,
            longitude: -58.2372
        }
    },
    '2': {
        id: 2,
        name: 'Concordia',
        description:
            'Ubicada a orillas del lago Salto Grande y el río Uruguay, es conocida por sus termas, cítricos y su cercanía al Parque San Carlos.',
        image: 'https://images.pexels.com/photos/325185/pexels-photo-325185.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        properties: 20,
        attractions: ['Termas', 'Lago Salto Grande', 'Parque San Carlos', 'Costanera'],
        images: [
            'https://images.pexels.com/photos/325185/pexels-photo-325185.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/162809/lake-water-blue-boat-162809.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/912364/pexels-photo-912364.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
        ],
        coordinates: {
            latitude: -31.3926,
            longitude: -58.0166
        }
    },
    '3': {
        id: 3,
        name: 'Gualeguaychú',
        description:
            'Famosa por su carnaval, playas y vida nocturna a orillas del río homónimo. Ideal para disfrutar del verano entrerriano.',
        image: 'https://images.pexels.com/photos/8288954/pexels-photo-8288954.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        properties: 28,
        attractions: ['Carnaval', 'Playas', 'Corsódromo', 'Paseo del Puerto'],
        images: [
            'https://images.pexels.com/photos/8288954/pexels-photo-8288954.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/4101555/pexels-photo-4101555.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/4101567/pexels-photo-4101567.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
        ],
        coordinates: {
            latitude: -33.0067,
            longitude: -58.5172
        }
    },
    '4': {
        id: 4,
        name: 'Federación',
        description:
            'Destino termal por excelencia, con un parque termal reconocido, un lago artificial y un ambiente tranquilo ideal para relajarse.',
        image: 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        properties: 18,
        attractions: ['Termas', 'Lago Salto Grande', 'Parque Acuático', 'Costanera'],
        images: [
            'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/132037/pexels-photo-132037.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
        ],
        coordinates: {
            latitude: -30.9749,
            longitude: -57.9232
        }
    }
};

export function getDestinations() {
    return Object.values(destinations);
}

export function getDestinationById(id: string) {
    return destinations[id];
}
