import { getSerialTail } from './utils.js';

// --- STATS FUNCTIONS (MOVED FROM UI) ---

/**
 * Finds the most frequent substrings in a set of serials.
 * This implementation uses a suffix-array-based approach, which is more efficient
 * for large datasets than the previous brute-force method.
 *
 * @param {string[]} serials - A list of serial numbers.
 * @param {number} minPartSize - The minimum length of substrings to consider.
 * @param {number} maxPartSize - The maximum length of substrings to consider.
 * @param {function(number): void} onProgress - A callback to report progress.
 * @returns {[string, number][]} - A list of [substring, frequency] pairs.
 */
export function calculateHighValuePartsStats(serials, minPartSize, maxPartSize, onProgress) {
	if (onProgress) onProgress(0);

	const tails = serials.map(getSerialTail).filter(Boolean);
	const frequencyMap = new Map();
	const totalSerials = tails.length;

	for (let i = 0; i < totalSerials; i++) {
		const tail = tails[i];
		const seenSubstrings = new Set();
		for (let len = minPartSize; len <= maxPartSize; len++) {
			for (let j = 0; j <= tail.length - len; j++) {
				const substring = tail.substring(j, j + len);
				seenSubstrings.add(substring);
			}
		}
		for (const substring of seenSubstrings) {
			frequencyMap.set(substring, (frequencyMap.get(substring) || 0) + 1);
		}
		if (onProgress) {
			onProgress(((i + 1) / totalSerials) * 100);
		}
	}

	// 4. Filter and consolidate the results
	let parts = [...frequencyMap.entries()]
		.filter(([, count]) => count > 1)
		.map(([part]) => part);

	let changed = true;
	while (changed) {
		changed = false;
		const consolidated = new Set();
		parts.sort((a, b) => b.length - a.length);

		for (const part of parts) {
			let isContained = false;
			for (const biggerPart of consolidated) {
				if (biggerPart.includes(part)) {
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

	const finalParts = new Map();
	for (const part of parts) {
		finalParts.set(part, frequencyMap.get(part));
	}

	if (onProgress) onProgress(100);

	return [...finalParts.entries()];
}