// --- WORKER SCRIPT (generator.worker.js) ---
// REFACTORED: TG1-TG4 mutations now represent a clear ladder of intensity.
// TG1: Character Flip (Low Intensity)
// TG2: Segment Reversal (Medium Intensity)
// TG3: High-Value Part Swap / Stacking (High Intensity)
// TG4: Repository Crossover (Very High Intensity)
// This refactoring was done by an AI assistant based on user feedback.

// --- CONSTANTS ---
const DEFAULT_SEED = '@Uge8pzm/)}}!t8IjFw;$d;-DH;sYyj@*ifd*pw6Jyw*U';
const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~';
const ALLOWED_EXTRA = '/';
const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
const HEADER_RE = /^(@U[^!]*!)/;
const TG_FLAGS = { NEW: 0, TG1: 17, TG2: 33, TG3: 65, TG4: 129 };
const RANDOM_SAFETY_MARGIN = 2000;

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


// --- REFACTORED MUTATION ALGORITHMS (Intensity Ladder) ---

// NEW: Append-Only
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

// TG1: Targeted Character Flip (Low Intensity)
function generateCharacterFlipMutation(baseTail, mutableStart, mutableEnd) {
    if (debugMode) console.log(`[DEBUG] > TG1: Character Flip | range: ${mutableStart}-${mutableEnd}`);
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
    if (debugMode) console.log(`[DEBUG]   > Flipped ${flipCount} characters.`);
    return chars.join('');
}

// TG2: Segment Reversal (Medium Intensity)
function generateSegmentReversalMutation(baseTail, mutableStart, mutableEnd, minChunk, maxChunk) {
    if (debugMode) console.log(`[DEBUG] > TG2: Segment Reversal | range: ${mutableStart}-${mutableEnd}`);
    if (mutableEnd - mutableStart < minChunk) {
        if (debugMode) console.log(`[DEBUG]   > Mutable range too small for reversal. Skipping.`);
        return baseTail;
    }
    
    const chunkSize = randomInt(minChunk, Math.min(maxChunk, mutableEnd - mutableStart));
    const start = randomInt(mutableStart, mutableEnd - chunkSize);
    
    const prefix = baseTail.substring(0, start);
    const segment = baseTail.substring(start, start + chunkSize);
    const suffix = baseTail.substring(start + chunkSize);
    
    const reversedSegment = [...segment].reverse().join('');
    if (debugMode) console.log(`[DEBUG]   > Reversed segment "${segment}" to "${reversedSegment}" at index ${start}.`);
    
    return prefix + reversedSegment + suffix;
}

// TG3: High-Value Part Manipulation (High Intensity)
function generatePartManipulationMutation(baseTail, parentTail, highValueParts, legendaryChance, mutableStart, mutableEnd, finalLength) {
    if (debugMode) console.log(`[DEBUG] > TG3: Part Manipulation | range: ${mutableStart}-${mutableEnd}`);

    // Behavior 2: Part Stacking (if no mutable range)
    if (mutableStart === mutableEnd) {
        if (getNextRandom() < legendaryChance && highValueParts.length > 0) {
            if (debugMode) console.log('[DEBUG]   > Part Stacking triggered!');
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
                    if (debugMode) console.log(`[DEBUG]     > Stacked part "${part}" ${numRepeats} times.`);
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
            if (debugMode) console.log(`[DEBUG]   > Part Swap: Swapping in "${partToInject}" at index ${start}.`);
            return prefix + partToInject + suffix;
        }
    }
    
    // Fallback if no suitable part is found for swapping: do a simple crossover in the mutable range
    if (debugMode) console.log(`[DEBUG]   > Part Swap failed, falling back to crossover.`);
    const prefix = baseTail.substring(0, mutableStart);
    const crossoverChunk = parentTail.substring(0, mutableEnd - mutableStart);
    const suffix = baseTail.substring(mutableEnd);
    return prefix + crossoverChunk + suffix;
}

