// --- WORKER SCRIPT (generator.worker.js) ---
// Classic logic restored within the Web Worker architecture.

// --- CONSTANTS ---
const DEFAULT_SEED = "@Uge8pzm/)}}!t8IjFw;$d;-DH;sYyj@*ifd*pw6Jyw*U";
const BASE85_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~";
const ALLOWED_EXTRA = "/";
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;
const TG_FLAGS = { "NEW": 0, "TG1": 17, "TG2": 33, "TG3": 65, "TG4": 129 };

// --- UTILITY FUNCTIONS ---
function randomInt(min, max) { if (min > max) [min, max] = [max, min]; return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ensureCharset(s) { return [...s].filter(c => ALPHABET.includes(c)).join(''); }
function splitHeaderTail(serial) {
    const match = serial.match(HEADER_RE);
    return match ? [match[1], serial.substring(match[0].length)] : [serial.substring(0, 10), serial.substring(10)];
}

// --- RESTORED: INTELLIGENT PART EXTRACTION ---
function extractHighValueParts(repoTails, minPartSize, maxPartSize) {
    const frequencyMap = new Map();
    for (let size = minPartSize; size <= maxPartSize; size++) {
        for (const tail of repoTails) {
            if (tail.length < size) continue;
            for (let i = 0; i <= tail.length - size; i++) {
                const fragment = tail.substring(i, i + size);
                frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1);
            }
        }
    }
    const repeatedParts = [...frequencyMap.entries()]
        .filter(([part, count]) => count > 1)
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    return repeatedParts.map(entry => entry[0]);
}

// --- RESTORED: CLASSIC MUTATION ALGORITHMS ---
function generateAppendMutation(baseTail, finalLength, protectedStartLength) {
    const startPart = baseTail.substring(0, protectedStartLength);
    const paddingLength = finalLength - startPart.length;
    if (paddingLength <= 0) return startPart.substring(0, finalLength);
    let padding = '';
    for (let i = 0; i < paddingLength; i++) padding += randomChoice(ALPHABET);
    return startPart + padding;
}

function performWindowedCrossover(baseTail, parentTail, finalLength, protectedStartLength, minChunk, maxChunk, targetChunk) {
    let childTail = baseTail;
    const mutableStart = protectedStartLength;
    const childMutableLength = childTail.length - mutableStart;
    const parentMutableLength = parentTail.length - protectedStartLength;
    const finalChunkSize = Math.max(minChunk, Math.min(maxChunk, targetChunk));
    
    if (childMutableLength > finalChunkSize && parentMutableLength > finalChunkSize) {
        const chunkStartInParent = randomInt(mutableStart, parentTail.length - finalChunkSize);
        const chunk = parentTail.substring(chunkStartInParent, chunkStartInParent + finalChunkSize);
        if (childTail.length > chunk.length) {
            const injectionPoint = randomInt(mutableStart, childTail.length - chunk.length);
            childTail = childTail.slice(0, injectionPoint) + chunk + childTail.slice(injectionPoint + chunk.length);
        }
    }
    
    if (childTail.length < finalLength) {
        let padding = '';
        const paddingLength = finalLength - childTail.length;
        for (let i = 0; i < paddingLength; i++) padding += randomChoice(ALPHABET);
        childTail += padding;
    } else {
        childTail = childTail.substring(0, finalLength);
    }
    return childTail;
}

