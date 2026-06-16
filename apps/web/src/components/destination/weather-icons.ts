import type { IconProps } from '@repo/icons';
import {
    CloudFogIcon,
    CloudIcon,
    CloudLightningIcon,
    CloudMoonIcon,
    CloudRainIcon,
    CloudSnowIcon,
    CloudSunIcon,
    MoonIcon,
    SnowflakeIcon,
    SunIcon
} from '@repo/icons';
/**
 * @file weather-icons.ts
 * @description Maps WMO weather condition strings to @repo/icons components and i18n keys.
 * Used by DestinationWeatherIsland to render condition-appropriate icons.
 */
import type { ComponentType } from 'react';

/** All supported WMO condition strings */
export type WeatherCondition =
    | 'clear'
    | 'mainlyClear'
    | 'partlyCloudy'
    | 'overcast'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'freezingRain'
    | 'snow'
    | 'snowGrains'
    | 'rainShowers'
    | 'snowShowers'
    | 'thunderstorm'
    | 'thunderstormHail'
    | 'unknown';

export type IconComponent = ComponentType<IconProps>;

interface WeatherIconInput {
    readonly condition: string;
    readonly isDay?: boolean;
}

/**
 * Returns the icon component for a given WMO condition string and time-of-day.
 *
 * @param input - Condition string and optional isDay flag
 * @returns The matching @repo/icons component (defaults to CloudIcon for unknown)
 */
export function getWeatherIcon({ condition, isDay = true }: WeatherIconInput): IconComponent {
    switch (condition as WeatherCondition) {
        case 'clear':
            return isDay ? SunIcon : MoonIcon;
        case 'mainlyClear':
            return isDay ? CloudSunIcon : CloudMoonIcon;
        case 'partlyCloudy':
            return isDay ? CloudSunIcon : CloudMoonIcon;
        case 'overcast':
            return CloudIcon;
        case 'fog':
            return CloudFogIcon;
        case 'drizzle':
            return CloudRainIcon;
        case 'rain':
            return CloudRainIcon;
        case 'freezingRain':
            return CloudRainIcon;
        case 'snow':
            return CloudSnowIcon;
        case 'snowGrains':
            return SnowflakeIcon;
        case 'rainShowers':
            return CloudRainIcon;
        case 'snowShowers':
            return CloudSnowIcon;
        case 'thunderstorm':
            return CloudLightningIcon;
        case 'thunderstormHail':
            return CloudLightningIcon;
        default:
            return CloudIcon;
    }
}

/**
 * Returns the i18n key for a WMO condition string.
 *
 * @param condition - WMO condition string
 * @returns Translation key under destinations.weather.conditions.*
 */
export function getWeatherConditionKey(condition: string): string {
    return `destinations.weather.conditions.${condition}`;
}
