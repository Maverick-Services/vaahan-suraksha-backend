// utils/generateShortId.js

export function generateUsertId(type) {
    const rolePrefixes = {
        'b2c': 'USR',
        'b2b': 'MMB',
    };

    const prefix = rolePrefixes[type.toLowerCase()];
    if (!prefix) {
        throw new Error(`Invalid type: ${type}`);
    }

    // Random 4–5 character string (base36 = 0-9 + a-z), converted to uppercase
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `${prefix}${randomPart}`; // e.g., US3F9B, MEM2A8D
}

export function generateOtherIds(role) {
    const rolePrefixes = {
        admin: 'ADM',
        employee: 'EMP',
        company: 'CMP',
        rider: 'RDR'
    };

    const prefix = rolePrefixes[role.toLowerCase()];
    if (!prefix) {
        throw new Error(`Invalid role: ${role}`);
    }

    // Random 4–5 character string (base36 = 0-9 + a-z), converted to uppercase
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `${prefix}${randomPart}`; // e.g., US3F9B, MEM2A8D
}

export function generateServiceId() {

    // Random 4–5 character string (base36 = 0-9 + a-z), converted to uppercase
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `SR${randomPart}`; // e.g., US3F9B, MEM2A8D
}