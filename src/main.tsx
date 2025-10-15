/// <reference types="https://cdn.jsdelivr.net/npm/chart.js@latest/dist/chart.umd.min.js" />
declare const React: any;
declare const ReactDOM: any;

interface AppState {
    repository: string;
    seed: string;
    itemType: string;
    counts: {
        new: number;
        tg1: number;
        tg2: number;
        tg3: number;
        tg4: number;
    };
    rules: {
        targetOffset: number;
        mutableStart: number;
        mutableEnd: number;
        minChunk: number;
        maxChunk: number;
        targetChunk: number;
        minPart: number;
        maxPart: number;
        legendaryChance: number;
    };
    validationChars: number;
    generateStats: boolean;
    debugMode: boolean;
}
const App = () => {
    const defaultState = {
        repository: '',
        seed: '@Uge9B?m/)}}!ffxLNwtrrhUgJFvP19)9>F7c1drg69->2ZNDt8=I>e4x5g)=u;D`>fBRx?3?tmf{sYpdCQjv<(7NJN*DpHY(R3rc',
        itemType: 'GUN', // <-- NEW: Default item type
        counts: { new: 10000, tg1: 0, tg2: 0, tg3: 0, tg4: 0 },
        rules: {
            targetOffset: 200,
            mutableStart: 13,
            mutableEnd: 13,
            minChunk: 3,
            maxChunk: 7,
            targetChunk: 5,
            minPart: 4,
            maxPart: 8,
            legendaryChance: 100,
        },
        validationChars: 12,
        generateStats: false,
        debugMode: false,
    };
    const [state, setState] = useState<AppState>(() => {
        // --- MODIFIED STATE INITIALIZATION ---
        // This robustly merges saved state with defaults to prevent uncontrolled component warnings.
        const savedStateJSON = localStorage.getItem('serialGenState');
        if (savedStateJSON) {
            try {
                const savedState = JSON.parse(savedStateJSON);
                // Deep merge to ensure all keys from defaultState are present
                return {
                    ...defaultState,
                    ...savedState,
                    counts: {
                        ...defaultState.counts,
                        ...(savedState.counts || {}),
                    },
                    rules: {
                        ...defaultState.rules,
                        ...(savedState.rules || {}),
                    },
                };
            } catch (error) {
                console.error('Failed to parse saved state from localStorage:', error);
                return defaultState; // Fallback to defaults if parsing fails
            }
        }
        return defaultState;
        // --- END MODIFIED STATE INITIALIZATION ---
    });
    const [statusMessage, setStatusMessage] = useState<string>('Ready to generate.');
    const [validationResult, setValidationResult] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [outputYaml, setOutputYaml] = useState<string>('');
    const [fullYaml, setFullYaml] = useState<string>('');
    const [filteredYaml, setFilteredYaml] = useState<string>('');
    const [liveMerge, setLiveMerge] = useState<boolean>(false);
    const [baseYaml, setBaseYaml] = useState<string>('');
    const [isMerging, setIsMerging] = useState<boolean>(false);

    const truncate = (str: string, maxLines = 50): string => {
        if (!str) return '';
        const lines = str.split('\n');
        if (lines.length > maxLines) {
            return lines.slice(0, maxLines).join('\n') + `\n\n... and ${lines.length - maxLines} more lines`;
        }
        return str;
    };
    const [searchTerm, setSearchTerm] = useState<string>('');
    const workerRef = useRef(null);
    const chartRef = useRef(null);
    const searchSerials = async () => {
        if (!searchTerm) return;
        setStatusMessage('Searching...');
        try {
            const response = await fetch(`https://kamer-tuintje.be/BL4/BSE/api.php?search=${encodeURIComponent(searchTerm)}&action=records&sort_by=id&sort_order=ASC`);
            const data = await response.json();
            const serials = data.map(item => item.serial).join('\n');
            setState(prev => ({ ...prev, repository: prev.repository ? `${prev.repository}\n${serials}` : serials }));
            setStatusMessage(`Found ${data.length} serials.`);
        } catch (error) {
            console.error('Failed to search serials:', error);
            setStatusMessage('❌ ERROR: Failed to search serials.');
        }
    };
    const updateChart = React.useCallback((chartData: { labels: string[]; data: number[] }) => {
        if (!chartData) return;
        const { labels, data } = chartData;
        const container = document.getElementById('chartContainer');
        if (container) {
            const numBars = labels.length;
            const defaultBars = 10;
            if (numBars > defaultBars) {
                const barWidth = 50; // pixels
                container.style.width = `${numBars * barWidth}px`;
            } else {
                container.style.width = '100%';
            }
        }
        const ctx = document.getElementById('statsChart').getContext('2d');
        if (chartRef.current) {
            chartRef.current.destroy();
        }
        chartRef.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Legendary Part Distribution',
                        data: data,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });
    }, []);
    useEffect(() => {
        localStorage.setItem('serialGenState', JSON.stringify(state));
    }, [state]);

    useEffect(() => {
        const worker = new Worker('./src/worker/worker.js', { type: 'module' });
        workerRef.current = worker;

        const handleMessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            switch (type) {
                case 'progress':
                    const newProgress = (payload.processed / payload.total) * 100;
                    setProgress(newProgress);
                    if (payload.stage === 'stats') {
                        setStatusMessage(`Generating Statistics... ${Math.round(newProgress)}%`);
                    } else {
                        setStatusMessage(`Generating... ${payload.processed.toLocaleString()} / ${payload.total.toLocaleString()}`);
                    }
                    break;
                case 'stats_complete':
                    if (payload.chartData) {
                        updateChart(payload.chartData);
                    }
                    break;
                case 'complete':
                    if (payload.validationResult) {
                        setValidationResult(payload.validationResult);
                        setFilteredYaml(payload.validatedYaml || '');
                        const filteredCount = payload.validatedYaml ? (payload.validatedYaml.match(/serial:/g) || []).length : 0;
                        setStatusMessage(`Filtering complete.\nCopy/Download will use the ${filteredCount} filtered serials.`);
                        setOutputYaml(truncate(payload.validatedYaml || ''));
                        if (payload.chartData) {
                            updateChart(payload.chartData);
                        }
                    } else {
                        setIsGenerating(false);
                        setOutputYaml(payload.truncatedYaml);
                        setFullYaml(payload.yaml);
                        setFilteredYaml('');
                        setValidationResult('');
                        setStatusMessage(`✅ Complete! ${payload.uniqueCount.toLocaleString()} unique serials generated.`);
                    }
                    break;
                case 'error':
                    setIsGenerating(false);
                    setStatusMessage(`❌ ERROR: ${payload.message}`);
                    break;
            }
        };

        worker.onmessage = handleMessage;

        return () => {
            worker.terminate();
        };
    }, [updateChart]);

    useEffect(() => {
        if (liveMerge && baseYaml && fullYaml && !isMerging) {
            mergeYAML(baseYaml);
        }
    }, [fullYaml, liveMerge, baseYaml, isMerging]);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target;
        // Handle checkboxes
        if (type === 'checkbox') {
            const [category, key] = name.split('.');
            if (key) {
                setState((prev) => ({ ...prev, [category]: { ...prev[category], [key]: checked } }));
            } else {
                setState((prev) => ({ ...prev, [name]: checked }));
            }
            return;
        }
        // Handle number and text inputs
        if (type === 'number' && value !== '' && isNaN(parseInt(value, 10))) {
            return; // Don't update state for invalid number input
        }
        const val = type === 'number' && value !== '' ? parseInt(value, 10) : value;
        const [category, key] = name.split('.');
        if (key) {
            setState((prev) => ({ ...prev, [category]: { ...prev[category], [key]: val } }));
        } else {
            setState((prev) => ({ ...prev, [name]: val }));
        }
    };
    const handleRepoEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
        setState((prev) => ({ ...prev, repository: e.target.value }));
    const handleSeedEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newSeed = e.target.value;
        setState((prev) => ({
            ...prev, 
            seed: newSeed,
        }));
    };
    const startGeneration = () => {
        setIsGenerating(true);
        setStatusMessage('Sending job...');
        setProgress(0);
        setValidationResult('');
        setFilteredYaml('');
        const config = {
            seed: state.seed,
            itemType: state.itemType, // <-- NEW: Pass item type to worker
            repository: state.repository,
            newCount: parseInt(state.counts.new || '0', 10),
            tg1Count: parseInt(state.counts.tg1 || '0', 10),
            tg2Count: parseInt(state.counts.tg2 || '0', 10),
            tg3Count: parseInt(state.counts.tg3 || '0', 10),
            tg4Count: parseInt(state.counts.tg4 || '0', 10),
            minChunkSize: parseInt(state.rules.minChunk || '0', 10),
            maxChunkSize: parseInt(state.rules.maxChunk || '0', 10),
            targetChunkSize: parseInt(state.rules.targetChunk || '0', 10),
            targetOffset: parseInt(state.rules.targetOffset || '0', 10),
            minPartSize: parseInt(state.rules.minPart || '0', 10),
            maxPartSize: parseInt(state.rules.maxPart || '0', 10),
            legendaryChance: parseInt(state.rules.legendaryChance || '0', 10),
            mutableStart: parseInt(state.rules.mutableStart || '0', 10),
            mutableEnd: parseInt(state.rules.mutableEnd || '0', 10),
            gpuBatchSize: 250000,
            generateStats: state.generateStats,
            debugMode: state.debugMode,
        };
        workerRef.current.postMessage({ type: 'generate', payload: config });
    };
    const resetForm = () => {
        if (confirm('Are you sure you want to reset all settings to their original defaults?')) {
            setState(defaultState);
            setOutputYaml('');
            setFullYaml('');
            setFilteredYaml('');
            setValidationResult('');
            setStatusMessage('Settings have been reset to original defaults.');
            localStorage.removeItem('serialGenState'); // Clear storage on reset
        }
    };
    const [copyText, setCopyText] = useState('Copy');
    const copyToClipboard = async () => {
        const contentToCopy = filteredYaml || fullYaml;
        if (contentToCopy) {
            await navigator.clipboard.writeText(contentToCopy);
            setCopyText('Copied!');
            setTimeout(() => setCopyText('Copy'), 2000);
        }
    };
    const downloadYAML = () => {
        const contentToDownload = filteredYaml || fullYaml;
        if (!contentToDownload) return;
        const blob = new Blob([contentToDownload], { type: 'text/yaml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'merged_serials.yaml';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const mergeYAML = (baseYamlString) => {
        if (!baseYamlString) {
            setStatusMessage('❌ ERROR: No base YAML selected.');
            return;
        }
        setIsMerging(true);
        setStatusMessage('Merging YAML...');
        try {
            const importedYaml = jsyaml.load(baseYamlString);
            let generatedSerialsYaml;
            try {
                generatedSerialsYaml = jsyaml.load(fullYaml);
            } catch (e) {
                generatedSerialsYaml = jsyaml.load('---' + fullYaml);
            }
            const findAndReplaceBackpack = (targetObject, backpackData) => {
                for (const key in targetObject) {
                    if (key === 'backpack') {
                        targetObject[key] = backpackData;
                        return true;
                    }
                    if (typeof targetObject[key] === 'object' && targetObject[key] !== null) {
                        if (findAndReplaceBackpack(targetObject[key], backpackData)) {
                            return true;
                        }
                    }
                }
                return false;
            };
            if (generatedSerialsYaml && generatedSerialsYaml.state && generatedSerialsYaml.state.inventory && generatedSerialsYaml.state.inventory.items && generatedSerialsYaml.state.inventory.items.backpack) {
                if (findAndReplaceBackpack(importedYaml, generatedSerialsYaml.state.inventory.items.backpack)) {
                    const mergedYamlString = jsyaml.dump(importedYaml, { lineWidth: -1, quotingType: "'" });
                    setOutputYaml(truncate(mergedYamlString));
                    setFullYaml(mergedYamlString);
                    setFilteredYaml('');
                    setStatusMessage('YAML merged successfully. Ready to download.');
                } else {
                    setStatusMessage('❌ ERROR: Could not find a suitable location to merge the serials.');
                }
            } else {
                setStatusMessage('❌ ERROR: No generated serials to merge.');
            }
        } catch (error) {
            console.error('Failed to merge YAML:', error);
            setStatusMessage('❌ ERROR: Failed to merge YAML.');
        }
        setIsMerging(false);
    };
    const saveState = () => {
        try {
            const stateToSave = {
                repository: state.repository,
                seed: state.seed,
            };
            const yamlString = jsyaml.dump(stateToSave);
            const blob = new Blob([yamlString], { type: 'text/yaml;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'serial-generator-state.yaml';
            link.click();
            URL.revokeObjectURL(link.href);
            setStatusMessage('State saved successfully.');
        } catch (error) {
            console.error('Failed to save state:', error);
            setStatusMessage('❌ ERROR: Failed to save state.');
        }
    };
    const restoreState = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const yamlString = e.target.result;
                const restoredState = jsyaml.load(yamlString);
                setState((prevState) => ({
                    ...prevState,
                    repository: restoredState.repository || prevState.repository,
                    seed: restoredState.seed || prevState.seed,
                }));
                setStatusMessage('State restored successfully.');
            } catch (error) {
                console.error('Failed to restore state:', error);
                setStatusMessage('❌ ERROR: Failed to parse YAML file.');
            }
        };
        reader.readAsText(file);
    };
    const handleBaseYamlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            setBaseYaml(e.target.result);
            setStatusMessage('Base YAML loaded for live merging.');
        };
        reader.readAsText(file);
    };
    const inputClasses =
        'w-full p-3 bg-gray-900 text-gray-200 border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm';
    const btnClasses = {
        primary: 
            'py-3 px-4 w-full font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed',
        secondary: 
            'py-3 px-4 w-full font-semibold text-gray-300 bg-gray-600 rounded-md hover:bg-gray-700 transition-all disabled:opacity-50',
        tertiary: 'py-2 px-4 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-all',
    };
    return (
        <div className="p-4 md:p-8">
            <header className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-100">
                    Serial Mutation <span className="text-blue-400">Engine</span>
                </h1>
                <p className="text-gray-400 text-lg mt-2">A professional tool for procedural serial generation and mutation.</p>
            </header>
                        <main className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-screen-3xl mx-auto">
                            <div className="flex flex-col gap-4">
                                <Accordion title="📦 Repository & Base Seed" open={true}>
                                    <FormGroup label="Repository">
                                        <textarea
                                            className={`${inputClasses} min-h-[120px]`}
                                            value={state.repository || ''}
                                            onChange={handleRepoEdit}
                                            placeholder="Paste serials here..."
                                            disabled={isMerging}
                                        ></textarea>
                                    </FormGroup>
                                    <FormGroup label="Search Serials">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                name="searchTerm"
                                                className={inputClasses}
                                                placeholder="Enter search term..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                disabled={isMerging}
                                            />
                                            <button onClick={searchSerials} className={btnClasses.secondary} disabled={isMerging}>Search</button>
                                        </div>
                                    </FormGroup>
                                    <FormGroup label="Base Serial Seed">
                                        <textarea className={`${inputClasses} h-24`} value={state.seed} onChange={handleSeedEdit} disabled={isMerging}></textarea>
                                    </FormGroup>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={saveState} className={btnClasses.secondary} disabled={isMerging}>Save State</button>
                                        <label className={`${btnClasses.secondary} text-center cursor-pointer ${isMerging ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            Restore State
                                            <input type="file" accept=".yaml,.yml" onChange={restoreState} className="hidden" disabled={isMerging} />
                                        </label>
                                    </div>
                                </Accordion>
                                <Accordion title="🔢 Output Counts" open={true}>
            						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            							<FormGroup label="NEW">
            								                                <input
            																	type="number"
            																	name="counts.new"
            																	value={state.counts.new}
            																	onChange={handleInputChange}
            																	className={inputClasses}
            																	disabled={isMerging}
            																/>								<p className="text-xs text-gray-400">Extends the base seed with random characters, preserving a prefix.</p>
            							</FormGroup>
            							<FormGroup label="TG1">
            								                                <input
            																	type="number"
            																	name="counts.tg1"
            																	value={state.counts.tg1}
            																	onChange={handleInputChange}
            																	className={inputClasses}
            																	disabled={isMerging}
            																/>
            								                                                                <p className="text-xs text-gray-400">Inserts one stable motif at a random position within the serial's safe zone.</p>
            																															</FormGroup>
            																															<FormGroup label="TG2">
            																																<input
            																																	type="number"
            																																	name="counts.tg2"
            																																	value={state.counts.tg2}
            																																	onChange={handleInputChange}
            																																	className={inputClasses}
            																																	disabled={isMerging}
            																																/>
            																																<p className="text-xs text-gray-400">Inserts two stable motifs at random positions within the serial's safe zone.</p>															</FormGroup>
            															<FormGroup label="TG3">
            																<input
            																	type="number"
            																	name="counts.tg3"
            																	value={state.counts.tg3}
            																	onChange={handleInputChange}
            																	className={inputClasses}
            																	disabled={isMerging}
            																/>
            																<p className="text-xs text-gray-400">Injects a repeating high-value part at the end of the serial.</p>
            															</FormGroup>
            															<FormGroup label="TG4">
            																<input
            																	type="number"
            																	name="counts.tg4"
            																	value={state.counts.tg4}
            																	onChange={handleInputChange}
            																	className={inputClasses}
            																	disabled={isMerging}
            																/>								<p className="text-xs text-gray-400">Overwrites a large part of the serial with a random chunk from the repository.</p>
            							</FormGroup>
            						</div>
            					</Accordion>
                            </div>
                            <div className="flex flex-col gap-4">
                                <Accordion title="🧬 Mutation Rules" open={true}>
                                    <FormGroup label="Item Type">
                                        <select name="itemType" value={state.itemType} onChange={handleInputChange} className={inputClasses} disabled={isMerging}>
                                            <option value="GUN">Gun</option>
                                            <option value="SHIELD">Shield</option>
                                            <option value="CLASS_MOD">Class Mod</option>
                                            <option value="ENHANCEMENT">Enhancement</option>
                                            <option value="REPKIT">Repair Kit</option>
                                            <option value="ORDNANCE">Ordnance</option>
                                            <option value="GENERIC">Generic</option>
                                        </select>
                                    </FormGroup>
            						                        <MutableRangeSelector
            													seed={state.seed}
            													start={state.rules.mutableStart}
            													end={state.rules.mutableEnd}
            													setRange={({ start, end }) =>
            														setState((prev) => ({ ...prev, rules: { ...prev.rules, mutableStart: start, mutableEnd: end } }))
            												}
            													inputClasses={inputClasses}
            													                                    												/>						<FormGroup label="Crossover Chunk Size">
            							                            <div className="grid grid-cols-3 gap-4">
            															<input
            																type="number"
            																name="rules.minChunk"
            																value={state.rules.minChunk}
            																onChange={handleInputChange}
            																className={inputClasses}
            																title="The smallest crossover segment size."
            																disabled={isMerging}
            															/>								<input
            									type="number"
            									name="rules.maxChunk"
            									value={state.rules.maxChunk}
            									onChange={handleInputChange}
            									className={inputClasses}
            									title="The largest crossover segment size."
            									disabled={isMerging}
            								/>
            								<input
            									type="number"
            									name="rules.targetChunk"
            									value={state.rules.targetChunk}
            									onChange={handleInputChange}
            									className={inputClasses}
            									title="The preferred crossover segment size."
            									disabled={isMerging}
            								/>
            							</div>
            						</FormGroup>
            						<FormGroup label={`Legendary Part Chance (${state.rules.legendaryChance}%)`}>
            							                                <input
            															type="range"
            															name="rules.legendaryChance"
            															min="0"
            															max="100"
            															value={state.rules.legendaryChance}
            															onChange={handleInputChange}
            															className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            															disabled={isMerging}
            														/>						</FormGroup>
            						<FormGroup label="High-Value Part Size Range">
            							<div className="grid grid-cols-2 gap-4">
            								                                <input
            																	type="number"
            																	name="rules.minPart"
            																	value={state.rules.minPart}
            																	onChange={handleInputChange}
            																	className={inputClasses}
            																	disabled={isMerging}
            																/>
            																<input
            																	type="number"
            																	name="rules.maxPart"
            																	value={state.rules.maxPart}
            																	onChange={handleInputChange}
            																	className={inputClasses}
            																	disabled={isMerging}
            																/>							</div>
            						</FormGroup>
            						<FormGroup label="Final Tail Length Offset">
            							                                <input
            															type="number"
            															name="rules.targetOffset"
            															value={state.rules.targetOffset}
            															onChange={handleInputChange}
            															className={inputClasses}
            															disabled={isMerging}
            														/>						</FormGroup>
            					</Accordion>
                                <Accordion title="✔️ Filtering">
                                    <FormGroup label="Characters to Filter">
                                        <input
                                            type="number"
                                            name="validationChars"
                                            value={state.validationChars}
                                            onChange={handleInputChange}
                                            className={inputClasses}
                                            disabled={isMerging}
                                        />
                                    </FormGroup>
                                    <button
                                        onClick={() =>
                                            workerRef.current.postMessage({
                                                type: 'validate',
                                                payload: {
                                                    yaml: fullYaml,
                                                    seed: state.seed,
                                                    validationChars: state.validationChars,
                                                    generateStats: state.generateStats,
                                                    minPart: state.rules.minPart,
                                                    maxPart: state.rules.maxPart,
                                                    debugMode: state.debugMode,
                                                },
                                            })
                                        }
                                        className={btnClasses.secondary}
                                        disabled={isMerging}
                                    >
                                        Filter
                                    </button>
                                    {validationResult && (
                                        <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-md text-center whitespace-pre-wrap">
                                            {validationResult}
                                        </div>
                                    )}
                                </Accordion>
                                <SerialEditor />
                            </div>
                            <div className="flex flex-col gap-4 h-full xl:col-span-2 2xl:col-span-1">
                                <Accordion title="📊 Statistics">
                                    <div className="overflow-x-auto">
                                        <div id="chartContainer" style={{ position: 'relative', height: '400px' }}>
                                            <canvas id="statsChart"></canvas>
                                        </div>
                                    </div>
                                </Accordion>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg flex flex-col flex-grow">
                                    <div className="p-4 flex justify-between items-center border-b border-gray-700 flex-wrap">
                                        <h3 className="text-lg font-semibold mb-2 md:mb-0">📝 YAML Output (Read-Only)</h3>
                                        <div className="flex gap-2 flex-wrap">
                                            <button onClick={copyToClipboard} className={btnClasses.tertiary} disabled={isMerging}>
                                                {copyText}
                                            </button>
                                            <button onClick={downloadYAML} className={btnClasses.tertiary} disabled={isMerging}>
                                                Download
                                            </button>
                                            <Dropdown title="Merge" btnClasses={btnClasses.tertiary}>
                                                <button
                                                    onClick={() => mergeYAML(baseYaml)}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                                    disabled={!baseYaml || isMerging}
                                                >
                                                    Import & Merge
                                                </button>
                                                <label className={`block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 cursor-pointer ${isMerging ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    Select Base YAML
                                                    <input type="file" accept=".yaml,.yml" onChange={handleBaseYamlChange} className="hidden" disabled={isMerging} />
                                                </label>
                                                <div className="flex items-center px-4 py-2 text-sm text-gray-300">
                                                    <input
                                                        type="checkbox"
                                                        id="liveMerge"
                                                        checked={liveMerge}
                                                        onChange={(e) => setLiveMerge(e.target.checked)}
                                                        disabled={!baseYaml || isMerging}
                                                        className="mr-2"
                                                    />
                                                    <label htmlFor="liveMerge">Live Merge</label>
                                                </div>
                                            </Dropdown>
                                            <button onClick={() => { setOutputYaml(''); setFullYaml(''); setFilteredYaml(''); }} className={btnClasses.tertiary} disabled={isMerging}>
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-grow">
                                        <textarea className={`${inputClasses} h-full w-full resize-none`} readOnly value={outputYaml}></textarea>
                                    </div>
                                </div>
                                <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700 flex flex-col gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={startGeneration} disabled={isGenerating || isMerging} className={btnClasses.primary}>
                                            Generate Serials
                                        </button>
                                        <button onClick={resetForm} disabled={isGenerating || isMerging} className={btnClasses.secondary}>
                                            Reset All
                                        </button>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-2">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="genStats"
                                                name="generateStats"
                                                checked={state.generateStats}
                                                onChange={handleInputChange}
                                                className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                                disabled={isMerging}
                                            />
                                            <label htmlFor="genStats" className="ml-2 text-sm font-medium text-gray-300">
                                                Generate Part Statistics
                                            </label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="debugMode"
                                                name="debugMode"
                                                checked={state.debugMode}
                                                onChange={handleInputChange}
                                                className="h-4 w-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
                                                disabled={isMerging}
                                            />
                                            <label htmlFor="debugMode" className="ml-2 text-sm font-medium text-gray-300">
                                                Enable Debug Logging
                                            </label>
                                        </div>
                                    </div>
                                    <div
                                        className="h-10 text-center text-sm text-gray-400 flex items-center justify-center"
                                        style={{ whiteSpace: 'pre-line' }}
                                    >
                                        {statusMessage}
                                    </div>
                                    {isGenerating && (
                                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </main>        </div>
    );
};
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
