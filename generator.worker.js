// --- WORKER SCRIPT (generator.worker.js) ---
// Definitive version with classic TG4 "Targeted Mutation" restored.
// Performance Fix: All statistical calculations are handled in the worker.
// UI Fix: YAML is sent immediately, stats are sent in a separate message.
// DEBUGGING: Added extensive console logging with robust flag setting.
// CORRECTION 2: Modified crossover logic to correctly handle 100% protection edge case.

// --- CONSTANTS ---
const DEFAULT_SEED = '@Uge8pzm/)}}!t8IjFw;$d;-DH;sYyj@*ifd*pw6Jyw*U';
const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~';
const ALLOWED_EXTRA = '/';
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;
const TG_FLAGS = { NEW: 0, TG1: 17, TG2: 33, TG3: 65, TG4: 129 };
const RANDOM_SAFETY_MARGIN = 2000;

// --- NEW CONSTANTS FOR TG4 TARGETED MUTATION ---
const CLASS_MOD_CHARS = 'M02_L^3O4x}@%#Ej5AWuNRTYUIPSDFGHJKZXC_V_B16789abcdefghiklmnopqrstvwyz'.split('');
const SHIELD_CHARS = '0123456789-+*/:;=<>ABCDEFGHIJabcdefghijPQRSTUVWXYZpqrstuvwxyz'.split('');
const ENHANCEMENT_CHARS = '!#$%&()*+-@^_`{}~0123456789ABCDEFGHIJKLM'.split('');
const GUN_CHARS = '0123456789DMGSHTYUIP!$%*+-:;=abcdefghij'.split('');
const REPKIT_CHARS = '098765RPKTHL()*/-=xyz_wv'.split('');
const MUTATION_INTENSITY = { light: 0.3, medium: 0.6, heavy: 0.9 };

// --- GPU & RANDOMNESS STATE ---
let gpuDevice = null;
let randomBuffer;
let randomIndex = 0;
let debugMode = false; // Global debug flag

function getNextRandom() {
	if (randomIndex >= randomBuffer.length) {
		console.warn('Random buffer depleted. Consider increasing gpuBatchSize.');
		randomIndex = 0; // Reset to avoid crashing, but this is not ideal
	}
	return randomBuffer[randomIndex++];
}

