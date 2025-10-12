// --- WORKER SCRIPT (generator.worker.js) ---
// Definitive version with classic TG4 "Targeted Mutation" restored.

// --- CONSTANTS ---
const DEFAULT_SEED = "@Uge8pzm/)}}!t8IjFw;$d;-DH;sYyj@*ifd*pw6Jyw*U";
const BASE85_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~";
const ALLOWED_EXTRA = "/";
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;
const TG_FLAGS = { "NEW": 0, "TG1": 17, "TG2": 33, "TG3": 65, "TG4": 129 };
const RANDOM_SAFETY_MARGIN = 2000;

// --- NEW CONSTANTS FOR TG4 TARGETED MUTATION ---
const CLASS_MOD_CHARS = "M02_L^3O4x}@%#Ej5AWuNRTYUIPSDFGHJKZXC_V_B16789abcdefghiklmnopqrstvwyz".split('');
const SHIELD_CHARS = "0123456789-+*/:;=<>ABCDEFGHIJabcdefghijPQRSTUVWXYZpqrstuvwxyz".split('');
const ENHANCEMENT_CHARS = "!#$%&()*+-@^_`{}~0123456789ABCDEFGHIJKLM".split('');
const GUN_CHARS = "0123456789DMGSHTYUIP!$%*+-:;=abcdefghij".split('');
const REPKIT_CHARS = "098765RPKTHL()*/-=xyz_wv".split('');
const MUTATION_INTENSITY = { "light": 0.3, "medium": 0.6, "heavy": 0.9 };

// --- GPU & RANDOMNESS STATE ---
let gpuDevice = null;
let randomBuffer;
let randomIndex = 0;
const getRandom = () => randomBuffer[randomIndex++];

// --- WebGPU & UTILITY FUNCTIONS ---
async function setupWebGPU() { if (typeof navigator === 'undefined' || !navigator.gpu) { console.warn("WebGPU not supported. Falling back to Math.random()."); return null; } try { const adapter = await navigator.gpu.requestAdapter(); if (!adapter) { console.warn("No appropriate GPUAdapter found. Falling back."); return null; } const device = await adapter.requestDevice(); gpuDevice = device; return device; } catch (error) { console.error("Failed to initialize WebGPU:", error); gpuDevice = null; return null; } }
async function generateRandomNumbersOnGPU(count) { if (!gpuDevice) { console.log(`Generating ${count} random numbers using CPU.`); randomBuffer = new Float32Array(count); for (let i = 0; i < count; i++) { randomBuffer[i] = Math.random(); } randomIndex = 0; return; } console.log(`Generating batch of ${count} random numbers using GPU.`); const shaderCode = `struct Uniforms { time_seed: f32, }; struct Numbers { data: array<f32>, }; @group(0) @binding(0) var<storage, read_write> outputBuffer: Numbers; @group(0) @binding(1) var<uniform> uniforms: Uniforms; fn pcg(seed_in: u32) -> u32 { var state = seed_in * 747796405u + 2891336453u; let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u; return (word >> 22u) ^ word; } @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) global_id: vec3<u32>) { let index = global_id.x; if (index >= u32(arrayLength(&outputBuffer.data))) { return; } let seed = u32(global_id.x) * 1664525u + u32(uniforms.time_seed); outputBuffer.data[index] = f32(pcg(seed)) / 4294967429.0; }`; const shaderModule = gpuDevice.createShaderModule({ code: shaderCode }); const pipeline = gpuDevice.createComputePipeline({ layout: 'auto', compute: { module: shaderModule, entryPoint: 'main' }}); const outputBufferSize = count * Float32Array.BYTES_PER_ELEMENT; const outputGPUBuffer = gpuDevice.createBuffer({ size: outputBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }); const uniformBuffer = gpuDevice.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); gpuDevice.queue.writeBuffer(uniformBuffer, 0, new Float32Array([performance.now()])); const bindGroup = gpuDevice.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: outputGPUBuffer } }, { binding: 1, resource: { buffer: uniformBuffer } }]}); const commandEncoder = gpuDevice.createCommandEncoder(); const passEncoder = commandEncoder.beginComputePass(); passEncoder.setPipeline(pipeline); passEncoder.setBindGroup(0, bindGroup); passEncoder.dispatchWorkgroups(Math.ceil(count / 64)); passEncoder.end(); const stagingBuffer = gpuDevice.createBuffer({ size: outputBufferSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); commandEncoder.copyBufferToBuffer(outputGPUBuffer, 0, stagingBuffer, 0, outputBufferSize); gpuDevice.queue.submit([commandEncoder.finish()]); await stagingBuffer.mapAsync(GPUMapMode.READ); const data = stagingBuffer.getMappedRange(); randomBuffer = new Float32Array(data.slice(0)); stagingBuffer.unmap(); outputGPUBuffer.destroy(); stagingBuffer.destroy(); uniformBuffer.destroy(); randomIndex = 0; }
function randomInt(min, max) { if (min > max) [min, max] = [max, min]; return Math.floor(getRandom() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(getRandom() * arr.length)]; }
function ensureCharset(s) { return [...s].filter(c => ALPHABET.includes(c)).join(''); }
function splitHeaderTail(serial) { const match = serial.match(HEADER_RE); if (match) return [match[1], serial.substring(match[0].length)]; return [serial.substring(0, 10), serial.substring(10)]; }
function extractHighValueParts(repoTails, minPartSize, maxPartSize) { const frequencyMap = new Map(); for (let size = minPartSize; size <= maxPartSize; size++) { for (const tail of repoTails) { if (tail.length < size) continue; for (let i = 0; i <= tail.length - size; i++) { const fragment = tail.substring(i, i + size); frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1); } } } const repeatedParts = [...frequencyMap.entries()].filter(([, count]) => count > 1).sort((a, b) => (b[1] !== a[1]) ? b[1] - a[1] : b[0].length - a[0].length); return repeatedParts.map(entry => entry[0]); }

