import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { DropIcon, ThermometerIcon, WindIcon } from '@repo/icons';
/**
 * @file DestinationWeatherIsland.client.tsx
 * @description Live weather island for a destination. Fetches the current
 * conditions and 16-day forecast from the weather cache endpoint on mount.
 *
 * Graceful degradation: on fetch error, non-200, null payload, or empty
 * daily array, renders a single neutral "unavailable" line — never throws,
 * never breaks layout, never shows error styling.
 */
import { useEffect, useState } from 'react';
import styles from './DestinationWeatherIsland.module.css';
import { getWeatherConditionKey, getWeatherIcon } from './weather-icons';

interface CurrentWeather {
    readonly temperatureC: number;
    readonly apparentTemperatureC: number;
    readonly weatherCode: number;
    readonly condition: string;
    readonly windSpeedKmh: number;
    readonly humidityPct: number;
    readonly isDay: boolean;
}

interface DailyForecast {
    readonly date: string;
    readonly tempMinC: number;
    readonly tempMaxC: number;
    readonly weatherCode: number;
    readonly condition: string;
    readonly precipMm?: number;
}

interface WeatherData {
    readonly current: CurrentWeather;
    readonly daily: ReadonlyArray<DailyForecast>;
    readonly fetchedAt: string;
}

type FetchState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly data: WeatherData }
    | { readonly status: 'empty' };

interface DestinationWeatherIslandProps {
    readonly locale: SupportedLocale;
    readonly destinationId: string;
    readonly apiUrl: string;
}

/**
 * Formats a YYYY-MM-DD date string as a short weekday + day label.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @param locale - Locale string for Intl
 * @returns Short weekday/day label (e.g. "lun 12")
 */
function formatForecastDate(dateStr: string, locale: string): string {
    try {
        const date = new Date(`${dateStr}T12:00:00`);
        const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
        const day = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(date);
        return `${weekday} ${day}`;
    } catch {
        return dateStr;
    }
}

/**
 * Live weather display island for a destination detail page.
 *
 * Fetches current + 16-day forecast from the public weather cache endpoint.
 * Shows a skeleton while loading, condition icon + temperature + meta on ready,
 * and a neutral single-line fallback if data is unavailable.
 *
 * @param props - Locale, destinationId, and API base URL
 */
export function DestinationWeatherIsland({
    locale,
    destinationId,
    apiUrl
}: DestinationWeatherIslandProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<FetchState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        const base = apiUrl.replace(/\/$/, '');

        async function fetchWeather() {
            try {
                const response = await fetch(
                    `${base}/api/v1/public/destinations/${destinationId}/weather`
                );
                if (!response.ok || cancelled) {
                    if (!cancelled) setState({ status: 'empty' });
                    return;
                }
                const body = (await response.json()) as WeatherData | null;
                if (cancelled) return;
                if (
                    !body ||
                    !body.current ||
                    !Array.isArray(body.daily) ||
                    body.daily.length === 0
                ) {
                    setState({ status: 'empty' });
                    return;
                }
                setState({ status: 'ready', data: body });
            } catch {
                if (!cancelled) setState({ status: 'empty' });
            }
        }

        void fetchWeather();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, destinationId]);

    if (state.status === 'loading') {
        return (
            <div
                className={styles.skeleton}
                aria-busy="true"
                aria-label={t('destination.weather.title', 'Tiempo actual')}
            />
        );
    }

    if (state.status === 'empty') {
        return (
            <p className={styles.unavailable}>
                {t('destination.weather.unavailable', 'Clima no disponible por el momento')}
            </p>
        );
    }

    const { current, daily } = state.data;
    const CurrentIcon = getWeatherIcon({ condition: current.condition, isDay: current.isDay });
    const conditionLabel = t(getWeatherConditionKey(current.condition), current.condition);

    return (
        <div className={styles.container}>
            {/* Current conditions */}
            <div className={styles.current}>
                <span
                    className={styles.currentIcon}
                    aria-hidden="true"
                >
                    <CurrentIcon
                        size={40}
                        weight="duotone"
                    />
                </span>
                <div className={styles.currentInfo}>
                    <p className={styles.currentTemp}>
                        {Math.round(current.temperatureC)}
                        {t('destination.climate.units.celsius', '°C')}
                    </p>
                    <p className={styles.currentCondition}>{conditionLabel}</p>
                    <div className={styles.currentMeta}>
                        <span className={styles.currentMetaItem}>
                            <ThermometerIcon
                                size={14}
                                weight="regular"
                                aria-hidden="true"
                            />
                            <span className={styles.currentMetaLabel}>
                                {t('destination.weather.feelsLike', 'Sensación térmica')}:
                            </span>{' '}
                            {Math.round(current.apparentTemperatureC)}
                            {t('destination.climate.units.celsius', '°C')}
                        </span>
                        <span className={styles.currentMetaItem}>
                            <DropIcon
                                size={14}
                                weight="regular"
                                aria-hidden="true"
                            />
                            <span className={styles.currentMetaLabel}>
                                {t('destination.weather.humidity', 'Humedad')}:
                            </span>{' '}
                            {current.humidityPct}%
                        </span>
                        <span className={styles.currentMetaItem}>
                            <WindIcon
                                size={14}
                                weight="regular"
                                aria-hidden="true"
                            />
                            <span className={styles.currentMetaLabel}>
                                {t('destination.weather.wind', 'Viento')}:
                            </span>{' '}
                            {Math.round(current.windSpeedKmh)} km/h
                        </span>
                    </div>
                </div>
            </div>

            {/* 16-day forecast strip */}
            {daily.length > 0 && (
                <div className={styles.forecastSection}>
                    <p className={styles.forecastTitle}>
                        {t('destination.weather.forecast', 'Pronóstico a 16 días')}
                    </p>
                    <ul
                        className={styles.forecastStrip}
                        aria-label={t('destination.weather.forecast', 'Pronóstico a 16 días')}
                    >
                        {daily.map((day) => {
                            const DayIcon = getWeatherIcon({
                                condition: day.condition,
                                isDay: true
                            });
                            return (
                                <li
                                    key={day.date}
                                    className={styles.forecastDay}
                                >
                                    <span className={styles.forecastDate}>
                                        {formatForecastDate(day.date, locale)}
                                    </span>
                                    <span
                                        className={styles.forecastIcon}
                                        aria-hidden="true"
                                    >
                                        <DayIcon
                                            size={20}
                                            weight="duotone"
                                        />
                                    </span>
                                    <span className={styles.forecastTemps}>
                                        <span className={styles.forecastMax}>
                                            {Math.round(day.tempMaxC)}°
                                        </span>
                                        <span className={styles.forecastMin}>
                                            {Math.round(day.tempMinC)}°
                                        </span>
                                    </span>
                                    {day.precipMm !== undefined && day.precipMm > 0 && (
                                        <span className={styles.forecastPrecip}>
                                            {Math.round(day.precipMm)}mm
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