// --- WebGPU & UTILITY FUNCTIONS ---
async function setupWebGPU() {
    console.log('[DEBUG] Attempting to set up WebGPU...');
	if (typeof navigator === 'undefined' || !navigator.gpu) {
		console.warn('WebGPU not supported. Falling back to crypto.getRandomValues.');
		return null;
	}
	try {
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			console.warn('No appropriate GPUAdapter found. Falling back.');
			return null;
		}
		const device = await adapter.requestDevice();
        console.log('[DEBUG] WebGPU device successfully initialized.');
		gpuDevice = device;
		return device;
	} catch (error) {
		console.error('Failed to initialize WebGPU:', error);
		gpuDevice = null;
		return null;
	}
}
async function generateRandomNumbersOnGPU(count) {
	if (!gpuDevice) {
		console.log(`[DEBUG] Generating ${count} random numbers using CPU (crypto.getRandomValues).`);
		randomBuffer = new Float32Array(count);
		const maxChunkSize = 16384; // 65536 bytes / 4 bytes per float
		let offset = 0;

		while (offset < count) {
			const chunkSize = Math.min(maxChunkSize, count - offset);
			const randomValues = new Uint32Array(chunkSize);
			crypto.getRandomValues(randomValues);
			for (let i = 0; i < chunkSize; i++) {
				randomBuffer[offset + i] = randomValues[i] / 0xffffffff;
			}
			offset += chunkSize;
		}

		randomIndex = 0;
		return;
	}
	console.log(`[DEBUG] Generating batch of ${count} random numbers using GPU.`);
	const shaderCode = `
        struct Uniforms { time_seed: f32, };
        struct Numbers { data: array<f32>, };
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
            let seed = u32(global_id.x) * 1664525u + u32(uniforms.time_seed);
            outputBuffer.data[index] = f32(pcg(seed)) / 4294967429.0;
        }
    `;
	const shaderModule = gpuDevice.createShaderModule({ code: shaderCode });
	const pipeline = gpuDevice.createComputePipeline({
		layout: 'auto',
		compute: { module: shaderModule, entryPoint: 'main' },
	});
	const outputBufferSize = count * Float32Array.BYTES_PER_ELEMENT;
	const outputGPUBuffer = gpuDevice.createBuffer({
		size: outputBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
	});
	const uniformBuffer = gpuDevice.createBuffer({
		size: 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	gpuDevice.queue.writeBuffer(uniformBuffer, 0, new Float32Array([performance.now()]));
	const bindGroup = gpuDevice.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: outputGPUBuffer } },
			{ binding: 1, resource: { buffer: uniformBuffer } },
		],
	});
	const commandEncoder = gpuDevice.createCommandEncoder();
	const passEncoder = commandEncoder.beginComputePass();
	passEncoder.setPipeline(pipeline);
	passEncoder.setBindGroup(0, bindGroup);
	const workgroupCount = Math.ceil(count / 64);
	passEncoder.dispatchWorkgroups(workgroupCount);
	passEncoder.end();
	const readbackBuffer = gpuDevice.createBuffer({
		size: outputBufferSize,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
	});
	commandEncoder.copyBufferToBuffer(outputGPUBuffer, 0, readbackBuffer, 0, outputBufferSize);
	await gpuDevice.queue.submit([commandEncoder.finish()]);
	await readbackBuffer.mapAsync(GPUMapMode.READ);
	const result = new Float32Array(readbackBuffer.getMappedRange());
	randomBuffer = new Float32Array(result);
	readbackBuffer.unmap();
	randomIndex = 0;
}
function randomInt(min, max) {
	if (min > max) [min, max] = [max, min];
	return Math.floor(getNextRandom() * (max - min + 1)) + min;
}
function randomChoice(arr) {
	return arr[Math.floor(getNextRandom() * arr.length)];
}
function ensureCharset(s) {
	return [...s].filter((c) => ALPHABET.includes(c)).join('');
}
function splitHeaderTail(serial) {
	const match = serial.match(HEADER_RE);
	if (match) return [match[1], serial.substring(match[0].length)];
	return [serial.substring(0, 10), serial.substring(10)];
}
function extractHighValueParts(repoTails, minPartSize, maxPartSize) {
    console.log('[DEBUG] Starting high-value part extraction...');
	const frequencyMap = new Map();
	// 1. Find all repeating substrings within the size range
	for (let size = minPartSize; size <= maxPartSize; size++) {
		for (const tail of repoTails) {
			if (tail.length < size) continue;
			for (let i = 0; i <= tail.length - size; i++) {
				const fragment = tail.substring(i, i + size);
				frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1);
			}
		}
	}
    if (debugMode) console.log(`[DEBUG] Initial frequency map size: ${frequencyMap.size}`);


	let parts = [...frequencyMap.entries()].filter(([, count]) => count > 1).map(([part]) => part);
    if (debugMode) console.log(`[DEBUG] Found ${parts.length} repeating parts.`);


	// 2. Consolidate overlapping and contained parts
	let changed = true;
	while (changed) {
		changed = false;
		const consolidated = new Set();
		parts.sort((a, b) => b.length - a.length);

		for (const part of parts) {
			let isContained = false;
			for (const biggerPart of consolidated) {
				if ((biggerPart + biggerPart).includes(part)) {
					isContained = true;
					break;
				}
			}
			if (!isContained) {
				consolidated.add(part);
			}
		}

		if (consolidated.size !== parts.length) {
			parts = [...consolidated];
			changed = true;
		}
	}
    console.log(`[DEBUG] Consolidated to ${parts.length} unique high-value parts.`);
    if (debugMode) console.log('[DEBUG] Top 5 High-Value Parts:', parts.slice(0, 5));


	// 3. Sort by length (longest first) as a final step
	return parts.sort((a, b) => b.length - a.length);
}

