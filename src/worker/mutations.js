import { ALPHABET } from './constants.js';
import { getNextRandom } from './gpu.js';
import { randomInt, randomChoice } from './utils.js';
import {
    SAFE_EDIT_ZONES,
    STABLE_MOTIFS,
    alignToBase85,
    getCharPoolForItemType,
    BASE85_ALPHABET
} from './knowledge.js';

// --- KNOWLEDGE-BASED MUTATION ---

/**
 * NEW: A "smart" mutation that respects the validated safety rules from KNOWLEDGE.md.
 * This should be the preferred mutation strategy.
 * @param {string} baseTail - The initial tail of the serial.
 * @param {string} originalSerial - The full original serial for alignment reference.
 * @param {number} finalLength - The desired final length of the tail.
 * @param {string} itemType - The type of item being generated (e.g., 'GUN').
 * @returns {string} A new, mutated tail.
 */
export function generateKnowledgeBasedMutation(baseTail, originalSerial, finalLength, itemType, charPool = null) {
    if (self.debugMode) console.log(`[DEBUG] > Knowledge-Based Mutation | finalLength: ${finalLength}`);

    const headerLockIndex = baseTail.indexOf(SAFE_EDIT_ZONES.HEADER_LOCK_MARKER);
    const safeStart = (headerLockIndex !== -1) ? headerLockIndex + SAFE_EDIT_ZONES.HEADER_LOCK_MARKER.length : 0;
    const safeEnd = baseTail.length - SAFE_EDIT_ZONES.TRAILER_PRESERVE_LENGTH;

    if (safeStart >= safeEnd) {
        if (self.debugMode) console.warn(`[DEBUG]   > No safe edit zone found or zone is invalid. Falling back to append.`);
        return generateAppendMutation(baseTail, finalLength, 0);
    }

    let mutatedTail = baseTail;
    const finalCharPool = charPool || ALPHABET.split('');

    // Strategy 1: Inject a stable motif
    if (getNextRandom() < 0.4) { // 40% chance to inject a motif
        const motif = randomChoice(STABLE_MOTIFS);
        const injectPosition = randomInt(safeStart, safeEnd - motif.length);
        if (injectPosition > safeStart && (injectPosition + motif.length) < safeEnd) {
            mutatedTail = mutatedTail.substring(0, injectPosition) + motif + mutatedTail.substring(injectPosition + motif.length);
            if (self.debugMode) console.log(`[DEBUG]   > Injected motif "${motif}" at index ${injectPosition}.`);
        }
    }

    // Strategy 2: Perform controlled random mutations in the safe zone
    const chars = [...mutatedTail];
    const mutationRate = 0.15; // 15% chance per character in the safe zone
    let mutationCount = 0;
    for (let i = safeStart; i < safeEnd; i++) {
        if (getNextRandom() < mutationRate) {
            chars[i] = randomChoice(finalCharPool);
            mutationCount++;
        }
    }
    mutatedTail = chars.join('');
    if (self.debugMode) console.log(`[DEBUG]   > Performed ${mutationCount} character mutations in the safe zone.`);

    // Final step: Adjust length and align to Base85 block boundary
    let finalMutatedTail = mutatedTail.substring(0, finalLength);
    if (finalMutatedTail.length < finalLength) {
        let padding = '';
        for (let i = 0; i < finalLength - finalMutatedTail.length; i++) {
            padding += randomChoice(finalCharPool);
        }
        finalMutatedTail += padding;
    }
    
    finalMutatedTail = alignToBase85(finalMutatedTail, originalSerial);
    if (self.debugMode) console.log(`[DEBUG]   > Final tail aligned and resized. Length: ${finalMutatedTail.length}`);

    return finalMutatedTail;
}

function createRandomRepeatingPart(minPartSize, maxPartSize, charPool) {
    const totalLength = randomInt(minPartSize, maxPartSize);
    // Ensure base length is at least 1 and allows for at least 2 repeats.
    const maxBaseLength = Math.max(1, Math.floor(totalLength / 2));
    const baseLength = randomInt(1, maxBaseLength);

    let basePart = '';
    for (let i = 0; i < baseLength; i++) {
        basePart += randomChoice(charPool);
    }

    let repeatedPart = '';
    while (repeatedPart.length < totalLength) {
        repeatedPart += basePart;
    }

    return repeatedPart.substring(0, totalLength);
}

