import { SpinnerGap } from '@phosphor-icons/react';
import { createPhosphorIcon } from '../../create-phosphor-icon';

export const LoaderIcon = createPhosphorIcon(SpinnerGap, 'loader', {
    defaultClassName: 'animate-spin'
});
