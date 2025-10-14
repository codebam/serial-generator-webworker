import { ALPHABET } from './constants.js';
import { getNextRandom } from './gpu.js';
import { randomInt, randomChoice } from './utils.js';

// --- REFACTORED MUTATION ALGORITHMS (Intensity Ladder) ---

// NEW: Append-Only
export function generateAppendMutation(baseTail, finalLength, protectedStartLength) {
    if (self.debugMode) console.log(`[DEBUG] > Append Mutation | finalLength: ${finalLength}, protected: ${protectedStartLength}`);
    const startPart = baseTail.substring(0, protectedStartLength);
    const paddingLength = finalLength - startPart.length;
    if (paddingLength <= 0) return startPart.substring(0, finalLength);
    let padding = '';
    for (let i = 0; i < paddingLength; i++) padding += randomChoice(ALPHABET);
    if (self.debugMode) console.log(`[DEBUG]   > Appending ${paddingLength} random characters.`);
    return startPart + padding;
}

// TG1: Targeted Character Flip (Low Intensity)
export function generateCharacterFlipMutation(baseTail, mutableStart, mutableEnd) {
    if (self.debugMode) console.log(`[DEBUG] > TG1: Character Flip | range: ${mutableStart}-${mutableEnd}`);
    const chars = [...baseTail];
    const flipRate = 0.05; // 5% chance per character
    let flipCount = 0;

    for (let i = mutableStart; i < mutableEnd; i++) {
        if (getNextRandom() < flipRate) {
            const originalChar = chars[i];
            const charIndex = ALPHABET.indexOf(originalChar);
            if (charIndex !== -1) {
                const direction = getNextRandom() < 0.5 ? -1 : 1;
                let newIndex = (charIndex + direction + ALPHABET.length) % ALPHABET.length;
                chars[i] = ALPHABET[newIndex];
                flipCount++;
            }
        }
    }
    if (self.debugMode) console.log(`[DEBUG]   > Flipped ${flipCount} characters.`);
    return chars.join('');
}

// TG2: Segment Reversal (Medium Intensity)
export function generateSegmentReversalMutation(baseTail, mutableStart, mutableEnd, minChunk, maxChunk) {
    if (self.debugMode) console.log(`[DEBUG] > TG2: Segment Reversal | range: ${mutableStart}-${mutableEnd}`);
    if (mutableEnd - mutableStart < minChunk) {
        if (self.debugMode) console.log(`[DEBUG]   > Mutable range too small for reversal. Skipping.`);
        return baseTail;
    }
    
    const chunkSize = randomInt(minChunk, Math.min(maxChunk, mutableEnd - mutableStart));
    const start = randomInt(mutableStart, mutableEnd - chunkSize);
    
    const prefix = baseTail.substring(0, start);
    const segment = baseTail.substring(start, start + chunkSize);
    const suffix = baseTail.substring(start + chunkSize);
    
    const reversedSegment = [...segment].reverse().join('');
    if (self.debugMode) console.log(`[DEBUG]   > Reversed segment "${segment}" to "${reversedSegment}" at index ${start}.`);
    
    return prefix + reversedSegment + suffix;
}

// TG3: High-Value Part Manipulation (High Intensity)
export function generatePartManipulationMutation(baseTail, parentTail, highValueParts, legendaryChance, mutableStart, mutableEnd, finalLength) {
    if (self.debugMode) console.log(`[DEBUG] > TG3: Part Manipulation | range: ${mutableStart}-${mutableEnd}`);

    // Behavior 2: Part Stacking (if no mutable range)
    if (mutableStart === mutableEnd) {
        if (getNextRandom() < legendaryChance && highValueParts.length > 0) {
            if (self.debugMode) console.log('[DEBUG]   > Part Stacking triggered!');
            const part = randomChoice(highValueParts);
            const protectedPart = baseTail.substring(0, mutableStart);
            const availableSpace = finalLength - protectedPart.length;
            if (availableSpace >= part.length) {
                const numRepeats = Math.floor(availableSpace / part.length);
                if (numRepeats > 0) {
                    const repeatedBlock = new Array(numRepeats).fill(part).join('');
                    let finalTail = protectedPart + repeatedBlock;
                    // Fill any remaining space
                    finalTail += generateAppendMutation('', finalLength - finalTail.length, 0);
                    if (self.debugMode) console.log(`[DEBUG]     > Stacked part "${part}" ${numRepeats} times.`);
                    return finalTail.substring(0, finalLength);
                }
            }
        }
        // Fallback to simple append if stacking doesn't trigger
        return generateAppendMutation(baseTail, finalLength, mutableStart);
    }

    // Behavior 1: Part Swap (if mutable range is set)
    if (highValueParts.length > 0) {
        const partToInject = randomChoice(highValueParts);
        const availableSpace = mutableEnd - mutableStart;

        if (partToInject.length <= availableSpace) {
            const start = randomInt(mutableStart, mutableEnd - partToInject.length);
            const prefix = baseTail.substring(0, start);
            const suffix = baseTail.substring(start + partToInject.length);
            if (self.debugMode) console.log(`[DEBUG]   > Part Swap: Swapping in "${partToInject}" at index ${start}.`);
            return prefix + partToInject + suffix;
        }
    }
    
    // Fallback if no suitable part is found for swapping: do a simple crossover in the mutable range
    if (self.debugMode) console.log(`[DEBUG]   > Part Swap failed, falling back to crossover.`);
    const prefix = baseTail.substring(0, mutableStart);
    const crossoverChunk = parentTail.substring(0, mutableEnd - mutableStart);
    const suffix = baseTail.substring(mutableEnd);
    return prefix + crossoverChunk + suffix;
}

// TG4: Repository Crossover (Very High Intensity)
export function generateRepositoryCrossoverMutation(baseTail, parentTail, mutableStart, mutableEnd) {
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
    return prefix + crossoverChunk + baseTail.substring(mutableEnd);
}