function extractLegendaryPerks(tail, min, max, lengthMin, lengthMax) { if (!tail || tail.length < 10) return null; const middleStart = Math.floor(tail.length * (min / 100)); const middleEnd = Math.floor(tail.length * (max / 100)); const perkLength = randomInt(lengthMin, lengthMax); const start = randomInt(middleStart, middleEnd - perkLength); return tail.substring(start, start + perkLength); }

// --- INTELLIGENT MUTATION ALGORITHMS ---
function generateAppendMutation(baseTail, finalLength, protectedStartLength) { const startPart = baseTail.substring(0, protectedStartLength); const paddingLength = finalLength - startPart.length; if (paddingLength <= 0) return startPart.substring(0, finalLength); let padding = ''; for (let i = 0; i < paddingLength; i++) padding += randomChoice(ALPHABET); return startPart + padding; }
function performWindowedCrossover(baseTail, parentTail, finalLength, protectedStartLength, minChunk, maxChunk, targetChunk) { let childTail = baseTail; const mutableStart = protectedStartLength; const childMutableLength = childTail.length - mutableStart; const parentMutableLength = parentTail.length - protectedStartLength; const finalChunkSize = Math.max(minChunk, Math.min(maxChunk, targetChunk)); if (childMutableLength > finalChunkSize && parentMutableLength > finalChunkSize) { const chunkStartInParent = randomInt(mutableStart, parentTail.length - finalChunkSize); const chunk = parentTail.substring(chunkStartInParent, chunkStartInParent + finalChunkSize); const injectionPoint = randomInt(mutableStart, childTail.length - chunk.length); childTail = childTail.slice(0, injectionPoint) + chunk + childTail.slice(injectionPoint + chunk.length); } if (childTail.length < finalLength) { let padding = ''; for (let i = 0; i < finalLength - childTail.length; i++) padding += randomChoice(ALPHABET); childTail += padding; } else { childTail = childTail.substring(0, finalLength); } return childTail; }

