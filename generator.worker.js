// --- WORKER SCRIPT (generator.worker.js) ---
// Definitive version with a corrected WebGPU implementation and dynamic refill.

// --- CONSTANTS ---
const DEFAULT_SEED = "@Uge9B?m/)}}!ffxLNwtrrhUgJFvP19)9>F7c1drg69->2ZNDt8=I>e4x5g)=u;D`>fBRx?3?tmf{sYpdCQjv<(7NJN*DpHY(R3rc";
const BASE85_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~";
const ALLOWED_EXTRA = "/";
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;
const TG_FLAGS = { "NEW": 0, "TG1": 17, "TG2": 33, "TG3": 65, "TG4": 129 };
const CHUNK_SIZE = 500;
const PART_SIZE = 5;
const RANDOM_BATCH_SIZE = 250000;
const RANDOM_SAFETY_MARGIN = 1000;

// --- GPU & RANDOMNESS STATE ---
let gpuDevice = null;
let randomBuffer;
let randomIndex = 0;
const getRandom = () => randomBuffer[randomIndex++];

// --- WebGPU INITIALIZATION AND EXECUTION ---
async function setupWebGPU() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
        console.warn("WebGPU not supported. Falling back to Math.random().");
        return null;
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.warn("No appropriate GPUAdapter found. Falling back.");
            return null;
        }
        const device = await adapter.requestDevice();
        gpuDevice = device;
        return device;
    } catch (error) {
        console.error("Failed to initialize WebGPU:", error);
        gpuDevice = null; // Ensure we fallback if initialization fails
        return null;
    }
}