// --- STATS FUNCTIONS (MOVED FROM UI) ---
function getSerialTail(serial) {
	const match = serial.match(HEADER_RE);
	if (match && match[0]) {
		return serial.substring(match[0].length);
	}
	return serial.substring(10);
}

function calculateHighValuePartsStats(serials, minPartSize, maxPartSize) {
	const frequencyMap = new Map();
	const tails = serials.map(getSerialTail).filter((t) => t);

	// 1. Find all repeating substrings
	for (let size = minPartSize; size <= maxPartSize; size++) {
		for (const tail of tails) {
			if (tail.length < size) continue;
			for (let i = 0; i <= tail.length - size; i++) {
				const fragment = tail.substring(i, i + size);
				frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1);
			}
		}
	}

	let parts = [...frequencyMap.entries()].filter(([, count]) => count > 1).map(([part]) => part);

	// 2. Consolidate overlapping and contained parts
	let changed = true;
	while (changed) {
		changed = false;
		const consolidated = new Set();
		parts.sort((a, b) => b.length - a.length);

		for (const part of parts) {
			let isContained = false;
			for (const biggerPart of consolidated) {
				if ((biggerPart + biggerPart).includes(part)) {
					isContained = true;
					break;
				}
			}
			if (!isContained) {
				consolidated.add(part);
			}
		}

		if (consolidated.size !== parts.length) {
			parts = [...consolidated];
			changed = true;
		}
	}

	// 3. Return consolidated parts with their original frequencies for the chart
	const finalParts = new Map();
	for (const part of parts) {
		finalParts.set(part, frequencyMap.get(part));
	}

	return [...finalParts.entries()];
}


// --- INTELLIGENT MUTATION ALGORITHMS ---
function generateAppendMutation(baseTail, finalLength, protectedStartLength) {
    if (debugMode) console.log(`[DEBUG] > Append Mutation | finalLength: ${finalLength}, protected: ${protectedStartLength}`);
	const startPart = baseTail.substring(0, protectedStartLength);
	const paddingLength = finalLength - startPart.length;
	if (paddingLength <= 0) return startPart.substring(0, finalLength);
	let padding = '';
	for (let i = 0; i < paddingLength; i++) padding += randomChoice(ALPHABET);
    if (debugMode) console.log(`[DEBUG]   > Appending ${paddingLength} random characters.`);
	return startPart + padding;
}
function performWindowedCrossover(baseTail, parentTail, finalLength, protectedStartLength, minChunk, maxChunk, targetChunk) {
    if (debugMode) console.log(`[DEBUG] > Crossover Mutation | finalLength: ${finalLength}, protected: ${protectedStartLength}`);
	let childTail = baseTail.substring(0, protectedStartLength); // Start with only the protected part
	const finalChunkSize = Math.max(minChunk, Math.min(maxChunk, targetChunk));

    // --- NEW LOGIC ---
    // If the parent is long enough to provide a chunk, proceed.
	if (parentTail.length >= finalChunkSize) {
        // Take a chunk from ANYWHERE in the parent.
		const chunkStartInParent = randomInt(0, parentTail.length - finalChunkSize);
		const chunk = parentTail.substring(chunkStartInParent, chunkStartInParent + finalChunkSize);
        
        if (debugMode) console.log(`[DEBUG]   > Crossover: Injecting chunk "${chunk}" after protected zone.`);

        // Append the chunk directly after the protected part.
        childTail += chunk;
	}
    // --- END NEW LOGIC ---

	if (childTail.length < finalLength) {
		let padding = '';
		for (let i = 0; i < finalLength - childTail.length; i++) padding += randomChoice(ALPHABET);
		childTail += padding;
	} else {
		childTail = childTail.substring(0, finalLength);
	}
	return childTail;
}