// TG4: Repository Crossover (Very High Intensity)
function generateRepositoryCrossoverMutation(baseTail, parentTail, mutableStart, mutableEnd) {
    if (debugMode) console.log(`[DEBUG] > TG4: Repository Crossover | range: ${mutableStart}-${mutableEnd}`);
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

    if (debugMode) console.log(`[DEBUG]   > Overwriting range ${mutableStart}-${mutableEnd} with chunk from parent.`);
    return prefix + crossoverChunk + baseTail.substring(mutableEnd);
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
		console.log(`[DEBUG] Seed parsed into Header: "${baseHeader}" and Tail: "${baseTail.substring(0, 20)}"... (length: ${baseTail.length})`);

		const repository = config.repository || '';
		const selectedRepoTails = repository
			.split(/[\s\n]+/)
			.filter((s) => s.startsWith('@U'))
			.map((s) => splitHeaderTail(s)[1]);
		if (selectedRepoTails.length === 0) {
			console.log('[DEBUG] No repository tails found, using base seed tail as parent.');
			selectedRepoTails.push(baseTail);
		} else {
			console.log(`[DEBUG] Loaded ${selectedRepoTails.length} tails from the repository.`);
		}

		const highValueParts = extractHighValueParts(selectedRepoTails, config.minPartSize, config.maxPartSize);
		const legendaryStackingChance = config.legendaryChance / 100.0;

		const shuffleArray = (array) => {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(getNextRandom() * (i + 1));
				[array[i], array[j]] = [array[j], array[i]];
			}
		};

		const serialsToGenerate = [];
		for (let i = 0; i < config.newCount; i++) serialsToGenerate.push({ tg: 'NEW' });
		for (let i = 0; i < config.tg1Count; i++) serialsToGenerate.push({ tg: 'TG1' });
		for (let i = 0; i < config.tg2Count; i++) serialsToGenerate.push({ tg: 'TG2' });
		for (let i = 0; i < config.tg3Count; i++) serialsToGenerate.push({ tg: 'TG3' });
		for (let i = 0; i < config.tg4Count; i++) serialsToGenerate.push({ tg: 'TG4' });
		shuffleArray(serialsToGenerate); // Shuffle the generation order

		const seenSerials = new Set();
		const generatedSerials = [];
		console.log('[DEBUG] Starting generation loop...');

		const headerLength = baseHeader.length;
		const adjustedMutableStart = Math.max(0, config.mutableStart - headerLength);
		const adjustedMutableEnd = Math.max(0, config.mutableEnd - headerLength);

		for (let i = 0; i < totalRequested; i++) {
			if (randomIndex >= randomBuffer.length - RANDOM_SAFETY_MARGIN) await generateRandomNumbersOnGPU(config.gpuBatchSize);

			const item = serialsToGenerate[i];
			let serial = '';
			let innerAttempts = 0;
			let mutatedTail;

			if (debugMode && i < 10) console.log(`\n[DEBUG] --- Generating Serial #${i + 1} (Type: ${item.tg}) ---`);

			do {
				const parentTail = randomChoice(selectedRepoTails);
				const protectedStartLength = adjustedMutableStart;
				let dynamicTargetLength = Math.floor(baseTail.length + config.targetOffset);
				dynamicTargetLength = Math.max(dynamicTargetLength, protectedStartLength);

				switch (item.tg) {
					case 'NEW':
						mutatedTail = generateAppendMutation(baseTail, dynamicTargetLength, protectedStartLength);
						break;
					case 'TG1':
						mutatedTail = generateCharacterFlipMutation(baseTail, adjustedMutableStart, adjustedMutableEnd);
						break;
					case 'TG2':
						mutatedTail = generateSegmentReversalMutation(
                            baseTail, 
                            adjustedMutableStart, 
                            adjustedMutableEnd, 
                            config.minChunkSize, 
                            config.maxChunkSize
                        );
						break;
					case 'TG3':
						mutatedTail = generatePartManipulationMutation(
                            baseTail,
                            parentTail,
                            highValueParts,
                            legendaryStackingChance,
                            adjustedMutableStart,
                            adjustedMutableEnd,
                            dynamicTargetLength
                        );
						break;
					case 'TG4':
						mutatedTail = generateRepositoryCrossoverMutation(
                            baseTail,
                            parentTail,
                            adjustedMutableStart,
                            adjustedMutableEnd
                        );
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