async function generateRandomNumbersOnGPU(count) {
    if (!gpuDevice) {
        console.log(`Generating ${count} random numbers using CPU (Math.random).`);
        randomBuffer = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            randomBuffer[i] = Math.random();
        }
        randomIndex = 0; // Reset index after refill
        return;
    }

    console.log(`Generating batch of ${count} random numbers using GPU.`);
    
    // --- FIXED WGSL SHADER ---
    // It now accepts a 'uniform' buffer containing the time-based seed.
    const shaderCode = `
        struct Uniforms {
            time_seed: f32,
        };
        struct Numbers { 
            data: array<f32>, 
        };

        @group(0) @binding(0) var<storage, read_write> outputBuffer: Numbers;
        @group(0) @binding(1) var<uniform> uniforms: Uniforms;

        fn pcg(seed_in: u32) -> u32 {
            var state = seed_in * 747796405u + 2891336453u;
            let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
            return (word >> 22u) ^ word;
        }

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let index = global_id.x;
            if (index >= u32(arrayLength(&outputBuffer.data))) { return; }
            
            // The seed now correctly uses the value passed in from JavaScript.
            let seed = u32(global_id.x) * 1664525u + u32(uniforms.time_seed);
            outputBuffer.data[index] = f32(pcg(seed)) / 4294967429.0;
        }
    `;

    const shaderModule = gpuDevice.createShaderModule({ code: shaderCode });
    const pipeline = gpuDevice.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
    });

    // --- Create buffers for output and for the new uniform seed ---
    const outputBufferSize = count * Float32Array.BYTES_PER_ELEMENT;
    const outputGPUBuffer = gpuDevice.createBuffer({
        size: outputBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    const uniformBuffer = gpuDevice.createBuffer({
        size: 4, // One 32-bit float
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // --- Write the current time from JS into the uniform buffer ---
    gpuDevice.queue.writeBuffer(uniformBuffer, 0, new Float32Array([performance.now()]));

    const bindGroup = gpuDevice.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: outputGPUBuffer } },
            { binding: 1, resource: { buffer: uniformBuffer } } // Add the uniform buffer to the binding
        ]
    });

    const commandEncoder = gpuDevice.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(count / 64));
    passEncoder.end();
    const stagingBuffer = gpuDevice.createBuffer({
        size: outputBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(outputGPUBuffer, 0, stagingBuffer, 0, outputBufferSize);
    gpuDevice.queue.submit([commandEncoder.finish()]);
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = stagingBuffer.getMappedRange();
    randomBuffer = new Float32Array(data.slice(0));
    stagingBuffer.unmap();
    
    // Clean up GPU resources
    outputGPUBuffer.destroy();
    stagingBuffer.destroy();
    uniformBuffer.destroy();
    
    randomIndex = 0; // Reset index after refill
}

// --- UTILITY AND MUTATION FUNCTIONS (Unchanged) ---
function randomInt(min, max) { return Math.floor(getRandom() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(getRandom() * arr.length)]; }
function ensureCharset(s) { return [...s].filter(c => ALPHABET.includes(c)).join(''); }
function splitHeaderTail(serial) { /* ... same as before ... */ }
function extractHighValueParts(repoTails, fragmentSize = PART_SIZE) { /* ... same as before ... */ }
function performLegendaryStacking(tail, highValueParts) { /* ... same as before ... */ }
function performCrossoverMutation(tailA, tailB) { /* ... same as before ... */ }
function generateTargetedMutation(baseTail, highValueParts, fallbackRepoTails) { /* ... same as before ... */ }
// --- Omitted for brevity, they are identical to your last file ---
splitHeaderTail=t=>{const a=t.match(HEADER_RE);if(a)return[a[1],t.substring(a[0].length)];const e=t.substring(0,10);return[e,t.substring(10)]};extractHighValueParts=t=>{const a=new Set,e=new Map;for(const s of t){for(let t=0;t<=s.length-2*PART_SIZE;t++){const e=s.substring(t,t+PART_SIZE),r=s.substring(t+PART_SIZE,t+2*PART_SIZE);e===r&&a.add(e)}for(let t=0;t<=s.length-PART_SIZE;t++){const r=s.substring(t,t+PART_SIZE);e.set(r,(e.get(r)||0)+1)}}const s=[...e.entries()].sort(((t,a)=>a[1]-t[1]));return s.slice(0,20).forEach((t=>a.add(t[0]))),Array.from(a)};performLegendaryStacking=(t,a)=>{if(!a||0===a.length)return t;const e=randomChoice(a),s=randomInt(2,4),r=e.repeat(s),n=randomInt(Math.floor(.4*t.length),Math.floor(.6*t.length));return t.substring(0,n)+r+t.substring(n)};performCrossoverMutation=(t,a)=>{if(!a||a.length<20)return t;const e=Math.min(t.length,a.length),s=randomInt(Math.floor(.3*e),Math.floor(.7*e));return t.substring(0,s)+a.substring(s)};generateTargetedMutation=(t,a,e)=>{if(a&&a.length>0){let e=t;const s=randomInt(1,3);for(let t=0;t<s;t++){const s=randomChoice(a),r=s.length;if(e.length>r){const t=randomInt(0,e.length-r);e=e.slice(0,t)+s+e.slice(t+r)}}return e}const s=randomChoice(e);return performCrossoverMutation(t,s)};


// --- ASYNC WORKER MESSAGE HANDLER ---
self.onmessage = async function(e) {
    if (e.data.type !== 'generate') return;
    
    const config = e.data.payload;
    
    try {
        // Run setup once at the start of any generation job.
        if (!gpuDevice) {
            await setupWebGPU();
        }

        const totalRequested = config.newCount + config.tg1Count + config.tg2Count + config.tg3Count + config.tg4Count;
        if (totalRequested === 0) {
            self.postMessage({ type: 'complete', payload: { yaml: 'No items requested.', uniqueCount: 0, totalRequested: 0 } });
            return;
        }

        // 1. PRIME THE PUMP: Generate the first batch of random numbers.
        await generateRandomNumbersOnGPU(RANDOM_BATCH_SIZE);
        
        // 2. SETUP
        const seedInput = config.seed || DEFAULT_SEED;
        const [baseHeader, baseTail] = splitHeaderTail(seedInput);
        const allRepoTails = [];
        for (const itemType in config.repositories) {
            config.repositories[itemType].split(/[\s\n]+/g).filter(s => s.startsWith('@U'))
                .forEach(serial => allRepoTails.push(splitHeaderTail(serial)[1]));
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
        const fallbackRepo = allRepoTails.length > 0 ? allRepoTails : [baseTail];
        const serialsToGenerate = [];
        for (let i = 0; i < config.newCount; i++) serialsToGenerate.push({ tg: "NEW", flag: TG_FLAGS["NEW"] });
        for (let i = 0; i < config.tg1Count; i++) serialsToGenerate.push({ tg: "TG1", flag: TG_FLAGS["TG1"] });
        for (let i = 0; i < config.tg2Count; i++) serialsToGenerate.push({ tg: "TG2", flag: TG_FLAGS["TG2"] });
        for (let i = 0; i < config.tg3Count; i++) serialsToGenerate.push({ tg: "TG3", flag: TG_FLAGS["TG3"] });
        for (let i = 0; i < config.tg4Count; i++) serialsToGenerate.push({ tg: "TG4", flag: TG_FLAGS["TG4"] });
        serialsToGenerate.sort(() => Math.random() - 0.5);

        const seenSerials = new Set();
        const generatedSerials = [];

        // 3. MAIN GENERATION LOOP (with refill check)
        for (let i = 0; i < totalRequested; i++) {
            
            if (randomIndex >= randomBuffer.length - RANDOM_SAFETY_MARGIN) {
                console.log("Random number buffer low. Refilling...");
                await generateRandomNumbersOnGPU(RANDOM_BATCH_SIZE);
                console.log("Refill complete.");
            }

            const item = serialsToGenerate[i];
            let serial = '';
            let innerAttempts = 0;
            
            do {
                let mutatedTail;
                if (item.tg === "TG4") {
                    mutatedTail = generateTargetedMutation(baseTail, highValueParts, fallbackRepo);
                } else {
                    if (item.tg === "TG3" && getRandom() < 0.3) {
                        mutatedTail = performLegendaryStacking(baseTail, highValueParts);
                    } else if ((item.tg === "TG2" || item.tg === "TG3") && getRandom() < 0.75) {
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
                const final_item_flag = (item.flag !== 0 || item.tg === "TG4") ? 1 : 0;
                const final_state_flag = (item.tg === "TG4") ? TG_FLAGS["TG4"] : item.flag;
                generatedSerials.push({ serial: serial, flag: final_item_flag, state_flag: final_state_flag, slot: generatedSerials.length });
            }

            if (i > 0 && i % CHUNK_SIZE === 0) {
                self.postMessage({ type: 'progress', payload: { processed: i, total: totalRequested } });
            }
        }
        
        // 4. FINALIZE AND SEND
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
        console.error("Worker Error:", error);
        self.postMessage({ type: 'error', payload: { message: error.message } });
    }
};
