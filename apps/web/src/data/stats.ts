/**
 * @file stats.ts
 * @description Static platform statistics for the StatsSection.
 * Each stat card displays an icon, numeric value, label, and description.
 * Values are placeholder data representing approximate platform metrics.
 */
import {
    CalendarIcon,
    FavoriteIcon,
    HomeIcon,
    LocationIcon,
    StarIcon,
    UsersIcon
} from '@repo/icons';
import type { Stat } from './types';

/** Platform metric cards displayed in the StatsSection grid */
export const STATS: readonly Stat[] = [
    { icon: HomeIcon, value: '120+', label: 'Alojamientos', description: 'en toda la provincia' },
    { icon: UsersIcon, value: '15.000+', label: 'Viajeros', description: 'nos eligieron este ano' },
    { icon: LocationIcon, value: '25', label: 'Destinos', description: 'para explorar' },
    { icon: StarIcon, value: '4.8', label: 'Calificacion', description: 'promedio de huespedes' },
    { icon: CalendarIcon, value: '50+', label: 'Eventos', description: 'publicados por mes' },
    { icon: FavoriteIcon, value: '98%', label: 'Satisfaccion', description: 'de nuestros usuarios' }
] as const;