// --- NEW FUNCTIONS FOR TG4 TARGETED MUTATION ---
function getItemCharPool(item_type) {
	switch (item_type) {
		case 'shield':
			return SHIELD_CHARS;
		case 'enhancement':
			return ENHANCEMENT_CHARS;
		case 'gun':
			return GUN_CHARS;
		case 'repkit':
			return REPKIT_CHARS;
		default:
			return CLASS_MOD_CHARS;
	}
}
function divideTailIntoParts(tail, num_parts) {
	const parts = [];
	if (num_parts <= 0) return parts;
	const part_size = Math.floor(tail.length / num_parts);
	for (let i = 0; i < num_parts; i++) {
		const start = i * part_size;
		const end = i === num_parts - 1 ? tail.length : start + part_size;
		parts.push({ start, end });
	}
	return parts;
}
function generateTargetedMutation(baseTail, item_type, mutableStart, mutableEnd) {
    if (debugMode) console.log(`[DEBUG] > TG4 Targeted Mutation | item_type: ${item_type}, start: ${mutableStart}, end: ${mutableEnd}`);

    // If start and end are the same, it's append-only mode, no mutation.
    if (mutableStart === mutableEnd) {
        if (debugMode) console.log(`[DEBUG]   > Append-only mode detected (mutableStart === mutableEnd). Skipping mutation.`);
        return baseTail;
    }

	const chars = [...baseTail];
    const intensityChoice = randomChoice(['light', 'medium', 'heavy']);
	const mutation_rate = MUTATION_INTENSITY[intensityChoice];
	const char_pool = getItemCharPool(item_type);
    
    // Use the provided start and end index for mutation.
    // Clamp the indices to be within the bounds of the tail.
    const start = Math.max(0, mutableStart);
    const end = Math.min(baseTail.length, mutableEnd);

    if (debugMode) console.log(`[DEBUG]   > Mutating indices ${start}-${end} with ${intensityChoice} intensity (${mutation_rate}).`);

    let mutationCount = 0;
	for (let i = start; i < end; i++) {
		if (getNextRandom() < mutation_rate) {
            chars[i] = randomChoice(char_pool);
            mutationCount++;
        }
	}
    if (debugMode) console.log(`[DEBUG]   > Mutated ${mutationCount} characters.`);
	return chars.join('');
}