// --- ASYNC WORKER MESSAGE HANDLER ---
self.onmessage = function(e) {
    if (e.data.type !== 'generate') return;
    const config = e.data.payload;

    try {
        const totalRequested = config.newCount + config.tg1Count + config.tg2Count + config.tg3Count + config.tg4Count;
        if (totalRequested === 0) {
            self.postMessage({ type: 'complete', payload: { yaml: 'No items requested.', uniqueCount: 0, totalRequested: 0 }});
            return;
        }
        
        const [baseHeader, baseTail] = splitHeaderTail(config.seed);
        let repoTails = (config.repositories[config.itemType] || '').split(/[\s\n]+/).filter(s => s.startsWith('@U')).map(s => splitHeaderTail(s)[1]);
        if (repoTails.length === 0) {
            repoTails.push(baseTail); // Fallback to base seed
        }

        const highValueParts = extractHighValueParts(repoTails, config.minPartSize, config.maxPartSize);
        const legendaryStackingChance = config.legendaryChance / 100.0;

        const serialsToGenerate = [];
        for (let i = 0; i < config.newCount; i++) serialsToGenerate.push({ tg: "NEW" });
        for (let i = 0; i < config.tg1Count; i++) serialsToGenerate.push({ tg: "TG1" });
        for (let i = 0; i < config.tg2Count; i++) serialsToGenerate.push({ tg: "TG2" });
        for (let i = 0; i < config.tg3Count; i++) serialsToGenerate.push({ tg: "TG3" });
        for (let i = 0; i < config.tg4Count; i++) serialsToGenerate.push({ tg: "TG4" });
        serialsToGenerate.sort(() => Math.random() - 0.5);

        const seenSerials = new Set();
        const generatedSerials = [];

        for (let i = 0; i < totalRequested; i++) {
            const item = serialsToGenerate[i];
            let serial = '';
            let innerAttempts = 0;

            do {
                const parentTail = randomChoice(repoTails);
                
                const protectedStartPercent = randomInt(config.minProtectedPercent, config.maxProtectedPercent);
                const protectedStartLength = Math.floor(baseTail.length * (protectedStartPercent / 100));

                let dynamicTargetLength = Math.floor(baseTail.length + config.targetOffset);
                dynamicTargetLength = Math.max(dynamicTargetLength, protectedStartLength);

                let mutatedTail;
                const mutableZone = baseTail.length - protectedStartLength;

                if (item.tg === "NEW" || mutableZone < config.minChunkSize) {
                    mutatedTail = generateAppendMutation(baseTail, dynamicTargetLength, protectedStartLength);
                } else {
                    mutatedTail = performWindowedCrossover(baseTail, parentTail, dynamicTargetLength, protectedStartLength, config.minChunkSize, config.maxChunkSize, config.targetChunkSize);
                }
                
                // Terminal Repetition / Legendary Stacking
                if (((item.tg === "TG3" && Math.random() < legendaryStackingChance) || item.tg === "TG4") && highValueParts.length > 0) {
                    const part = randomChoice(highValueParts);
                    const repetitions = randomInt(2, 5);
                    const repeatedBlock = part.repeat(repetitions);
                    const availableMutableSpace = dynamicTargetLength - protectedStartLength;

                    if (availableMutableSpace >= part.length) { 
                        const finalRepeatedBlock = repeatedBlock.substring(0, availableMutableSpace);
                        const prefixLength = dynamicTargetLength - finalRepeatedBlock.length;
                        mutatedTail = mutatedTail.substring(0, prefixLength) + finalRepeatedBlock;
                    }
                }

                serial = ensureCharset(baseHeader + mutatedTail);
                innerAttempts++;
            } while (seenSerials.has(serial) && innerAttempts < 20);

            if (!seenSerials.has(serial)) {
                seenSerials.add(serial);
                const flagValue = TG_FLAGS[item.tg] || 0;
                generatedSerials.push({ serial: serial, flag: (flagValue !== 0) ? 1 : 0, state_flag: flagValue, slot: generatedSerials.length });
            }
            
            if (i > 0 && i % 500 === 0) {
                self.postMessage({ type: 'progress', payload: { processed: i, total: totalRequested } });
            }
        }
        
        // --- Validation Logic ---
        let validationResult = null;
        if (config.debugMode) {
             const legendaryItems = generatedSerials.filter(item => item.state_flag === TG_FLAGS.TG3 || item.state_flag === TG_FLAGS.TG4);
             if (legendaryItems.length > 0) {
                 if (highValueParts.length > 0) {
                     const successCount = legendaryItems.filter(item => highValueParts.some(part => item.serial.includes(part))).length;
                     const successRate = ((successCount / legendaryItems.length) * 100).toFixed(1);
                     validationResult = `✅ Validation: ${successCount} of ${legendaryItems.length} legendary items (${successRate}%) contained a high-value part.`;
                 } else {
                     validationResult = "⚠️ Validation: No high-value parts were extracted from the repo.";
                 }
             }
        }

        const lines = ["state:", "  inventory:", "    items:", "      backpack:"];
        generatedSerials.forEach(item => {
            lines.push(`        slot_${item.slot}:`);
            lines.push(`          serial: '${item.serial}'`);
            if (item.flag === 1) lines.push(`          flags: 1`);
            if (item.state_flag !== 0) lines.push(`          state_flags: ${item.state_flag}`);
        });
        
        self.postMessage({ type: 'complete', payload: { yaml: lines.join('\n'), uniqueCount: generatedSerials.length, totalRequested: totalRequested, validationResult: validationResult }});

    } catch (error) {
        console.error("Worker Error:", error);
        self.postMessage({ type: 'error', payload: { message: error.message } });
    }
};
