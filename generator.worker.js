// --- WORKER SCRIPT (generator.worker.js) ---
// Definitive version with a corrected genetic fallback path.

// --- CONSTANTS ---
const DEFAULT_SEED = "@Uge8pzm/)}}!t8IjFw;$d;-DH;sYyj@*ifd*pw6Jyw*U";
const BASE85_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~";
const ALLOWED_EXTRA = "/";
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;
const TG_FLAGS = { "NEW": 0, "TG1": 17, "TG2": 33, "TG3": 65, "TG4": 129 };
const RANDOM_SAFETY_MARGIN = 2000;

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
function splitHeaderTail(serial) { const match = serial.match(HEADER_RE); if (match) return [match[1], serial.substring(match[0].length)]; const hdr = serial.substring(0, 10); return [hdr, serial.substring(10)]; }
function extractHighValueParts(repoTails, partSize) { const highValueParts = new Set(); const frequencyMap = new Map(); for (const tail of repoTails) { for (let i = 0; i <= tail.length - (partSize * 2); i++) { const fragment1 = tail.substring(i, i + partSize); const fragment2 = tail.substring(i + partSize, i + (partSize * 2)); if (fragment1 === fragment2) highValueParts.add(fragment1); } for (let i = 0; i <= tail.length - partSize; i++) { const fragment = tail.substring(i, i + partSize); frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1); } } const sortedByFrequency = [...frequencyMap.entries()].sort((a, b) => b[1] - a[1]); sortedByFrequency.slice(0, 20).forEach(entry => highValueParts.add(entry[0])); return Array.from(highValueParts); }

// --- INTELLIGENT MUTATION ALGORITHMS v15.1 ---
function generateAppendMutation(baseTail, finalLength, protectedStartLength) { const startPart = baseTail.substring(0, protectedStartLength); const paddingLength = finalLength - startPart.length; if (paddingLength <= 0) { return startPart.substring(0, finalLength); } let padding = ''; for (let i = 0; i < paddingLength; i++) { padding += randomChoice(ALPHABET); } return startPart + padding; }
function performWindowedCrossover(baseTail, parentTail, finalLength, protectedStartLength, minChunk, maxChunk, targetChunk) { let childTail = baseTail; const mutableStart = protectedStartLength; const childMutableLength = childTail.length - mutableStart; const parentMutableLength = parentTail.length - protectedStartLength; const finalChunkSize = Math.max(minChunk, Math.min(maxChunk, targetChunk)); if (childMutableLength > finalChunkSize && parentMutableLength > finalChunkSize) { const chunkStartInParent = randomInt(mutableStart, parentTail.length - finalChunkSize); const chunk = parentTail.substring(chunkStartInParent, chunkStartInParent + finalChunkSize); const injectionPoint = randomInt(mutableStart, childTail.length - chunk.length); childTail = childTail.slice(0, injectionPoint) + chunk + childTail.slice(injectionPoint + chunk.length); } if (childTail.length < finalLength) { let padding = ''; const paddingLength = finalLength - childTail.length; for (let i = 0; i < paddingLength; i++) { padding += randomChoice(ALPHABET); } childTail += padding; } else { childTail = childTail.substring(0, finalLength); } return childTail; }

