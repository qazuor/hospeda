import animations from './theme.animations.js';
import colors from './theme.colors.js';
import fonts from './theme.fonts.js';
import spacing from './theme.spacing.js';

export default {
    ...colors,
    ...fonts,
    ...spacing,
    ...animations,
    zIndex: {
        60: '60',
        70: '70',
        80: '80',
        90: '90',
        100: '100'
    }
};
