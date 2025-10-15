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

	// 1. Build a suffix array for all tails combined
	const text = tails.join('\0'); // Use a null character to separate tails
	const suffixArray = [];
	for (let i = 0; i < text.length; i++) {
		suffixArray.push(i);
	}
	suffixArray.sort((a, b) => {
		const subA = text.substring(a);
		const subB = text.substring(b);
		return subA.localeCompare(subB);
	});

	// 2. Calculate the Longest Common Prefix (LCP) array
	const lcpArray = new Array(suffixArray.length).fill(0);
	for (let i = 1; i < suffixArray.length; i++) {
		const s1 = text.substring(suffixArray[i - 1]);
		const s2 = text.substring(suffixArray[i]);
		let j = 0;
		while (j < s1.length && j < s2.length && s1[j] === s2[j]) {
			j++;
		}
		lcpArray[i] = j;
	}

	// 3. Find frequent substrings using the LCP array
	for (let i = 0; i < suffixArray.length; i++) {
		let minLCP = Infinity;
		for (let j = i + 1; j < suffixArray.length; j++) {
			minLCP = Math.min(minLCP, lcpArray[j]);
			const commonPrefixLength = minLCP;
							if (commonPrefixLength >= minPartSize) {
								const substring = text.substring(suffixArray[i], suffixArray[i] + commonPrefixLength);
								const groupSize = j - i + 1;
								for (let k = minPartSize; k <= Math.min(maxPartSize, substring.length); k++) {
									const part = substring.substring(0, k);
									frequencyMap.set(part, (frequencyMap.get(part) || 0) + groupSize);
								}
							} else {
								break; // Optimization: LCP will only decrease from here
							}		}
		if (onProgress) {
			onProgress(((i + 1) / suffixArray.length) * 100);
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