// --- NEW FUNCTIONS FOR TG4 TARGETED MUTATION ---
function getItemCharPool(item_type) { switch (item_type) { case 'shield': return SHIELD_CHARS; case 'enhancement': return ENHANCEMENT_CHARS; case 'gun': return GUN_CHARS; case 'repkit': return REPKIT_CHARS; default: return CLASS_MOD_CHARS; } }
function divideTailIntoParts(tail, num_parts) { const parts = []; if (num_parts <= 0) return parts; const part_size = Math.floor(tail.length / num_parts); for (let i = 0; i < num_parts; i++) { const start = i * part_size; const end = (i === num_parts - 1) ? tail.length : start + part_size; parts.push({ start, end }); } return parts; }
function generateTargetedMutation(baseTail, item_type) { const num_parts = Math.max(5, Math.floor(baseTail.length / 20)); const target_part_index = randomInt(0, num_parts - 1); const parts = divideTailIntoParts(baseTail, num_parts); if (target_part_index >= parts.length) return baseTail; const { start, end } = parts[target_part_index]; const chars = [...baseTail]; const mutation_rate = MUTATION_INTENSITY[randomChoice(["light", "medium", "heavy"])]; const char_pool = getItemCharPool(item_type); for (let i = start; i < end; i++) { if (getRandom() < mutation_rate) chars[i] = randomChoice(char_pool); } return chars.join(''); }

