'use client';

import 'leaflet/dist/leaflet.css';
import { useRef } from 'react';

type Props = {
    lat: number;
    lng: number;
    zoom?: number;
};

export default function AccommodationMap({ lat: _lat, lng: _lng, zoom: _zoom = 13 }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);

    // useEffect(() => {
    //     if (!mapRef.current) return;

    //     const map = L.map(mapRef.current).setView([lat, lng], zoom);

    //     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //         attribution:
    //             '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    //     }).addTo(map);

    //     L.marker([lat, lng]).addTo(map);

    //     return () => {
    //         map.remove();
    //     };
    // }, [lat, lng, zoom]);

    return (
        <div
            ref={mapRef}
            className="h-64 w-full rounded-md shadow-md"
        />
    );
}
