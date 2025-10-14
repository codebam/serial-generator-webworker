const { useState, useEffect, useRef } = React;

const Dropdown = ({ title, children, btnClasses }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={btnClasses}
            >
                {title}
                <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};



const Accordion = ({ title, children, open = false, className = '', noPadding = false }) => (
    <details open={open} className={`bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden flex flex-col ${className}`}>
        <summary className="accordion-summary flex items-center justify-between p-4 text-lg font-semibold cursor-pointer list-none hover:bg-gray-700/50">
            {title}
            <svg
                className="w-5 h-5 transition-transform transform details-arrow"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </summary>
        <div className={`${noPadding ? '' : 'p-5 pt-2'} flex flex-col gap-6 flex-grow`}>{children}</div>
        <style>{`.accordion-summary + .details-arrow { transition: transform 0.2s; } details[open] .details-arrow { transform: rotate(90deg); }`}</style>
    </details>
);

const FormGroup = ({ label, children }) => (
    <div className="flex flex-col gap-2">
        <label className="font-medium text-gray-400 text-sm">{label}</label>
        {children}
    </div>
);

const MutableRangeSelector = ({ seed, start, end, setRange, inputClasses, isMerging }) => {
    const handleRangeChange = (e) => {
        const { name, value } = e.target;
        let intValue = parseInt(value, 10);
        if (isNaN(intValue)) intValue = name === 'start' ? start : end;

        let newStart = name === 'start' ? intValue : start;
        let newEnd = name === 'end' ? intValue : end;

        if (newStart < 0) newStart = 0;
        if (newEnd > seed.length) newEnd = seed.length;
        if (newStart > newEnd) {
            if (name === 'start') newStart = newEnd;
            else newEnd = newStart;
        }

        setRange({ start: newStart, end: newEnd });
    };

    const protectedPrefix = seed.substring(0, start);
    const mutablePart = seed.substring(start, end);
    const protectedSuffix = seed.substring(end);

    return (
        <FormGroup label="Mutable Character Range">
            <div className="font-mono text-xs p-3 bg-gray-900 border border-gray-700 rounded-md break-all">
                <span className="text-gray-500" title="Protected Prefix">
                    {protectedPrefix}
                </span>
                <span className="bg-blue-900 text-blue-300 rounded-sm" title="Mutable Part">
                    {mutablePart}
                </span>
                <span className="text-gray-500" title="Protected Suffix">
                    {protectedSuffix}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormGroup label="Start Index">
                    <input
                        type="number"
                        name="start"
                        value={start}
                        onChange={handleRangeChange}
                        className={inputClasses}
                        min="0"
                        max={seed.length}
                        disabled={isMerging}
                    />
                </FormGroup>
                <FormGroup label="End Index">
                    <input
                        type="number"
                        name="end"
                        value={end}
                        onChange={handleRangeChange}
                        className={inputClasses}
                        min="0"
                        max={seed.length}
                        disabled={isMerging}
                    />
                </FormGroup>
            </div>
        </FormGroup>
    );
};

