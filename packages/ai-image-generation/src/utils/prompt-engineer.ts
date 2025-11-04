/**
 * Prompt engineering utilities for wireframe generation
 *
 * @module utils/prompt-engineer
 */

import { ErrorCode, MockupError, type PromptOptions } from '../types';

/**
 * Device dimensions for wireframes
 */
const DEVICE_DIMENSIONS = {
    desktop: { width: 1024, height: 768 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 812 }
} as const;

/**
 * Spanish translations for common UI elements
 */
const SPANISH_TRANSLATIONS = {
    sign_in: 'Iniciar sesión',
    email: 'Correo electrónico',
    password: 'Contraseña',
    remember_me: 'Recordarme',
    forgot_password: '¿Olvidaste tu contraseña?',
    search: 'Buscar',
    filter: 'Filtrar',
    book_now: 'Reservar ahora',
    view_details: 'Ver detalles',
    availability: 'Disponibilidad',
    rooms: 'Habitaciones',
    price_per_night: 'Precio por noche',
    submit: 'Enviar'
} as const;

/**
 * English translations for common UI elements
 */
const ENGLISH_TRANSLATIONS = {
    sign_in: 'Sign in',
    email: 'Email',
    password: 'Password',
    remember_me: 'Remember me',
    forgot_password: 'Forgot password?',
    search: 'Search',
    filter: 'Filter',
    book_now: 'Book now',
    view_details: 'View details',
    availability: 'Availability',
    rooms: 'Rooms',
    price_per_night: 'Price per night',
    submit: 'Submit'
} as const;

/**
 * Crafts an enhanced prompt for wireframe generation
 *
 * @param userDescription - User's description of the wireframe
 * @param options - Optional configuration for device, style, and language
 * @returns Enhanced prompt with Balsamiq-style instructions
 *
 * @example
 * ```ts
 * const prompt = craftPrompt('Login screen with email and password', {
 *   device: 'mobile',
 *   language: 'es'
 * });
 * ```
 */
export function craftPrompt(userDescription: string, options: PromptOptions = {}): string {
    const { device = 'desktop', style = 'balsamiq', language = 'es' } = options;

    const dimensions = DEVICE_DIMENSIONS[device];
    const translations = language === 'es' ? SPANISH_TRANSLATIONS : ENGLISH_TRANSLATIONS;

    const translationList = Object.entries(translations)
        .map(([, value]) => `- "${value}"`)
        .join('\n');

    const languageName = language === 'es' ? 'Spanish (Argentina)' : 'English';
    const deviceType = device.charAt(0).toUpperCase() + device.slice(1);

    const styleInstructions = getStyleInstructions(style);

    return `Low-fidelity wireframe mockup in ${getStyleName(style)} for tourism platform.
Hand-drawn sketch aesthetic, black and white with gray shading.

UI Elements for: ${userDescription}

IMPORTANT: All text in wireframe MUST be in ${languageName}.
Common translations for this platform:
${translationList}

${styleInstructions}

${deviceType} wireframe (${dimensions.width}x${dimensions.height}px)
- ${getDeviceLayoutInstructions(device)}

Purpose: Planning-stage wireframe to communicate structure and layout.
Style: Low-fidelity, sketch-style, hand-drawn aesthetic.
DO NOT include: realistic images, colors (except grayscale), shadows, or final design polish.`;
}

/**
 * Sanitizes user prompt to remove harmful content
 *
 * @param prompt - The prompt to sanitize
 * @returns Sanitized prompt
 *
 * @throws {MockupError} If prompt is empty after sanitization
 *
 * @example
 * ```ts
 * const safe = sanitizePrompt('Login screen; DROP TABLE users;');
 * // Returns: 'Login screen'
 * ```
 */
export function sanitizePrompt(prompt: string): string {
    let sanitized = prompt.trim();

    // Remove SQL injection attempts
    const sqlPatterns = [
        /DROP\s+TABLE/gi,
        /DELETE\s+FROM/gi,
        /INSERT\s+INTO/gi,
        /UPDATE\s+\w+\s+SET/gi,
        /EXEC(\s+|\()/gi,
        /UNION\s+SELECT/gi
    ];

    for (const pattern of sqlPatterns) {
        sanitized = sanitized.replace(pattern, '');
    }

    // Remove prompt injection attempts
    const injectionPatterns = [
        /ignore\s+previous\s+instructions?/gi,
        /system\s+prompt/gi,
        /admin\s+mode/gi,
        /jailbreak/gi,
        /\[SYSTEM\s+PROMPT\]/gi
    ];

    for (const pattern of injectionPatterns) {
        sanitized = sanitized.replace(pattern, '');
    }

    // Clean up extra whitespace and semicolons
    sanitized = sanitized.replace(/\s*;\s*/g, ' ').trim();
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Truncate to max length
    if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500);
    }

    // Validate non-empty
    if (sanitized.length === 0) {
        throw new MockupError(
            'Prompt vacío después de la sanitización. Proporcione una descripción válida.',
            ErrorCode.INVALID_PROMPT,
            false
        );
    }

    return sanitized;
}

/**
 * Gets style-specific instructions
 */
function getStyleInstructions(style: string): string {
    const baseInstructions = `Visual Style - Wireframe Specifications:
- Black and white sketch style like Balsamiq wireframes
- Hand-drawn appearance with slightly imperfect lines
- Simple rectangles for input fields, cards, and containers
- Rounded rectangles for buttons with clear labels
- Use "X" or simple shapes for icons/images placeholders
- Gray background (#F5F5F5), black outlines (#000000), white elements (#FFFFFF)
- Comic Sans MS or similar informal font for wireframe feel
- NO realistic colors, NO gradients, NO shadows, NO photorealism
- NO high-fidelity design elements`;

    if (style === 'balsamiq') {
        return `Balsamiq-style Specifications:
${baseInstructions}`;
    }
    if (style === 'sketch') {
        return `Sketch-style Specifications:
${baseInstructions}`;
    }
    return baseInstructions;
}

/**
 * Gets style display name
 */
function getStyleName(style: string): string {
    if (style === 'balsamiq') return 'Balsamiq style';
    if (style === 'sketch') return 'sketch style';
    return 'wireframe style';
}

/**
 * Gets device-specific layout instructions
 */
function getDeviceLayoutInstructions(device: string): string {
    if (device === 'desktop') {
        return 'Horizontal navigation bar at top, multi-column layout where appropriate, spacious padding';
    }
    if (device === 'tablet') {
        return 'Responsive 2-column grid, touch-friendly button sizes, hamburger menu for navigation';
    }
    return 'Single column layout (stacked elements), full-width buttons, bottom navigation bar';
}