// --- ASYNC WORKER MESSAGE HANDLER ---
self.onmessage = async function(e) {
    if (e.data.type !== 'generate') return;
    const config = e.data.payload;
    try {
        if (!gpuDevice) await setupWebGPU();
        const totalRequested = config.newCount + config.tg1Count + config.tg2Count + config.tg3Count + config.tg4Count;
        if (totalRequested === 0) { self.postMessage({ type: 'complete', payload: { yaml: 'No items requested.', uniqueCount: 0, totalRequested: 0 }}); return; }
        await generateRandomNumbersOnGPU(config.gpuBatchSize);
        const [baseHeader, baseTail] = splitHeaderTail(config.seed || DEFAULT_SEED);
        const selectedRepoTails = (config.repositories[config.itemType] || '').split(/[\s\n]+/).filter(s => s.startsWith('@U')).map(s => splitHeaderTail(s)[1]);
        if (selectedRepoTails.length === 0) { self.postMessage({ type: 'warning', payload: `Selected **${config.itemType}** Repo is empty. Using Base Seed as parent.` }); selectedRepoTails.push(baseTail); }
        const highValueParts = extractHighValueParts(selectedRepoTails, config.minPartSize, config.maxPartSize);
        const legendaryStackingChance = config.legendaryChance / 100.0;
        const legendaryPerkChance = config.legendaryPerkChance / 100.0;

        const legendaryPerkRepoTails = (config.legendaryPerkRepo || '').split(/[\s\n]+/).filter(s => s.startsWith('@U')).map(s => splitHeaderTail(s)[1]);

        let legendaryPerk = null;
        if (legendaryPerkRepoTails.length > 0) {
            const randomPerkTail = randomChoice(legendaryPerkRepoTails);
            legendaryPerk = extractLegendaryPerks(randomPerkTail, config.legendaryPerkExtractionMin, config.legendaryPerkExtractionMax, config.legendaryPerkLengthMin, config.legendaryPerkLengthMax);
        }

        const serialsToGenerate = [];
        for (let i = 0; i < config.newCount; i++) serialsToGenerate.push({ tg: "NEW" });
        for (let i = 0; i < config.tg1Count; i++) serialsToGenerate.push({ tg: "TG1" });
        for (let i = 0; i < config.tg2Count; i++) serialsToGenerate.push({ tg: "TG2" });
        for (let i = 0; i < config.tg3Count; i++) serialsToGenerate.push({ tg: "TG3" });
        for (let i = 0; i < config.tg4Count; i++) serialsToGenerate.push({ tg: "TG4" });
        serialsToGenerate.sort(() => getRandom() - 0.5);

        const seenSerials = new Set();
        const generatedSerials = [];

        for (let i = 0; i < totalRequested; i++) {
            if (randomIndex >= randomBuffer.length - RANDOM_SAFETY_MARGIN) await generateRandomNumbersOnGPU(config.gpuBatchSize);
            const item = serialsToGenerate[i];
            let serial = '';
            let innerAttempts = 0;
            
            do {
                const parentTail = randomChoice(selectedRepoTails);
                const protectedStartPercent = randomInt(config.minProtectedPercent, config.maxProtectedPercent);
                const protectedStartLength = Math.floor(baseTail.length * (protectedStartPercent / 100));
                let dynamicTargetLength = Math.floor(baseTail.length + config.targetOffset);
                dynamicTargetLength = Math.max(dynamicTargetLength, protectedStartLength);

                let mutatedTail;

                // --- MODIFIED LOGIC FOR TG4 ---
                if (item.tg === "TG4") {
                    // Classic TG4: Targeted mutation on the original, unmodified base tail. Length is preserved.
                    mutatedTail = generateTargetedMutation(baseTail, config.itemType);
                } else {
                    // Standard Mutation for NEW, TG1, TG2, TG3
                    const mutableZone = baseTail.length - protectedStartLength;
                    if (item.tg === "NEW" || mutableZone < config.minChunkSize) {
                        mutatedTail = generateAppendMutation(baseTail, dynamicTargetLength, protectedStartLength);
                    } else {
                        mutatedTail = performWindowedCrossover(baseTail, parentTail, dynamicTargetLength, protectedStartLength, config.minChunkSize, config.maxChunkSize, config.targetChunkSize);
                    }
                    
                    // Legendary Stacking Logic ONLY for TG3
                    if (item.tg === "TG3" && getRandom() < legendaryStackingChance && highValueParts.length > 0) {
                        const part = randomChoice(highValueParts);
                        const availableMutableSpace = dynamicTargetLength - protectedStartLength;
                        if (availableMutableSpace >= part.length) { 
                            const repeatedBlock = part.repeat(5).substring(0, availableMutableSpace);
                            const prefixLength = dynamicTargetLength - repeatedBlock.length;
                            mutatedTail = mutatedTail.substring(0, prefixLength) + repeatedBlock;
                        }
                    }
                }

                // --- NEW LEGENDARY PERK INJECTION ---
                if (legendaryPerk && getRandom() < legendaryPerkChance) {
                    const minInjectionPoint = Math.floor(dynamicTargetLength * (config.legendaryPerkMin / 100));
                    const maxInjectionPoint = Math.floor(dynamicTargetLength * (config.legendaryPerkMax / 100));
                    const injectionPoint = randomInt(minInjectionPoint, maxInjectionPoint);
                    mutatedTail = mutatedTail.slice(0, injectionPoint) + legendaryPerk + mutatedTail.slice(injectionPoint + legendaryPerk.length);
                }
                
                serial = ensureCharset(baseHeader + mutatedTail);
                innerAttempts++;
            } while (seenSerials.has(serial) && innerAttempts < 20);

            if (!seenSerials.has(serial)) {
                seenSerials.add(serial);
                const flagValue = TG_FLAGS[item.tg] || 0;
                generatedSerials.push({ serial: serial, flag: (flagValue !== 0) ? 1 : 0, state_flag: flagValue, slot: generatedSerials.length });
            }
            if (i > 0 && i % 500 === 0) self.postMessage({ type: 'progress', payload: { processed: i + 1, total: totalRequested } });
        }
        
        const fullLines = ["state:", "  inventory:", "    items:", "      backpack:"];
        generatedSerials.forEach(item => { 
            fullLines.push(`        slot_${item.slot}:`); 
            fullLines.push(`          serial: '${item.serial}'`); 
            if (item.flag === 1) fullLines.push(`          flags: 1`); 
            if (item.state_flag !== 0) fullLines.push(`          state_flags: ${item.state_flag}`); 
        });
        const fullYaml = fullLines.join('\n');

        const truncatedSerials = generatedSerials.slice(0, 30000);
        const truncatedLines = ["state:", "  inventory:", "    items:", "      backpack:"];
        truncatedSerials.forEach(item => { 
            truncatedLines.push(`        slot_${item.slot}:`); 
            truncatedLines.push(`          serial: '${item.serial}'`); 
            if (item.flag === 1) truncatedLines.push(`          flags: 1`); 
            if (item.state_flag !== 0) truncatedLines.push(`          state_flags: ${item.state_flag}`); 
        });
        const truncatedYaml = truncatedLines.join('\n');

        self.postMessage({ type: 'complete', payload: { yaml: fullYaml, truncatedYaml: truncatedYaml, uniqueCount: generatedSerials.length, totalRequested: totalRequested, validationResult: null }});
    } catch (error) { console.error("Worker Error:", error); self.postMessage({ type: 'error', payload: { message: error.message } }); }
};
