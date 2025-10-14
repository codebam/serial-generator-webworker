
// KNOWLEDGE.md Converted to Actionable Code
// This file encapsulates the validated findings from the research document.

// --- Core Technical Architecture ---

// Custom Base85 Alphabet (VALIDATED)
export const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~';

// --- Validated In-Game Findings ---

// CRITICAL SAFETY RULES (High Confidence)
export const SAFE_EDIT_ZONES = {
    HEADER_LOCK_MARKER: 'u~Q', // Do not edit before the first occurrence of this
    TRAILER_PRESERVE_LENGTH: 12, // Preserve the final 8-12 characters
    GROWTH_ENVELOPE_MIN: 1.02, // +2%
    GROWTH_ENVELOPE_MAX: 1.12, // +12%
};

// Stable Motif Bank (VALIDATED)
// Motifs observed in many stable, high-rate tails.
export const STABLE_MOTIFS = [
    's#Bfn', 'RHr)Cs', 'ZMpOQ=', 'RHmr#', 'jWCPI', 'CPIanNo$6GlI', 
    '@PI8', 'b*fXH>', 'P5=', 'I4', 'cl0', 'jWCP'
];

// Perk Toggle System (VALIDATED)
// Az) ↔ Az+ correlates with perk mixes
export const PERK_TOGGLES = {
    ADORATION_COLORFUL_MESS: 'Az)OTq',
    COLORFUL_MESS_FORCE_BUNT: 'Az+ksC',
};

// Fire-Rate Ladder (Tail-Driven, VALIDATED)
// Extending the tail in safe zones raises fire-rate.
export const FIRE_RATE_TAILS = {
    // Highest confirmed: 28,698.6/s
    MAX_CONFIRMED: '(s#BfnRHr)CsZMpOQ=RHmr#jWCPIanNo$6GlI@PI8b*fXH>QtvX)u~Q(s#BfnRHr%t', 
    // Comparable siblings
    SIBLING_1: '(s#BfnRHr)CsZMpOQ=RHmr#jWCPIanNo$6GlI@PI8b*fXH>QtvX)u~Q(s#BfnRHr%s', // Example variation
    SIBLING_2: '(s#BfnRHr)CsZMpOQ=RHmr#jWCPIanNo$6GlI@PI8b*fXH>QtvX)u~Q(s#BfnRHr%r', // Example variation
};

// --- Item Type-Specific Mutation Logic ---

// Specialized character pools for targeted mutation.
export const ITEM_TYPE_CHAR_POOLS = {
    GUN: "0123456789DMGSHTYUIP".split(''),
    CLASS_MOD: "M02_L^3O4x}@%#Ej5AWu".split(''),
    SHIELD: "0123456789-+*/:;=<>ABC".split(''),
    ENHANCEMENT: "!#$&()*+-@^_`{}~".split(''),
    REPKIT: "098765RPKTHL()*/=".split(''),
    ORDNANCE: BASE85_ALPHABET.split(''), // Using generic pool as per user request
    // Generic fallback if type is unknown
    GENERIC: BASE85_ALPHABET.split(''),
};

/**
 * Returns the appropriate character pool for a given item type.
 * @param {string} itemType - The type of the item (e.g., 'GUN', 'SHIELD').
 * @returns {string[]} An array of characters for mutation.
 */
export function getCharPoolForItemType(itemType: string): string[] {
    const upperType = itemType.toUpperCase();
    return ITEM_TYPE_CHAR_POOLS[upperType] || ITEM_TYPE_CHAR_POOLS.GENERIC;
}

/**
 * Ensures the generated serial length respects the Base85 block alignment.
 * (len(serial) % 5) should remain consistent with the original.
 * @param {string} currentSerial - The serial being generated.
 * @param {string} originalSerial - The original seed serial.
 * @returns {string} The adjusted serial with padding if necessary.
 */
export function alignToBase85(currentSerial: string, originalSerial: string): string {
    const originalMod = (originalSerial.length % 5);
    let currentMod = (currentSerial.length % 5);
    let adjustedSerial = currentSerial;

    while (currentMod !== originalMod) {
        adjustedSerial += '~'; // Use the padding character
        currentMod = (adjustedSerial.length % 5);
    }
    
    return adjustedSerial;
}
