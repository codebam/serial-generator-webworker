// --- GPU & RANDOMNESS STATE ---
let gpuDevice = null;

export const getGpuDevice = () => gpuDevice;
let randomBuffer = new Float32Array(0);
let randomIndex = 0;

export function needsRandomNumberGeneration(margin) {
    return randomIndex >= randomBuffer.length - margin;
}

export function getNextRandom() {
	if (randomIndex >= randomBuffer.length) {
		console.warn('Random buffer depleted. Consider increasing gpuBatchSize.');
		randomIndex = 0; // Reset to avoid crashing, but this is not ideal
	}
	return randomBuffer[randomIndex++];
}

// --- WebGPU & UTILITY FUNCTIONS ---
export async function setupWebGPU() {
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
export async function generateRandomNumbersOnGPU(count) {
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