// --- NEW (v1) STACKED PART MUTATION (Full Alphabet) ---
export function generateStackedPartMutationV1(baseTail, minPartSize, maxPartSize, finalLength, itemType) {
    if (self.debugMode) console.log(`[DEBUG] > NEW (v1) Stacked Part Mutation | finalLength: ${finalLength}`);

    const headerLockIndex = baseTail.indexOf(SAFE_EDIT_ZONES.HEADER_LOCK_MARKER);
    const safeStart = (headerLockIndex !== -1) ? headerLockIndex + SAFE_EDIT_ZONES.HEADER_LOCK_MARKER.length : 0;
    
    let mutatedTail = baseTail;
    const charPool = BASE85_ALPHABET.split(''); // Use full alphabet

    // Inject 2 self-repeating random parts
    for (let i = 0; i < 2; i++) {
        const currentSafeEnd = mutatedTail.length - SAFE_EDIT_ZONES.TRAILER_PRESERVE_LENGTH;
        if (safeStart >= currentSafeEnd) break; // Stop if no safe space is left

        const part = createRandomRepeatingPart(minPartSize, maxPartSize, charPool);
        const injectPosition = randomInt(safeStart, currentSafeEnd);
        mutatedTail = mutatedTail.slice(0, injectPosition) + part + mutatedTail.slice(injectPosition);
    }

    // Adjust length to finalLength
    let finalMutatedTail = mutatedTail;
    if (finalMutatedTail.length > finalLength) {
        finalMutatedTail = finalMutatedTail.substring(0, finalLength);
    } else if (finalMutatedTail.length < finalLength) {
        const paddingLength = finalLength - finalMutatedTail.length;
        let padding = '';
        for (let i = 0; i < paddingLength; i++) {
            padding += randomChoice(charPool);
        }
        finalMutatedTail += padding;
    }
    
    // Final alignment
    return alignToBase85(finalMutatedTail, baseTail);
}

// --- NEW (v2) STACKED PART MUTATION (Restricted Alphabet) ---
export function generateStackedPartMutationV2(baseTail, minPartSize, maxPartSize, finalLength, itemType) {
    if (self.debugMode) console.log(`[DEBUG] > NEW (v2) Stacked Part Mutation | finalLength: ${finalLength}`);

    const headerLockIndex = baseTail.indexOf(SAFE_EDIT_ZONES.HEADER_LOCK_MARKER);
    const safeStart = (headerLockIndex !== -1) ? headerLockIndex + SAFE_EDIT_ZONES.HEADER_LOCK_MARKER.length : 0;
    
    let mutatedTail = baseTail;
    const charPool = getCharPoolForItemType(itemType); // Use item-specific alphabet

    // Inject 2 self-repeating random parts
    for (let i = 0; i < 2; i++) {
        const currentSafeEnd = mutatedTail.length - SAFE_EDIT_ZONES.TRAILER_PRESERVE_LENGTH;
        if (safeStart >= currentSafeEnd) break; // Stop if no safe space is left

        const part = createRandomRepeatingPart(minPartSize, maxPartSize, charPool);
        const injectPosition = randomInt(safeStart, currentSafeEnd);
        mutatedTail = mutatedTail.slice(0, injectPosition) + part + mutatedTail.slice(injectPosition);
    }

    // Adjust length to finalLength
    let finalMutatedTail = mutatedTail;
    if (finalMutatedTail.length > finalLength) {
        finalMutatedTail = finalMutatedTail.substring(0, finalLength);
    } else if (finalMutatedTail.length < finalLength) {
        const paddingLength = finalLength - finalMutatedTail.length;
        let padding = '';
        for (let i = 0; i < paddingLength; i++) {
            padding += randomChoice(charPool);
        }
        finalMutatedTail += padding;
    }
    
    // Final alignment
    return alignToBase85(finalMutatedTail, baseTail);
}


// --- REFACTORED MUTATION ALGORITHMS (Intensity Ladder) ---

// NEW: Append-Only
export function generateAppendMutation(baseTail, finalLength, protectedStartLength, itemType = 'GENERIC') {
    if (self.debugMode) console.log(`[DEBUG] > Append Mutation | finalLength: ${finalLength}, protected: ${protectedStartLength}, itemType: ${itemType}`);
    const startPart = baseTail.substring(0, protectedStartLength);
    const paddingLength = finalLength - startPart.length;
    if (paddingLength <= 0) return startPart.substring(0, finalLength);
    
    const charPool = getCharPoolForItemType(itemType);
    let padding = '';
    for (let i = 0; i < paddingLength; i++) {
        padding += randomChoice(charPool);
    }
    
    if (self.debugMode) console.log(`[DEBUG]   > Appending ${paddingLength} random characters using ${itemType} pool.`);
    return startPart + padding;
}

