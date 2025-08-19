'use client';

import 'leaflet/dist/leaflet.css';

type Props = {
    coordinates: {
        lat: number;
        lng: number;
    };
    zoom?: number;
};

export default function DestinationMap({ coordinates: _coordinates, zoom: _zoom = 13 }: Props) {
    // useEffect(() => {
    //     const map = L.map('destination-map').setView([coordinates.lat, coordinates.lng], zoom);

    //     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //         attribution:
    //             '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    //     }).addTo(map);

    //     L.marker([coordinates.lat, coordinates.lng]).addTo(map);

    //     return () => {
    //         map.remove();
    //     };
    // }, [coordinates.lat, coordinates.lng, zoom]);

    return (
        <div
            id="destination-map"
            className="h-64 w-full rounded-md"
        />
    );
}
