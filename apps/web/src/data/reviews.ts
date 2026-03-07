/**
 * @file reviews.ts
 * @description Static guest review data for the testimonials section.
 * These reviews serve as placeholder content until the API provides real reviews.
 */
import type { Review } from './types';

/** Placeholder guest reviews displayed in the ReviewsSection testimonials grid */
export const REVIEWS: readonly Review[] = [
    {
        name: 'Maria L.',
        location: 'Buenos Aires',
        text: 'Pasamos un fin de semana increible en Colon. El hotel tenia una vista espectacular al rio y la atencion fue de primera.',
        rating: 5,
        accommodation: 'Hotel Boutique Rio Azul'
    },
    {
        name: 'Carlos R.',
        location: 'Rosario',
        text: 'Las cabanas en Concordia fueron perfectas para desconectar. El contacto con la naturaleza es lo mejor que tiene esta region.',
        rating: 5,
        accommodation: 'Cabanas del Litoral'
    },
    {
        name: 'Ana S.',
        location: 'Cordoba',
        text: 'El glamping fue una experiencia unica. Dormir bajo las estrellas escuchando el rio es algo que todos deberian vivir.',
        rating: 5,
        accommodation: 'Glamping Selva Montielera'
    }
] as const;
