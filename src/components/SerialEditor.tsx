





declare const React: any;

const SerialEditor = () => {
    const [serial, setSerial] = useState<string>('');
    const [analysis, setAnalysis] = useState<{
        type: string;
        manufacturer: string;
        hex: string;
        safeEditStart: number | string;
        safeEditEnd: number | string;
        level: number | string;
        element: string | null;
        bulletType: string | null;
    } | null>(null);
    const [binary, setBinary] = useState<string>('');
    const [modifiedBinary, setModifiedBinary] = useState<string>('');
    const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    const [level, setLevel] = useState<number | null>(null);
    const [levelFoundAt, setLevelFoundAt] = useState<number | null>(null);
    const [element, setElement] = useState<string | null>(null);
    const [elementPattern, setElementPattern] = useState<string | null>(null);
    const [elementFoundAt, setElementFoundAt] = useState<number | null>(null);
    const [bulletType, setBulletType] = useState<string | null>(null);
    const [bulletTypeHex, setBulletTypeHex] = useState<string | null>(null);
    const [bulletTypeFoundAt, setBulletTypeFoundAt] = useState<number | null>(null);


    const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~';
    const ELEMENTAL_PATTERNS = {
        "CORR": "01010000",
        "CRYO": "11010000",
        "FIRE": "00110000",
        "RAD": "10110000",
        "SHOCK": "01110000",
        "KINETIC": "01011010",
        "CORR (alt)": "10101000",
        "CRYO (alt)": "11101000",
        "FIRE (alt)": "10011000",
        "RAD (alt)": "11011000",
        "SHOCK (alt)": "10111000",
    };
    const BULLET_TYPE_PATTERNS = {
        "Jakobs Kinetic": ["2210", "2211"],
        "Jakobs Explosive": ["2212", "2213"],
        "Maliwan Elemental": ["2214", "2215"],
        "Maliwan Cryo": ["2216"],
        "Maliwan Shock": ["2217"],
        "Torgue Explosive": ["2218", "2219"],
        "Torgue Kinetic": ["221a", "221b"],
        "Daedalus Kinetic": ["221c", "221d"],
        "Daedalus Precision": ["221e", "221f"],
        "COV Kinetic": ["2220", "2221"],
        "COV Explosive": ["2222", "2223"],
        "Ripper Kinetic": ["2224", "2225"],
        "Ripper Melee": ["2226", "2227"],
    };
    const MANUFACTURER_PATTERNS = {
        "Jakobs": [
            "2107",
            "2137",
            "2124",
            "2130",
            "21a5",
            "21a4"
        ],
        "Maliwan": [
            "2127",
            "212b",
            "2114",
            "21a5"
        ],
        "Order": [
            "2117",
            "213c",
            "2108",
            "21a4",
            "21a5"
        ],
        "Ripper": [
            "213b",
            "2133",
            "2138",
            "21a4",
            "21a5"
        ],
        "Vladof": [
            "2103",
            "211b",
            "2113",
            "21a5",
            "21a4"
        ],
        "Daedalus": [
            "210b",
            "212c",
            "2104",
            "2110",
            "21a4",
            "21a5",
            "21a0"
        ],
        "Tediore": [
            "211c",
            "2134",
            "2128",
            "21a5",
            "21a4"
        ],
        "Torgue": [
            "2123",
            "210c",
            "2118",
            "21a4",
            "21a5"
        ],
        "Amon": [
            "213f"
        ],
        "Harlowe": [
            "21a5"
        ],
        "Rafa": [
            "21a4"
        ],
        "Vex": [
            "211f"
        ],
        "Atlas": [
            "21a4"
        ],
        "CoV": [
            "21a4"
        ],
        "Hyperion": [
            "21a4"
        ]
    };

    const standardLevelDetection = (binary: string): [number | string, number] => {
        const LEVEL_MARKER = '000000';
        const valid_markers = [];
        for (let i = 0; i < binary.length - 13; i++) {
            if (binary.substring(i, i + 6) === LEVEL_MARKER) {
                const level_bits = binary.substring(i + 6, i + 14);
                const level_value = parseInt(level_bits, 2);
                let decoded_level = null;
                if (level_value === 49) {
                    decoded_level = 1;
                } else if (level_value === 50) {
                    decoded_level = 50;
                } else if (level_value >= 1 && level_value <= 50) {
                    decoded_level = level_value;
                } else if (level_value >= 49 && level_value <= 98) {
                    const actual_level = level_value - 48;
                    if (actual_level >= 1 && actual_level <= 50) {
                        decoded_level = actual_level;
                    }
                }

                if (decoded_level !== null) {
                    valid_markers.push([i, decoded_level, level_value]);
                }
            }
        }

        const level_50_markers = valid_markers.filter(m => m[1] === 50);
        if (level_50_markers.length > 0) return [50, level_50_markers[0][0]];

        const level_49_markers = valid_markers.filter(m => m[1] === 49);
        if (level_49_markers.length > 0) return [49, level_49_markers[0][0]];

        if (valid_markers.length > 0) return [valid_markers[0][1], valid_markers[0][0]];

        return ['Unknown', -1];
    };

    const enhancedLevelDetection = (binary: string): [number | string, number] => {
        const all_candidates = [];

        for (let level = 0; level <= 50; level++) {
            const pattern = level.toString(2).padStart(8, '0');
            for (let i = 0; i < binary.length - 7; i++) {
                if (binary.substring(i, i + 8) === pattern) {
                    const score = 100 - Math.floor(i / 10);
                    all_candidates.push([level, i, score, 'direct']);
                }
            }
        }

        for (let level = 0; level <= 50; level++) {
            const offset_value = level + 48;
            const pattern = offset_value.toString(2).padStart(8, '0');
            for (let i = 0; i < binary.length - 7; i++) {
                if (binary.substring(i, i + 8) === pattern) {
                    const score = 90 - Math.floor(i / 10);
                    all_candidates.push([level, i, score, 'offset']);
                }
            }
        }

        all_candidates.sort((a, b) => b[2] - a[2]);

        const level_50_candidates = all_candidates.filter(c => c[0] === 50);
        if (level_50_candidates.length > 0) return [50, level_50_candidates[0][1]];

        const level_49_candidates = all_candidates.filter(c => c[0] === 49);
        if (level_49_candidates.length > 0) return [49, level_49_candidates[0][1]];
        
        const level_0_candidates = all_candidates.filter(c => c[0] === 0);
        if (level_0_candidates.length > 0 && level_0_candidates[0][2] >= 20) return [0, level_0_candidates[0][1]];

        const level_10_candidates = all_candidates.filter(c => c[0] === 10);
        if (level_10_candidates.length >= 3) return [10, level_10_candidates[0][1]];

        if (all_candidates.length > 0) return [all_candidates[0][0], all_candidates[0][1]];

        return ['Unknown', -1];
    };

    const detectItemLevel = (binary: string): [number | string, number] => {
        const [standard_result, standard_pos] = standardLevelDetection(binary);

        if (standard_result === 50) return [50, standard_pos];
        if (standard_result === 49) return [49, standard_pos];

        const [enhanced_result, enhanced_pos] = enhancedLevelDetection(binary);

        if (enhanced_result === 50) return [50, enhanced_pos];
        if (enhanced_result === 49) return [49, enhanced_pos];

        if (standard_result !== 'Unknown') return [standard_result, standard_pos];

        return [enhanced_result, enhanced_pos];
    };

    const decodeSerial = () => {
        if (!serial.startsWith('@U')) {
            alert('Invalid serial format. It must start with @U');
            return;
        }

        const encoded = serial.substring(2);
        let decoded_bytes = [];
        let current_value = 0;
        let char_count = 0;

        for (let i = 0; i < encoded.length; i++) {
            const char = encoded[i];
            const index = BASE85_ALPHABET.indexOf(char);
            if (index === -1) {
                continue; // Skip invalid characters
            }
            current_value = current_value * 85 + index;
            char_count++;
            if (char_count === 5) {
                decoded_bytes.push((current_value >> 24) & 0xFF);
                decoded_bytes.push((current_value >> 16) & 0xFF);
                decoded_bytes.push((current_value >> 8) & 0xFF);
                decoded_bytes.push(current_value & 0xFF);
                current_value = 0;
                char_count = 0;
            }
        }

        if (char_count > 0) {
            for (let i = char_count; i < 5; i++) {
                current_value = current_value * 85 + 84;
            }
            for (let i = 0; i < char_count - 1; i++) {
                decoded_bytes.push((current_value >> (24 - i * 8)) & 0xFF);
            }
        }

        const mirrored_bytes = decoded_bytes.map(byte => {
            let mirrored = 0;
            for (let j = 0; j < 8; j++) {
                if ((byte >> j) & 1) {
                    mirrored |= 1 << (7 - j);
                }
            }
            return mirrored;
        });

        const hex_data = mirrored_bytes.map(b => b.toString(16).padStart(2, '0')).join('');
        const binary_string = mirrored_bytes.map(b => b.toString(2).padStart(8, '0')).join('');
        
        setBinary(binary_string);
        setModifiedBinary(binary_string);

        // Classification
        let serialType = 'UNKNOWN';
        if (binary_string.startsWith('0010000100')) {
            serialType = 'TYPE A';
        } else if (binary_string.startsWith('0010000110')) {
            serialType = 'TYPE B';
        }

        // Manufacturer
        const first_4_bytes = hex_data.substring(0, 8);
        let manufacturer = 'Unknown';
        for (const [m, patterns] of Object.entries(MANUFACTURER_PATTERNS)) {
            for (const pattern of patterns) {
                if (first_4_bytes.startsWith(pattern)) {
                    manufacturer = m;
                    break;
                }
            }
            if (manufacturer !== 'Unknown') break;
        }
        
        const safeEditStart = serial.indexOf('u~Q') + 3;
        const safeEditEnd = serial.length - 12;

        const safeStartBits = 32;
        const safeEndBits = binary_string.length - 24;
        setSelection({ start: safeStartBits, end: safeEndBits });

        const [detectedLevel, levelPos] = detectItemLevel(binary_string);
        setLevel(detectedLevel);
        setLevelFoundAt(levelPos);

        // Elemental Pattern Detection (Binary)
        let foundElement: string | null = null;
        let foundElementPattern: string | null = null;
        let foundElementIndex: number | null = null;
        for (const [element, pattern] of Object.entries(ELEMENTAL_PATTERNS)) {
            const index = binary_string.indexOf(pattern);
            if (index !== -1) {
                foundElement = element;
                foundElementPattern = pattern;
                foundElementIndex = index;
                break;
            }
        }
        setElement(foundElement);
        setElementPattern(foundElementPattern);
        setElementFoundAt(foundElementIndex);

        // Bullet Type Pattern Detection (Hex)
        let foundBulletType: string | null = null;
        let foundBulletHex: string | null = null;
        let foundBulletIndex: number | null = null;
        for (const [type, patterns] of Object.entries(BULLET_TYPE_PATTERNS)) {
            for (const pattern of patterns) {
                const index = hex_data.indexOf(pattern);
                if (index !== -1) {
                    foundBulletType = type;
                    foundBulletHex = pattern;
                    foundBulletIndex = index;
                    break;
                }
            }
            if (foundBulletType) break;
        }
        setBulletType(foundBulletType);
        setBulletTypeHex(foundBulletHex);
        setBulletTypeFoundAt(foundBulletIndex);

        setAnalysis({
            type: serialType,
            manufacturer: manufacturer,
            hex: hex_data,
            safeEditStart: safeEditStart > 2 ? safeEditStart : 'N/A',
            safeEditEnd: safeEditEnd > safeEditStart ? safeEditEnd : 'N/A',
            level: detectedLevel,
            element: foundElement,
            bulletType: foundBulletType,
        });
    };

    const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newLevel = parseInt(e.target.value, 10);
        if (isNaN(newLevel) || newLevel < 0 || newLevel > 50) {
            return;
        }
        setLevel(newLevel);

        if (analysis && analysis.level !== 'Unknown' && levelFoundAt !== -1) {
            let newLevelValue;
            if (newLevel === 1) {
                newLevelValue = 49;
            } else if (newLevel === 50) {
                newLevelValue = 50;
            } else {
                newLevelValue = newLevel;
            }

            const levelPattern = newLevelValue.toString(2).padStart(8, '0');
            
            let startPos = -1;
            if (analysis.type === 'TYPE A') {
                startPos = 10; // As per KNOWLEDGE.md for varint5, but we are using 8bit for now.
            } else if (analysis.type === 'TYPE B') {
                startPos = 15; // As per KNOWLEDGE.md
            }

            // Fallback to detected position if type-based position is not helpful
            if(levelFoundAt !== -1) {
                // if standard marker was found, the level bits start after the 6-bit marker
                const LEVEL_MARKER = '000000';
                if(modifiedBinary.substring(levelFoundAt, levelFoundAt + 6) === LEVEL_MARKER) {
                    startPos = levelFoundAt + 6;
                } else {
                    startPos = levelFoundAt;
                }
            }

            if (startPos !== -1) {
                const prefix = modifiedBinary.substring(0, startPos);
                const suffix = modifiedBinary.substring(startPos + 8);
                setModifiedBinary(prefix + levelPattern + suffix);
            }
        }
    };

    const handleBulletTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBulletType = e.target.value;
        const newHex = BULLET_TYPE_PATTERNS[newBulletType][0];

        if (bulletTypeFoundAt !== null) {
            const newBinary = hexToBinary(newHex);
            const start = bulletTypeFoundAt * 4;
            const end = start + 16;
            const prefix = modifiedBinary.substring(0, start);
            const suffix = modifiedBinary.substring(end);
            setModifiedBinary(prefix + newBinary + suffix);
            setBulletType(newBulletType);
            setBulletTypeHex(newHex);
        }
    };

    const handleElementChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newElement = e.target.value;
        const newPattern = ELEMENTAL_PATTERNS[newElement];

        if (elementFoundAt !== null) {
            const prefix = modifiedBinary.substring(0, elementFoundAt);
            const suffix = modifiedBinary.substring(elementFoundAt + 8);
            setModifiedBinary(prefix + newPattern + suffix);
            setElement(newElement);
            setElementPattern(newPattern);
        }
    };

    const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSelection(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    };

    const modifyBits = (modification: string) => {
        const { start, end } = selection;
        if (start > end) {
            alert('Start index cannot be greater than end index.');
            return;
        }
        const prefix = modifiedBinary.substring(0, start);
        const suffix = modifiedBinary.substring(end);
        const selectedBits = modifiedBinary.substring(start, end);
        let newBits = '';
        switch (modification) {
            case 'zero':
                newBits = '0'.repeat(selectedBits.length);
                break;
            case 'one':
                newBits = '1'.repeat(selectedBits.length);
                break;
            case 'invert':
                newBits = selectedBits.split('').map(bit => (bit === '0' ? '1' : '0')).join('');
                break;
            case 'random':
                newBits = Array.from({ length: selectedBits.length }, () => Math.round(Math.random())).join('');
                break;
            default:
                newBits = selectedBits;
        }
        setModifiedBinary(prefix + newBits + suffix);
    };

    const hexToBinary = (hex: string): string => {
        return hex.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    };

    const [newSerial, setNewSerial] = useState('');
    const [modifiedBase85, setModifiedBase85] = useState('');

    const encodeSerial = (binaryData: string): string => {
        const bytes = [];
        for (let i = 0; i < binaryData.length; i += 8) {
            const byteString = binaryData.substring(i, i + 8);
            if (byteString.length < 8) continue;
            bytes.push(parseInt(byteString, 2));
        }

        const unmirrored_bytes = bytes.map(byte => {
            let unmirrored = 0;
            for (let j = 0; j < 8; j++) {
                if ((byte >> j) & 1) {
                    unmirrored |= 1 << (7 - j);
                }
            }
            return unmirrored;
        });

        let encoded = '';
        const num_full_chunks = Math.floor(unmirrored_bytes.length / 4);

        for (let i = 0; i < num_full_chunks; i++) {
            const chunk = unmirrored_bytes.slice(i * 4, i * 4 + 4);
            let value = ((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0;

            let block = '';
            for (let j = 0; j < 5; j++) {
                block = BASE85_ALPHABET[value % 85] + block;
                value = Math.floor(value / 85);
            }
            encoded += block;
        }

        const last_chunk_bytes = unmirrored_bytes.slice(num_full_chunks * 4);
        if (last_chunk_bytes.length > 0) {
            const padding_size = 4 - last_chunk_bytes.length;
            while (last_chunk_bytes.length < 4) {
                last_chunk_bytes.push(0);
            }
            let value = ((last_chunk_bytes[0] << 24) | (last_chunk_bytes[1] << 16) | (last_chunk_bytes[2] << 8) | last_chunk_bytes[3]) >>> 0;

            let block = '';
            for (let j = 0; j < 5; j++) {
                block = BASE85_ALPHABET[value % 85] + block;
                value = Math.floor(value / 85);
            }
            encoded += block.substring(0, 5 - padding_size);
        }
        
        return '@U' + encoded;
    };

    useEffect(() => {
        if (modifiedBinary) {
            const newBase85 = encodeSerial(modifiedBinary);
            setModifiedBase85(newBase85);
        }
    }, [modifiedBinary]);

    const inputClasses = 'w-full p-3 bg-gray-900 text-gray-200 border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm';
    const btnClasses = {
        primary: 'py-3 px-4 w-full font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed',
        secondary: 'py-2 px-4 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-all',
    };

    return (
        <Accordion title="🔧 Serial Editor" open={true}>
            <FormGroup label="Serial to Analyze">
                <textarea
                    className={`${inputClasses} min-h-[80px]`}
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="Paste serial here..."
                ></textarea>
            </FormGroup>
            <button onClick={decodeSerial} className={btnClasses.primary}>Analyze</button>
            {analysis && (
                <div className="flex flex-col gap-2 mt-4">
                    <h3 className="text-lg font-semibold">Analysis Results</h3>
                    <p><strong>Type:</strong> {analysis.type}</p>
                    <p><strong>Manufacturer:</strong> {analysis.manufacturer}</p>
                    <p><strong>Level:</strong> {analysis.level}</p>
                    {analysis.element && <p><strong>Element:</strong> {analysis.element}</p>}
                    {analysis.bulletType && <p><strong>Bullet Type:</strong> {analysis.bulletType}</p>}
                    <p><strong>Hex:</strong> <span className="font-mono text-xs break-all">
                        {bulletTypeFoundAt !== null && analysis.hex ? (
                            <>
                                {analysis.hex.substring(0, bulletTypeFoundAt)}
                                <span className="bg-green-900 text-green-300">{analysis.hex.substring(bulletTypeFoundAt, bulletTypeFoundAt + 4)}</span>
                                {analysis.hex.substring(bulletTypeFoundAt + 4)}
                            </>
                        ) : analysis.hex}
                    </span></p>
                    <p><strong>Safe Edit Start (after u~Q):</strong> {analysis.safeEditStart}</p>
                    <p><strong>Safe Edit End (preserve trailer):</strong> {analysis.safeEditEnd}</p>
                    
                    <h3 className="text-lg font-semibold mt-2">Level Editor</h3>
                    <FormGroup label="Item Level (0-50)">
                        <input type="number" value={level} onChange={handleLevelChange} className={inputClasses} min="0" max="50" />
                    </FormGroup>

                    {element && (
                        <>
                            <h3 className="text-lg font-semibold mt-2">Element Editor</h3>
                            <FormGroup label="Element">
                                <select value={element} onChange={handleElementChange} className={inputClasses}>
                                    {Object.keys(ELEMENTAL_PATTERNS).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </FormGroup>
                        </>
                    )}

                    {bulletType && (
                        <>
                            <h3 className="text-lg font-semibold mt-2">Bullet Type Editor</h3>
                            <FormGroup label="Bullet Type">
                                <select value={bulletType} onChange={handleBulletTypeChange} className={inputClasses}>
                                    {Object.keys(BULLET_TYPE_PATTERNS).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </FormGroup>
                        </>
                    )}

                    <h3 className="text-lg font-semibold mt-2">Binary Data Editor</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormGroup label="Start Index">
                            <input type="number" name="start" value={selection.start} onChange={handleSelectionChange} className={inputClasses} />
                        </FormGroup>
                        <FormGroup label="End Index">
                            <input type="number" name="end" value={selection.end} onChange={handleSelectionChange} className={inputClasses} />
                        </FormGroup>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        <button onClick={() => modifyBits('zero')} className={btnClasses.secondary}>Set to 0</button>
                        <button onClick={() => modifyBits('one')} className={btnClasses.secondary}>Set to 1</button>
                        <button onClick={() => modifyBits('invert')} className={btnClasses.secondary}>Invert</button>
                        <button onClick={() => modifyBits('random')} className={btnClasses.secondary}>Randomize</button>
                    </div>
                    <h3 className="text-lg font-semibold mt-2">Modified Binary Data</h3>
                    <div className="font-mono text-xs p-3 bg-gray-900 border border-gray-700 rounded-md break-all">
                        {elementFoundAt !== null ? (
                            <>
                                {modifiedBinary.substring(0, elementFoundAt)}
                                <span className="bg-purple-900 text-purple-300">{modifiedBinary.substring(elementFoundAt, elementFoundAt + 8)}</span>
                                {modifiedBinary.substring(elementFoundAt + 8)}
                            </>
                        ) : (
                            <>
                                <span>{modifiedBinary.substring(0, selection.start)}</span>
                                <span className="bg-blue-900 text-blue-300">{modifiedBinary.substring(selection.start, selection.end)}</span>
                                <span>{modifiedBinary.substring(selection.end)}</span>
                            </>
                        )}
                    </div>
                    {modifiedBase85 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold">Modified Base85 Data</h3>
                            <textarea className={`${inputClasses} h-24`} readOnly value={modifiedBase85}></textarea>
                        </div>
                    )}
                </div>
            )}
        </Accordion>
    );
};