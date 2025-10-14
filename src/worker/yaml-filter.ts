import { ALPHABET } from './constants.js';

interface FilterSerialsResult {
    validationResult: string;
    validatedYaml: string;
    validatedSerials?: string[];
}

export function filterSerials(yaml: string, seed: string, validationChars: number): FilterSerialsResult {
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
