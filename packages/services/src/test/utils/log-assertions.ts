import { expect } from 'vitest';
import { mockServiceLogger } from '../setupTest';

export const expectPermissionLog = (args: object) => {
    expect(mockServiceLogger.permission).toHaveBeenCalledWith(expect.objectContaining(args));
};

export const expectInfoLog = (args: object, label: string) => {
    expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.objectContaining(args), label);
};

export const expectNoPermissionLog = () => {
    expect(mockServiceLogger.permission).not.toHaveBeenCalled();
};
