// --- WORKER SCRIPT (generator.worker.js) ---
// --- DEFINITIVE FIX for TG4 & PART DETECTION ---

// --- CONSTANTS ---
const DEFAULT_SEED = "@Uge9B?m/)}}!ffxLNwtrrhUgJFvP19)9>F7c1drg69->2ZNDt8=I>e4x5g)=u;D`>fBRx?3?tmf{sYpdCQjv<(7NJN*DpHY(R3rc";
const BASE85_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~";
const ALLOWED_EXTRA = "/";
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;

const TG_FLAGS = { "NEW": 0, "TG1": 17, "TG2": 33, "TG3": 65, "TG4": 129 };
const CHUNK_SIZE = 500;
const PART_SIZE = 5;

// --- UTILITY FUNCTIONS ---
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ensureCharset(s) { return [...s].filter(c => ALPHABET.includes(c)).join(''); }

function splitHeaderTail(serial) {
    const match = serial.match(HEADER_RE);
    if (match) return [match[1], serial.substring(match[0].length)];
    const hdr = serial.substring(0, 10);
    return [hdr, serial.substring(10)];
}

/**
 * Identifies high-value parts by looking for repeating fragments.
 */
function extractHighValueParts(repoTails, fragmentSize = PART_SIZE) {
    const highValueParts = new Set();
    const frequencyMap = new Map();
    for (const tail of repoTails) {
        for (let i = 0; i <= tail.length - (fragmentSize * 2); i++) {
            const fragment1 = tail.substring(i, i + fragmentSize);
            const fragment2 = tail.substring(i + fragmentSize, i + (fragmentSize * 2));
            if (fragment1 === fragment2) highValueParts.add(fragment1);
        }
        for (let i = 0; i <= tail.length - fragmentSize; i++) {
            const fragment = tail.substring(i, i + fragmentSize);
            frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1);
        }
    }
    const sortedByFrequency = [...frequencyMap.entries()].sort((a, b) => b[1] - a[1]);
    sortedByFrequency.slice(0, 20).forEach(entry => highValueParts.add(entry[0]));
    return Array.from(highValueParts);
}

// --- CORE MUTATION LOGIC ---

/**
 * Injects a repeated high-value "part fragment" into a serial tail.
 */
function performLegendaryStacking(tail, highValueParts) {
    if (!highValueParts || highValueParts.length === 0) return tail;
    const partToStack = randomChoice(highValueParts);
    const stackCount = randomInt(2, 4);
    const stackedString = partToStack.repeat(stackCount);
    const injectionPoint = randomInt(Math.floor(tail.length * 0.4), Math.floor(tail.length * 0.6));
    const newTail = tail.substring(0, injectionPoint) + stackedString + tail.substring(injectionPoint);
    return newTail;
}

/**
 * Performs a genetic crossover by splicing the tails of two parent serials.
 */
function performCrossoverMutation(tailA, tailB) {
    if (!tailB || tailB.length < 20) return tailA;
    const shorterLength = Math.min(tailA.length, tailB.length);
    const splicePoint = randomInt(Math.floor(shorterLength * 0.3), Math.floor(shorterLength * 0.7));
    const newTail = tailA.substring(0, splicePoint) + tailB.substring(splicePoint);
    return newTail;
}

/**
 * FIXED: TG4 now has a robust fallback and performs targeted fragment replacement.
 */
function generateTargetedMutation(baseTail, highValueParts, fallbackRepoTails) {
    // Primary strategy: Use high-value parts if they exist.
    if (highValueParts && highValueParts.length > 0) {
        let mutatedTail = baseTail;
        const partsToReplace = randomInt(1, 3);
        for (let i = 0; i < partsToReplace; i++) {
            const partToInject = randomChoice(highValueParts);
            const partLength = partToInject.length;
            if (mutatedTail.length > partLength) {
                const startPos = randomInt(0, mutatedTail.length - partLength);
                mutatedTail = mutatedTail.slice(0, startPos) + partToInject + mutatedTail.slice(startPos + partLength);
            }
        }
        return mutatedTail;
    }
    // Fallback strategy: If no high-value parts, perform a heavy crossover.
    const partnerTail = randomChoice(fallbackRepoTails);
    return performCrossoverMutation(baseTail, partnerTail);
}

