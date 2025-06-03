import { expect } from 'vitest';
import { dbLogger } from '../../utils/logger';

export const expectPermissionLog = (args: object) => {
    expect(dbLogger.permission).toHaveBeenCalledWith(expect.objectContaining(args));
};

export const expectInfoLog = (args: object, label: string) => {
    expect(dbLogger.info).toHaveBeenCalledWith(expect.objectContaining(args), label);
};

export const expectNoPermissionLog = () => {
    expect(dbLogger.permission).not.toHaveBeenCalled();
};