function filterSerials(yaml, seed, validationChars) {
    console.log(`[DEBUG] Starting filtering process with seed "${seed}" and ${validationChars} validation characters.`);
	if (!yaml)
		return {
			validationResult: 'No YAML content to filter.',
			validatedYaml: '',
		};

	const lines = yaml.split('\n');
	const header = lines.slice(0, 4).join('\n'); // "state:", "  inventory:", "    items:", "      backpack:"
	const itemLines = lines.slice(4);

	if (itemLines.length === 0)
		return {
			validationResult: 'No items found in the YAML to filter.',
			validatedYaml: header,
		};

	const items = [];
	let currentItem = [];

	for (const line of itemLines) {
		if (line.trim().startsWith('slot_') && currentItem.length > 0) {
			items.push(currentItem);
			currentItem = [];
		}
		if (line.trim() !== '') {
			currentItem.push(line);
		}
	}
	if (currentItem.length > 0) {
		items.push(currentItem);
	}
    console.log(`[DEBUG] Parsed ${items.length} items from YAML for filtering.`);


	if (items.length === 0)
		return {
			validationResult: 'Could not parse any items from the YAML.',
			validatedYaml: '',
		};

	let invalidHeaderCount = 0;
	let invalidCharCount = 0;
	let offSeedCount = 0;
	const seedPrefix = seed ? seed.substring(0, validationChars) : null;
	const validatedItems = [];
	const validatedSerials = [];
	const totalSerials = items.length;

	for (const itemBlock of items) {
		const serialLine = itemBlock.find((l) => l.trim().startsWith('serial:'));
		if (!serialLine) continue;

		const serial = serialLine.trim().substring(8).replace(/'/g, '');
		let isValid = true;

		if (!serial.startsWith('@U')) {
			invalidHeaderCount++;
			isValid = false;
		}
		if (isValid) {
			for (const char of serial) {
				if (!ALPHABET.includes(char)) {
					invalidCharCount++;
					isValid = false;
					break;
				}
			}
		}

		if (isValid && seedPrefix && !serial.startsWith(seedPrefix)) {
			offSeedCount++;
			isValid = false;
		}

		if (isValid) {
			validatedItems.push(itemBlock.join('\n'));
			validatedSerials.push(serial);
		}
	}
    console.log(`[DEBUG] Filtering Complete. Total: ${totalSerials}, Passed: ${validatedItems.length}, Invalid Headers: ${invalidHeaderCount}, Invalid Chars: ${invalidCharCount}, Off-Seed: ${offSeedCount}`);


	const validatedYaml = header + '\n' + validatedItems.join('\n');
	const validatedCount = validatedItems.length;

	let validationResult;
	if (invalidHeaderCount > 0 || invalidCharCount > 0) {
		validationResult = `Filtering failed.\nInvalid headers: ${invalidHeaderCount}.\nInvalid characters: ${invalidCharCount}.`;
	} else if (offSeedCount > 0) {
		validationResult = `Filtering complete. ${validatedCount} of ${totalSerials} serials passed the filter.`;
	} else {
		validationResult = `Filtering successful! All ${totalSerials} serials are valid and on-seed.`;
	}

	return { validationResult, validatedYaml, validatedSerials };
}

// --- ASYNC WORKER MESSAGE HANDLER ---
self.onmessage = async function (e) {
	const { type, payload } = e.data;
    // This is the most reliable place to set the debug flag.
    debugMode = payload && payload.debugMode;

	console.log(`[DEBUG] Worker received message of type: ${type}. Debug mode is ${debugMode ? 'ENABLED' : 'DISABLED'}.`);

	if (type === 'validate') {
		const validationData = filterSerials(payload.yaml, payload.seed, payload.validationChars);
		let chartData = null;
		if (payload.generateStats && validationData.validatedSerials && validationData.validatedSerials.length > 0) {
			const highValueParts = calculateHighValuePartsStats(validationData.validatedSerials, payload.minPart, payload.maxPart);
			let sortedParts = highValueParts.sort((a, b) => b[1] - a[1]);
			const maxBars = 200;
			if (sortedParts.length > maxBars) {
				sortedParts = sortedParts.slice(0, maxBars);
			}
			chartData = {
				labels: sortedParts.map((p) => p[0]),
				data: sortedParts.map((p) => p[1]),
			};
		}
		self.postMessage({ type: 'complete', payload: { ...validationData, chartData } });
		return;
	}

	if (type !== 'generate') return;
	const config = e.data.payload;
    if (debugMode) console.log('[DEBUG] Received generation config:', config);
	try {
		if (!gpuDevice) await setupWebGPU();
		const totalRequested = config.newCount + config.tg1Count + config.tg2Count + config.tg3Count + config.tg4Count;
        console.log(`[DEBUG] Total serials requested: ${totalRequested}`);
		if (totalRequested === 0) {
			self.postMessage({
				type: 'complete',
				payload: {
					yaml: 'No items requested.',
					uniqueCount: 0,
					totalRequested: 0,
				},
			});
			return;
		}
		await generateRandomNumbersOnGPU(config.gpuBatchSize);
		const [baseHeader, baseTail] = splitHeaderTail(config.seed || DEFAULT_SEED);
        console.log(`[DEBUG] Seed parsed into Header: "${baseHeader}" and Tail: "${baseTail.substring(0, 20)}..." (length: ${baseTail.length})`);

		const selectedRepoTails = (config.repositories[config.itemType] || '')
			.split(/[\s\n]+/)
			.filter((s) => s.startsWith('@U'))
			.map((s) => splitHeaderTail(s)[1]);
		if (selectedRepoTails.length === 0) {
            console.log('[DEBUG] No repository tails found, using base seed tail as parent.');
			selectedRepoTails.push(baseTail);
		} else {
            console.log(`[DEBUG] Loaded ${selectedRepoTails.length} tails from the "${config.itemType}" repository.`);
        }

		const highValueParts = extractHighValueParts(selectedRepoTails, config.minPartSize, config.maxPartSize);
		const legendaryStackingChance = config.legendaryChance / 100.0;

		const serialsToGenerate = [];
		for (let i = 0; i < config.newCount; i++) serialsToGenerate.push({ tg: 'NEW' });
		for (let i = 0; i < config.tg1Count; i++) serialsToGenerate.push({ tg: 'TG1' });
		for (let i = 0; i < config.tg2Count; i++) serialsToGenerate.push({ tg: 'TG2' });
		for (let i = 0; i < config.tg3Count; i++) serialsToGenerate.push({ tg: 'TG3' });
		for (let i = 0; i < config.tg4Count; i++) serialsToGenerate.push({ tg: 'TG4' });
		serialsToGenerate.sort(() => getNextRandom() - 0.5); // Shuffle the generation order

		const seenSerials = new Set();
		const generatedSerials = [];
        console.log('[DEBUG] Starting generation loop...');

		for (let i = 0; i < totalRequested; i++) {
			if (randomIndex >= randomBuffer.length - RANDOM_SAFETY_MARGIN) await generateRandomNumbersOnGPU(config.gpuBatchSize);
			const item = serialsToGenerate[i];
			let serial = '';
			let innerAttempts = 0;

            if (debugMode && i < 10) console.log(`\n[DEBUG] --- Generating Serial #${i + 1} (Type: ${item.tg}) ---`);

			do {
				const parentTail = randomChoice(selectedRepoTails);
				const protectedStartLength = config.mutableStart;
				let dynamicTargetLength = Math.floor(baseTail.length + config.targetOffset);
				dynamicTargetLength = Math.max(dynamicTargetLength, protectedStartLength);

				let mutatedTail;

				switch (item.tg) {
                    case 'NEW':
                        mutatedTail = generateAppendMutation(baseTail, dynamicTargetLength, protectedStartLength);
                        break;
                    case 'TG1':
                    case 'TG2':
                        mutatedTail = performWindowedCrossover(
							baseTail,
							parentTail,
							dynamicTargetLength,
							protectedStartLength,
							config.minChunkSize,
							config.maxChunkSize,
							config.targetChunkSize,
						);
                        break;
                    case 'TG3':
                        // Start with a crossover base
                        mutatedTail = performWindowedCrossover(
							baseTail,
							parentTail,
							dynamicTargetLength,
							protectedStartLength,
							config.minChunkSize,
							config.maxChunkSize,
							config.targetChunkSize,
						);
                        // Then attempt legendary stacking
                        if (getNextRandom() < legendaryStackingChance && highValueParts.length > 0) {
                            if(debugMode) console.log('[DEBUG] > TG3 Legendary Stacking Triggered!');
                            const part = randomChoice(highValueParts).slice();
                            // Use the final target length for calculation, not the base tail length
                            const availableMutableSpace = dynamicTargetLength - protectedStartLength;
                            if (availableMutableSpace >= part.length) {
                                const numRepeats = Math.floor(availableMutableSpace / part.length);
                                if (numRepeats > 0) {
                                    const repeatedBlock = new Array(numRepeats).fill(part).join('');
                                    // Replace the end of the tail with the repeated block
                                    mutatedTail = mutatedTail.substring(0, dynamicTargetLength - repeatedBlock.length) + repeatedBlock;
                                    if(debugMode) console.log(`[DEBUG]   > Stacked part "${part}" ${numRepeats} times.`);
                                }
                            }
                        }
                        break;
                    case 'TG4':
                        mutatedTail = generateTargetedMutation(baseTail, config.itemType, config.mutableStart, config.mutableEnd);
                        break;
                    default:
                         mutatedTail = generateAppendMutation(baseTail, dynamicTargetLength, protectedStartLength);
                }

				serial = ensureCharset(baseHeader + mutatedTail);
				innerAttempts++;
                if (innerAttempts > 1 && debugMode) console.warn(`[DEBUG] Collision detected. Retrying... (Attempt ${innerAttempts})`);
			} while (seenSerials.has(serial) && innerAttempts < 20);

			if (!seenSerials.has(serial)) {
				seenSerials.add(serial);
				const flagValue = TG_FLAGS[item.tg] || 0;
				generatedSerials.push({
					serial: serial,
					flag: flagValue !== 0 ? 1 : 0,
					state_flag: flagValue,
					slot: generatedSerials.length,
				});
			}
			if (i > 0 && i % 500 === 0)
				self.postMessage({
					type: 'progress',
					payload: { processed: i + 1, total: totalRequested },
				});
		}
        console.log(`[DEBUG] Generation loop finished. Generated ${generatedSerials.length} unique serials.`);


		const fullLines = ['state:', '  inventory:', '    items:', '      backpack:'];
		generatedSerials.forEach((item) => {
			fullLines.push(`        slot_${item.slot}:`);
			fullLines.push(`          serial: '${item.serial}'`);
			if (item.flag === 1) fullLines.push(`          flags: 1`);
			if (item.state_flag !== 0) fullLines.push(`          state_flags: ${item.state_flag}`);
		});
		const fullYaml = fullLines.join('\n');

		const truncatedSerials = generatedSerials.slice(0, 30000);
		const truncatedLines = ['state:', '  inventory:', '    items:', '      backpack:'];
		truncatedSerials.forEach((item) => {
			truncatedLines.push(`        slot_${item.slot}:`);
			truncatedLines.push(`          serial: '${item.serial}'`);
			if (item.flag === 1) truncatedLines.push(`          flags: 1`);
			if (item.state_flag !== 0) truncatedLines.push(`          state_flags: ${item.state_flag}`);
		});
		const truncatedYaml = truncatedLines.join('\n');

		// --- DECOUPLED MESSAGES ---
		// 1. Send YAML data immediately for UI responsiveness
        console.log('[DEBUG] Sending YAML output to main thread.');
		self.postMessage({
			type: 'complete',
			payload: {
				yaml: fullYaml,
				truncatedYaml: truncatedYaml,
				uniqueCount: generatedSerials.length,
				totalRequested: totalRequested,
				validationResult: null,
			},
		});

		// 2. If stats are enabled, calculate and send them in a separate message
		if (config.generateStats && generatedSerials.length > 0) {
            console.log('[DEBUG] Calculating and sending statistics.');
			const serialStrings = generatedSerials.map((s) => s.serial);
			const highValueParts = calculateHighValuePartsStats(serialStrings, config.minPartSize, config.maxPartSize);
			let sortedParts = highValueParts.sort((a, b) => b[1] - a[1]);
			const maxBars = 200;
			if (sortedParts.length > maxBars) {
				sortedParts = sortedParts.slice(0, maxBars);
			}
			const chartData = {
				labels: sortedParts.map((p) => p[0]),
				data: sortedParts.map((p) => p[1]),
			};
			self.postMessage({
				type: 'stats_complete',
				payload: { chartData: chartData },
			});
		}
	} catch (error) {
		console.error('Worker Error:', error);
		self.postMessage({ type: 'error', payload: { message: error.message } });
	}
};