// --- WORKER MESSAGE HANDLER ---
self.onmessage = function(e) {
    if (e.data.type !== 'generate') return;
    const config = e.data.payload;
    
    try {
        const seedInput = config.seed || DEFAULT_SEED;
        const [baseHeader, baseTail] = splitHeaderTail(seedInput);
        
        const allRepoTails = [];
        for (const itemType in config.repositories) {
            const repoText = config.repositories[itemType];
            const repoSerials = repoText.split(/[\s\n]+/g).filter(s => s.startsWith('@U'));
            repoSerials.forEach(serial => allRepoTails.push(splitHeaderTail(serial)[1]));
        }
        
        const highValueParts = extractHighValueParts(allRepoTails);
        if (highValueParts.length === 0 && config.tg4Count > 0) {
            self.postMessage({ type: 'warning', payload: 'No high-value parts found. TG4 will use crossover mutation as a fallback.' });
        }
        
        const selectedRepoTails = config.repositories[config.itemType]
            .split(/[\s\n]+/g).filter(s => s.startsWith('@U')).map(s => splitHeaderTail(s)[1]);
            
        if (selectedRepoTails.length === 0) {
            self.postMessage({ type: 'warning', payload: `Selected **${config.itemType}** Repository is empty. Using Base Seed for mutations.` });
            selectedRepoTails.push(baseTail);
        }
        // Ensure the fallback repository always has at least the base tail.
        const fallbackRepo = allRepoTails.length > 0 ? allRepoTails : [baseTail];

        const serialsToGenerate = [];
        for (let i = 0; i < config.newCount; i++) serialsToGenerate.push({ tg: "NEW", flag: TG_FLAGS["NEW"] });
        for (let i = 0; i < config.tg1Count; i++) serialsToGenerate.push({ tg: "TG1", flag: TG_FLAGS["TG1"] });
        for (let i = 0; i < config.tg2Count; i++) serialsToGenerate.push({ tg: "TG2", flag: TG_FLAGS["TG2"] });
        for (let i = 0; i < config.tg3Count; i++) serialsToGenerate.push({ tg: "TG3", flag: TG_FLAGS["TG3"] });
        for (let i = 0; i < config.tg4Count; i++) serialsToGenerate.push({ tg: "TG4", flag: TG_FLAGS["TG4"] });
        serialsToGenerate.sort(() => Math.random() - 0.5);

        const totalRequested = serialsToGenerate.length;
        const seenSerials = new Set();
        const generatedSerials = [];

        for (let i = 0; i < totalRequested; i++) {
            const item = serialsToGenerate[i];
            let serial = '';
            let innerAttempts = 0;
            
            do {
                let mutatedTail;
                let item_flag = (item.flag !== 0) ? 1 : 0;
                let state_flag = item.flag;

                if (item.tg === "TG4") {
                    mutatedTail = generateTargetedMutation(baseTail, highValueParts, fallbackRepo);
                    item_flag = 1; // Always mark TG4 as special
                    state_flag = TG_FLAGS["TG4"]; // Use the dedicated TG4 flag
                } else {
                    if (item.tg === "TG3" && Math.random() < 0.3) {
                        mutatedTail = performLegendaryStacking(baseTail, highValueParts);
                    } else if ((item.tg === "TG2" || item.tg === "TG3") && Math.random() < 0.75) {
                        mutatedTail = performCrossoverMutation(baseTail, randomChoice(selectedRepoTails));
                    } else {
                        mutatedTail = performCrossoverMutation(baseTail, randomChoice(fallbackRepo));
                    }
                }
                if (mutatedTail.length > config.maxTail) mutatedTail = mutatedTail.substring(0, config.maxTail);
                while (mutatedTail.length < config.minTail) mutatedTail += randomChoice(ALPHABET);

                serial = ensureCharset(baseHeader + mutatedTail);
                innerAttempts++;
            } while (seenSerials.has(serial) && innerAttempts < 10);

            if (!seenSerials.has(serial)) {
                seenSerials.add(serial);
                // The flags are determined inside the loop now
                const final_item_flag = (item.flag !== 0 || item.tg === "TG4") ? 1 : 0;
                const final_state_flag = (item.tg === "TG4") ? TG_FLAGS["TG4"] : item.flag;
                generatedSerials.push({ serial: serial, flag: final_item_flag, state_flag: final_state_flag, slot: generatedSerials.length });
            }

            if (i > 0 && i % CHUNK_SIZE === 0) {
                self.postMessage({ type: 'progress', payload: { processed: i, total: totalRequested } });
            }
        }
        
        const lines = ["state:", "  inventory:", "    items:", "      backpack:"];
        generatedSerials.forEach(item => {
            lines.push(`        slot_${item.slot}:`);
            lines.push(`          serial: '${item.serial}'`);
            if (item.flag === 1) lines.push(`          flags: 1`);
            if (item.state_flag !== 0) lines.push(`          state_flags: ${item.state_flag}`);
        });
        
        self.postMessage({
            type: 'complete',
            payload: {
                yaml: lines.join('\n'),
                uniqueCount: generatedSerials.length,
                totalRequested: totalRequested
            }
        });
    } catch (error) {
        self.postMessage({ type: 'error', payload: { message: error.message } });
    }
};
