import { expect } from 'vitest';
import { mockServiceLogger } from '../setupTest';

export const expectPermissionLog = (args: Partial<Record<string, unknown>>) => {
    expect(mockServiceLogger.permission).toHaveBeenCalledWith(expect.objectContaining(args));
};

export const expectInfoLog = (args: object = {}, label?: string) => {
    if (label) {
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.objectContaining(args), label);
    } else {
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.objectContaining(args));
    }
};

export const expectNoPermissionLog = () => {
    expect(mockServiceLogger.permission).not.toHaveBeenCalled();
};
