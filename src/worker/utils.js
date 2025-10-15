import { ALPHABET, HEADER_RE } from './constants.js';
import { getNextRandom } from './gpu.js';

export function randomInt(min, max) {
	if (min > max) [min, max] = [max, min];
	return Math.floor(getNextRandom() * (max - min + 1)) + min;
}

export function randomChoice(arr) {
	return arr[Math.floor(getNextRandom() * arr.length)];
}

export function ensureCharset(s) {
	return [...s].filter((c) => ALPHABET.includes(c)).join('');
}

export function splitHeaderTail(serial) {
	const match = serial.match(HEADER_RE);
	if (match) return [match[1], serial.substring(match[0].length)];
	return [serial.substring(0, 10), serial.substring(10)];
}

export function getSerialTail(serial) {
	const match = serial.match(HEADER_RE);
	if (match && match[0]) {
		return serial.substring(match[0].length);
	}
	return serial.substring(10);
}

export function extractHighValueParts(repoTails, minPartSize, maxPartSize) {
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
    if (self.debugMode) console.log(`[DEBUG] Initial frequency map size: ${frequencyMap.size}`);


	let parts = [...frequencyMap.entries()].filter(([, count]) => count > 1).map(([part]) => part);
    if (self.debugMode) console.log(`[DEBUG] Found ${parts.length} repeating parts.`);


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
    if (self.debugMode) console.log('[DEBUG] Top 5 High-Value Parts:', parts.slice(0, 5));


	// 3. Sort by length (longest first) as a final step
	return parts.sort((a, b) => b.length - a.length);
}
