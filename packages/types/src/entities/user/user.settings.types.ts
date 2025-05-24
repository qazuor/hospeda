export interface UserNotificationsType {
    enabled: boolean;
    allowEmails: boolean;
    allowSms: boolean;
    allowPush: boolean;
}

export interface UserSettingsType {
    darkMode?: boolean;
    language?: string;
    notifications: UserNotificationsType;
}
