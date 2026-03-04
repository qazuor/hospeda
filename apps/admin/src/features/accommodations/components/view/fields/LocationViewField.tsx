import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui-wrapped/Badge';
import { Card } from '@/components/ui-wrapped/Card';
import type { LocationFieldData } from '@/features/accommodations/types/accommodation-form.types';
import { useTranslations } from '@/hooks/use-translations';

/**
 * Props for LocationViewField component
 */
export type LocationViewFieldProps = {
    /** Location data to display */
    data: LocationFieldData;
    /** Whether to show the field in compact mode */
    compact?: boolean;
    /** Additional CSS classes */
    className?: string;
};

/**
 * Specialized view component for location fields
 *
 * Displays location information in a structured, readable format
 * with visual indicators and optional map integration
 */
export function LocationViewField({
    data,
    compact = false,
    className = ''
}: LocationViewFieldProps) {
    const { t } = useTranslations();
    const hasCoordinates = data.latitude && data.longitude;

    // Format coordinates for display
    const formatCoordinate = (coord: number, type: 'lat' | 'lng') => {
        const direction = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : coord >= 0 ? 'E' : 'W';
        return `${Math.abs(coord).toFixed(6)}°${direction}`;
    };

    // Generate Google Maps URL
    const getMapUrl = () => {
        if (!hasCoordinates) return null;
        return `https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=15`;
    };

    // Generate address string
    const getFullAddress = () => {
        const parts = [data.address, data.city, data.state, data.country, data.postalCode].filter(
            Boolean
        );

        return parts.join(', ');
    };

    if (compact) {
        return (
            <div className={`flex items-center space-x-2 ${className}`}>
                <Icon
                    name="map-pin"
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                />
                <span className="truncate text-foreground text-sm">{getFullAddress()}</span>
                {data.destinationName && (
                    <Badge
                        variant="secondary"
                        size="sm"
                    >
                        {data.destinationName}
                    </Badge>
                )}
            </div>
        );
    }

    return (
        <Card className={`p-4 ${className}`}>
            <div className="space-y-4">
                {/* Destination */}
                {data.destinationName && (
                    <div className="flex items-center space-x-2">
                        <Icon
                            name="globe"
                            className="h-5 w-5 text-primary"
                        />
                        <div>
                            <span className="font-medium text-muted-foreground text-sm">
                                {t('admin-pages.accommodations.location.destination')}
                            </span>
                            <p className="text-foreground text-sm">{data.destinationName}</p>
                        </div>
                    </div>
                )}

                {/* Address */}
                <div className="flex items-start space-x-2">
                    <Icon
                        name="map-pin"
                        className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400"
                    />
                    <div className="flex-1">
                        <span className="font-medium text-muted-foreground text-sm">
                            {t('admin-pages.accommodations.location.address')}
                        </span>
                        <div className="mt-1 space-y-1">
                            <p className="text-foreground text-sm">{data.address}</p>
                            <p className="text-muted-foreground text-sm">
                                {data.city}, {data.state} {data.postalCode}
                            </p>
                            <p className="text-muted-foreground text-sm">{data.country}</p>
                        </div>
                    </div>
                </div>

                {/* Coordinates */}
                {hasCoordinates && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div>
                                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                    {t('admin-pages.accommodations.location.coordinates')}
                                </span>
                                <p className="text-foreground text-sm">
                                    {data.latitude && data.longitude && (
                                        <>
                                            {formatCoordinate(data.latitude, 'lat')},{' '}
                                            {formatCoordinate(data.longitude, 'lng')}
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Map Link */}
                        {getMapUrl() && (
                            <a
                                href={getMapUrl() || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <Icon
                                    name="map-pin"
                                    className="mr-1 h-3 w-3"
                                />
                                {t('admin-pages.accommodations.location.viewOnMap')}
                            </a>
                        )}
                    </div>
                )}

                {/* Location Notes */}
                {data.locationNotes && (
                    <div className="border-border border-t pt-3">
                        <span className="font-medium text-muted-foreground text-sm">
                            {t('admin-pages.accommodations.location.notes')}
                        </span>
                        <p className="mt-1 text-muted-foreground text-sm">{data.locationNotes}</p>
                    </div>
                )}
            </div>
        </Card>
    );
}
