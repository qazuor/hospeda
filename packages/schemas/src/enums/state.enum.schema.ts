import { StateEnum } from '@repo/types/src/enums/state.enum';
import { z } from 'zod';

export const StateEnumSchema = z.enum(Object.values(StateEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.state.invalid' })
});