// --- ASYNC WORKER MESSAGE HANDLER ---
self.onmessage = async function(e) {
    if (e.data.type !== 'generate') return;
    const config = e.data.payload;
    try {
        if (!gpuDevice) await setupWebGPU();
        const totalRequested = config.newCount + config.tg1Count + config.tg2Count + config.tg3Count + config.tg4Count;
        if (totalRequested === 0) { self.postMessage({ type: 'complete', payload: { yaml: 'No items requested.', uniqueCount: 0, totalRequested: 0 }}); return; }
        await generateRandomNumbersOnGPU(config.gpuBatchSize);
        
        const seedInput = config.seed || DEFAULT_SEED;
        const [baseHeader, baseTail] = splitHeaderTail(seedInput);
        const selectedRepoTails = config.repositories[config.itemType].split(/[\s\n]+/).filter(s => s.startsWith('@U')).map(s => splitHeaderTail(s)[1]);
        if (selectedRepoTails.length === 0) { self.postMessage({ type: 'warning', payload: `Selected **${config.itemType}** Repo is empty. Using Base Seed as parent.` }); selectedRepoTails.push(baseTail); }
        
        const highValueParts = extractHighValueParts(selectedRepoTails, config.partSize);
        const legendaryStackingChance = config.legendaryChance / 100.0;

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
            if (randomIndex >= randomBuffer.length - RANDOM_SAFETY_MARGIN) { console.log("Random buffer low. Refilling..."); await generateRandomNumbersOnGPU(config.gpuBatchSize); console.log("Refill complete."); }
            const item = serialsToGenerate[i];
            let serial = '';
            let innerAttempts = 0;
            do {
                const parentTail = randomChoice(selectedRepoTails);
                const protectedStartPercent = randomInt(config.minProtectedPercent, config.maxProtectedPercent);
                const protectedStartLength = Math.floor(baseTail.length * (protectedStartPercent / 100));
                
                const averageLength = (baseTail.length + parentTail.length) / 2;
                const finalMin = averageLength + config.minOffset;
                const finalMax = averageLength + config.maxOffset;
                const finalTarget = averageLength + config.targetOffset;
                const dynamicTargetLength = Math.floor(Math.max(finalMin, Math.min(finalMax, finalTarget)));

                let mutatedTail;
                const mutableZone = baseTail.length - protectedStartLength;

                // --- THIS IS THE CRITICAL FIX ---
                if (item.tg === "NEW") {
                    // NEW items ONLY use the base seed. This is correct.
                    mutatedTail = generateAppendMutation(baseTail, dynamicTargetLength, protectedStartLength);
                } else {
                    // ALL TG1-4 items use this path.
                    if (mutableZone < config.minChunkSize) {
                        // The FALLBACK path. The transplant is impossible.
                        // It now correctly uses the REPO PARENT as the base for the append.
                        mutatedTail = generateAppendMutation(parentTail, dynamicTargetLength, protectedStartLength);
                    } else {
                        // The GOLDEN path. The transplant is possible.
                        mutatedTail = performWindowedCrossover(baseTail, parentTail, dynamicTargetLength, protectedStartLength, config.minChunkSize, config.maxChunkSize, config.targetChunkSize);
                    }
                }
                
                if (((item.tg === "TG3" && getRandom() < legendaryStackingChance) || item.tg === "TG4") && highValueParts.length > 0) {
                    const part = randomChoice(highValueParts);
                    const mutableStart = protectedStartLength;
                    const mutableEnd = mutatedTail.length - 5; 
                    if (mutableEnd > mutableStart && (mutableEnd - mutableStart) > part.length) {
                        const injectionPoint = randomInt(mutableStart, mutableEnd - part.length);
                        mutatedTail = mutatedTail.slice(0, injectionPoint) + part + mutatedTail.slice(injectionPoint + part.length);
                    }
                }
                
                serial = ensureCharset(baseHeader + mutatedTail);
                innerAttempts++;
            } while (seenSerials.has(serial) && innerAttempts < 20);

            if (!seenSerials.has(serial)) {
                seenSerials.add(serial);
                const flagValue = TG_FLAGS[item.tg] || 0;
                const final_item_flag = (flagValue !== 0) ? 1 : 0;
                generatedSerials.push({ serial: serial, flag: final_item_flag, state_flag: flagValue, slot: generatedSerials.length });
            }
            if (i > 0 && i % 500 === 0) { self.postMessage({ type: 'progress', payload: { processed: i, total: totalRequested } }); }
        }
        
        const lines = ["state:", "  inventory:", "    items:", "      backpack:"];
        generatedSerials.forEach(item => { lines.push(`        slot_${item.slot}:`); lines.push(`          serial: '${item.serial}'`); if (item.flag === 1) lines.push(`          flags: 1`); if (item.state_flag !== 0) lines.push(`          state_flags: ${item.state_flag}`); });
        self.postMessage({ type: 'complete', payload: { yaml: lines.join('\n'), uniqueCount: generatedSerials.length, totalRequested: totalRequested }});
    } catch (error) { console.error("Worker Error:", error); self.postMessage({ type: 'error', payload: { message: error.message } }); }
};