const App = () => {
    const defaultState = {
        repository: '',
        seed: '@Uge9B?m/)}}!ffxLNwtrrhUgJFvP19)9>F7c1drg69->2ZNDt8=I>e4x5g)=u;D`>fBRx?3?tmf{sYpdCQjv<(7NJN*DpHY(R3rc',
        counts: { new: 10000, tg1: 0, tg2: 0, tg3: 0, tg4: 0 },
        rules: {
            targetOffset: 250,
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
        generateStats: true,
        debugMode: false,
    };

    const [state, setState] = useState(() => {
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

    const [statusMessage, setStatusMessage] = useState('Ready to generate.');
    const [validationResult, setValidationResult] = useState('');
    const [progress, setProgress] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [outputYaml, setOutputYaml] = useState('');
    const [fullYaml, setFullYaml] = useState('');
    const [filteredYaml, setFilteredYaml] = useState('');
    const [liveMerge, setLiveMerge] = useState(false);
    const [baseYaml, setBaseYaml] = useState('');
    const [isMerging, setIsMerging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    const updateChart = (chartData) => {
        if (!state.generateStats || !chartData) return;

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
    };

    useEffect(() => {
        localStorage.setItem('serialGenState', JSON.stringify(state));
        if (!workerRef.current) {
            workerRef.current = new Worker('./src/worker/worker.js', { type: 'module' });
        }

        const handleMessage = (e) => {
            const { type, payload } = e.data;
            switch (type) {
                case 'progress':
                    setProgress((payload.processed / payload.total) * 100);
                    setStatusMessage(`Generating... ${payload.processed.toLocaleString()} / ${payload.total.toLocaleString()}`);
                    break;
                case 'stats_complete':
                    if (state.generateStats && payload.chartData) {
                        updateChart(payload.chartData);
                    }
                    break;
                case 'complete':
                    if (payload.validationResult) {
                        setValidationResult(payload.validationResult);
                        setFilteredYaml(payload.validatedYaml || '');
                        const filteredCount = payload.validatedYaml ? (payload.validatedYaml.match(/serial:/g) || []).length : 0;
                        setStatusMessage(`Filtering complete.\nCopy/Download will use the ${filteredCount} filtered serials.`);
                        setOutputYaml(payload.validatedYaml || '');
                        if (state.generateStats && payload.chartData) {
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

        workerRef.current.onmessage = handleMessage;

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [state]);

    useEffect(() => {
        if (liveMerge && baseYaml && fullYaml && !isMerging) {
            mergeYAML(baseYaml);
        }
    }, [fullYaml, liveMerge, baseYaml, isMerging]);

    const handleInputChange = (e) => {
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
    const handleRepoEdit = (e) =>
        setState((prev) => ({ ...prev, repository: e.target.value }));
    const handleSeedEdit = (e) => {
        const newSeed = e.target.value;
        setState((prev) => ({
            ...prev, 
            seed: newSeed,
            rules: {
                ...prev.rules,
                mutableStart: newSeed.length,
                mutableEnd: newSeed.length
            }
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
        const contentToDownload = outputYaml;
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
                    setOutputYaml(mergedYamlString);
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

    const restoreState = (event) => {
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

    const handleBaseYamlChange = (event) => {
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
            <main className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-screen-2xl mx-auto">
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
                    </Accordion>					<Accordion title="🧬 Mutation Rules" open={true}>
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
					<Accordion title="🔢 Output Counts">
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
																<p className="text-xs text-gray-400">Subtly mutates the serial by 'flipping' a few characters to adjacent ones (e.g., 'a' to 'b').</p>
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
																<p className="text-xs text-gray-400">Reverses a random segment of characters within the mutable range.</p>
															</FormGroup>
															<FormGroup label="TG3">
																<input
																	type="number"
																	name="counts.tg3"
																	value={state.counts.tg3}
																	onChange={handleInputChange}
																	className={inputClasses}
																	disabled={isMerging}
																/>
																<p className="text-xs text-gray-400">Swaps a high-value part with one from the repository, or stacks a repeating part if no mutable range is set.</p>
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

                <div className="flex flex-col gap-4 h-full">
                    <Accordion title="📊 Statistics" open={false}>
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
                                <button onClick={() => setOutputYaml('')} className={btnClasses.tertiary} disabled={isMerging}>
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div className="p-5 flex-grow">
                            <textarea className={`${inputClasses} h-full w-full resize-none`} readOnly value={outputYaml}></textarea>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};




const SerialEditor = () => {
    const [serial, setSerial] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [binary, setBinary] = useState('');
    const [modifiedBinary, setModifiedBinary] = useState('');
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [level, setLevel] = useState(null);
    const [levelFoundAt, setLevelFoundAt] = useState(null);


    const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{/}~';
    const MANUFACTURER_PATTERNS = {
        'Jakobs': ['2210', '2211', '2212', '2213'],
        'Maliwan': ['2214', '2215', '2216', '2217'],
        'Torgue': ['2218', '2219', '221a', '221b'],
        'Daedalus': ['221c', '221d', '221e', '221f'],
        'COV': ['2220', '2221', '2222', '2223']
    };

    const standardLevelDetection = (binary) => {
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

    const enhancedLevelDetection = (binary) => {
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

    const detectItemLevel = (binary) => {
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

        setAnalysis({
            type: serialType,
            manufacturer: manufacturer,
            hex: hex_data,
            safeEditStart: safeEditStart > 2 ? safeEditStart : 'N/A',
            safeEditEnd: safeEditEnd > safeEditStart ? safeEditEnd : 'N/A',
            level: detectedLevel,
        });
    };

    const handleLevelChange = (e) => {
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

    const handleSelectionChange = (e) => {
        const { name, value } = e.target;
        setSelection(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    };

    const modifyBits = (modification) => {
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

    const [newSerial, setNewSerial] = useState('');

    const encodeSerial = () => {
        const bytes = [];
        for (let i = 0; i < modifiedBinary.length; i += 8) {
            const byteString = modifiedBinary.substring(i, i + 8);
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
        
        setNewSerial('@U' + encoded);
    };

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
                    <p><strong>Hex:</strong> <span className="font-mono text-xs break-all">{analysis.hex}</span></p>
                    <p><strong>Safe Edit Start (after u~Q):</strong> {analysis.safeEditStart}</p>
                    <p><strong>Safe Edit End (preserve trailer):</strong> {analysis.safeEditEnd}</p>
                    
                    <h3 className="text-lg font-semibold mt-2">Level Editor</h3>
                    <FormGroup label="Item Level (0-50)">
                        <input type="number" value={level} onChange={handleLevelChange} className={inputClasses} min="0" max="50" />
                    </FormGroup>

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
                        <span>{modifiedBinary.substring(0, selection.start)}</span>
                        <span className="bg-blue-900 text-blue-300">{modifiedBinary.substring(selection.start, selection.end)}</span>
                        <span>{modifiedBinary.substring(selection.end)}</span>
                    </div>
                    <button onClick={encodeSerial} className={`${btnClasses.primary} mt-4`}>Generate Serial</button>
                    {newSerial && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold">New Serial</h3>
                            <textarea className={`${inputClasses} h-24`} readOnly value={newSerial}></textarea>
                        </div>
                    )}
                </div>
            )}
        </Accordion>
    );
};

const container = document.getElementById('root');

const root = ReactDOM.createRoot(container);

root.render(<App />);
