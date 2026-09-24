export interface User {
    id: string;
    username: string;
    email: string;
    isActive: boolean;
    lastLoginAt?: Date;
    roles: string[]; // Drift: Code uses roles array, docs say single string role
    mfaEnabled: boolean; // Intentional drift: new field added in code but not in table specs
}

export class AuthService {
    authenticate(username: string, passwordHash: string): boolean {
        // Implementation
        return true;
    }
}
