import { HEADER_RE } from './constants.js';

const STAT_SERIAL_LIMIT = 5000; // Limit the number of serials for stats calculation

// --- STATS FUNCTIONS (MOVED FROM UI) ---
export function getSerialTail(serial) {
	const match = serial.match(HEADER_RE);
	if (match && match[0]) {
		return serial.substring(match[0].length);
	}
	return serial.substring(10);
}

export function calculateHighValuePartsStats(serials, minPartSize, maxPartSize, onProgress) {
    if (onProgress) onProgress(0); // Reset progress
	const frequencyMap = new Map();
    const limitedSerials = serials.slice(0, STAT_SERIAL_LIMIT);
	const tails = limitedSerials.map(getSerialTail).filter((t) => t);
    const totalSteps = maxPartSize - minPartSize + 1;

	// 1. Find all repeating substrings
	for (let size = minPartSize; size <= maxPartSize; size++) {
		for (const tail of tails) {
			if (tail.length < size) continue;
			for (let i = 0; i <= tail.length - size; i++) {
				const fragment = tail.substring(i, i + size);
				frequencyMap.set(fragment, (frequencyMap.get(fragment) || 0) + 1);
			}
		}
        if (onProgress) {
            const progress = ((size - minPartSize + 1) / totalSteps) * 100;
            onProgress(progress);
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

    if (onProgress) onProgress(100); // Final progress update

	return [...finalParts.entries()];
}