// TG1: Append-Only Mutation (1x)
export function generateCharacterFlipMutation(baseTail, originalSerial, finalLength, itemType = 'GENERIC') {
    if (self.debugMode) console.log(`[DEBUG] > TG1: Append-Only Mutation (1x) | finalLength: ${finalLength}, itemType: ${itemType}`);
    
    const headerLockIndex = baseTail.indexOf(SAFE_EDIT_ZONES.HEADER_LOCK_MARKER);
    const safeStart = (headerLockIndex !== -1) ? headerLockIndex + SAFE_EDIT_ZONES.HEADER_LOCK_MARKER.length : 0;
    const safeEnd = baseTail.length - SAFE_EDIT_ZONES.TRAILER_PRESERVE_LENGTH;

    let mutatedTail = baseTail;

    // Apply 1 append-only mutation (inject a stable motif)
    if (safeStart < safeEnd) {
        const motif = randomChoice(STABLE_MOTIFS);
        const injectPosition = randomInt(safeStart, safeEnd);
        mutatedTail = mutatedTail.slice(0, injectPosition) + motif + mutatedTail.slice(injectPosition);
    }

    // Adjust length to finalLength
    let finalMutatedTail = mutatedTail;
    if (finalMutatedTail.length > finalLength) {
        finalMutatedTail = finalMutatedTail.substring(0, finalLength);
    } else if (finalMutatedTail.length < finalLength) {
        const paddingLength = finalLength - finalMutatedTail.length;
        const charPool = getCharPoolForItemType(itemType);
        let padding = '';
        for (let i = 0; i < paddingLength; i++) {
            padding += randomChoice(charPool);
        }
        finalMutatedTail += padding;
    }
    
    // Final alignment
    return alignToBase85(finalMutatedTail, originalSerial);
}

// TG2: Append-Only Mutation (2x)
export function generateSegmentReversalMutation(baseTail, originalSerial, finalLength, itemType = 'GENERIC') {
    if (self.debugMode) console.log(`[DEBUG] > TG2: Append-Only Mutation (2x) | finalLength: ${finalLength}, itemType: ${itemType}`);
    
    const headerLockIndex = baseTail.indexOf(SAFE_EDIT_ZONES.HEADER_LOCK_MARKER);
    const safeStart = (headerLockIndex !== -1) ? headerLockIndex + SAFE_EDIT_ZONES.HEADER_LOCK_MARKER.length : 0;
    
    let mutatedTail = baseTail;

    // Apply 2 append-only mutations (inject stable motifs)
    for (let i = 0; i < 2; i++) {
        const currentSafeEnd = mutatedTail.length - SAFE_EDIT_ZONES.TRAILER_PRESERVE_LENGTH;
        if (safeStart >= currentSafeEnd) break; // Stop if no safe space is left

        const motif = randomChoice(STABLE_MOTIFS);
        const injectPosition = randomInt(safeStart, currentSafeEnd);
        mutatedTail = mutatedTail.slice(0, injectPosition) + motif + mutatedTail.slice(injectPosition);
    }

    // Adjust length to finalLength
    let finalMutatedTail = mutatedTail;
    if (finalMutatedTail.length > finalLength) {
        finalMutatedTail = finalMutatedTail.substring(0, finalLength);
    } else if (finalMutatedTail.length < finalLength) {
        const paddingLength = finalLength - finalMutatedTail.length;
        const charPool = getCharPoolForItemType(itemType);
        let padding = '';
        for (let i = 0; i < paddingLength; i++) {
            padding += randomChoice(charPool);
        }
        finalMutatedTail += padding;
    }
    
    // Final alignment
    return alignToBase85(finalMutatedTail, originalSerial);
}

// TG3: High-Value Part Manipulation (High Intensity)
export function generatePartManipulationMutation(baseTail, parentTail, highValueParts, legendaryChance, mutableStart, mutableEnd, finalLength) {
    if (self.debugMode) console.log(`[DEBUG] > TG3: Part Manipulation | range: ${mutableStart}-${mutableEnd}`);

    let mutatedTail = baseTail;

    if (getNextRandom() < legendaryChance && highValueParts.length > 0) {
        const part = randomChoice(highValueParts);
        const availableMutableSpace = finalLength - mutableStart;
        if (availableMutableSpace >= part.length) {
            const repeatedBlock = part.repeat(5).substring(0, availableMutableSpace);
            const prefixLength = finalLength - repeatedBlock.length;
            mutatedTail = mutatedTail.substring(0, prefixLength) + repeatedBlock;
        }
    }

    return mutatedTail;
}

// TG4: Repository Crossover (Very High Intensity)
export function generateRepositoryCrossoverMutation(baseTail, parentTail, mutableStart, mutableEnd, finalLength) {
    if (self.debugMode) console.log(`[DEBUG] > TG4: Repository Crossover | range: ${mutableStart}-${mutableEnd}`);
    const prefix = baseTail.substring(0, mutableStart);
    const crossoverLength = mutableEnd - mutableStart;
    
    let crossoverChunk = '';
    if (parentTail.length > 0) {
        // Take a chunk from a random position in the parent
        const startInParent = randomInt(0, Math.max(0, parentTail.length - crossoverLength));
        crossoverChunk = parentTail.substring(startInParent, startInParent + crossoverLength);
    }
    
    // If chunk is not long enough, fill with random chars
    while(crossoverChunk.length < crossoverLength) {
        crossoverChunk += randomChoice(ALPHABET);
    }

    if (self.debugMode) console.log(`[DEBUG]   > Overwriting range ${mutableStart}-${mutableEnd} with chunk from parent.`);
    return (prefix + crossoverChunk + baseTail.substring(mutableEnd)).substring(0, finalLength);
}
