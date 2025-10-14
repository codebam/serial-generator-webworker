import React, { useState, useEffect, useRef } from 'react';
import Accordion from './components/Accordion.jsx';
import FormGroup from './components/FormGroup.jsx';
import MutableRangeSelector from './components/MutableRangeSelector.jsx';

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

    const workerRef = useRef(null);
    const chartRef = useRef(null);

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
            workerRef.current = new Worker('/serial-generator-webworker/src/worker/worker.js', { type: 'module' });
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
        const hasFilteredContent = !!filteredYaml;
        const contentToDownload = filteredYaml || fullYaml;
        if (!contentToDownload) return;
        const blob = new Blob([contentToDownload], { type: 'text/yaml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = hasFilteredContent ? 'filtered_serials.yaml' : 'generated_serials.yaml';
        link.click();
        URL.revokeObjectURL(link.href);
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
            <main className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
                <div className="flex flex-col gap-4">
                    <Accordion title="📦 Repository & Base Seed" open={true}>
                        <FormGroup label="Repository">
                            <textarea
                                className={`${inputClasses} min-h-[120px]`}
                                value={state.repository || ''}
                                onChange={handleRepoEdit}
                                placeholder="Paste serials here..."
                            ></textarea>
                        </FormGroup>
                        <FormGroup label="Base Serial Seed">
                            <textarea className={`${inputClasses} h-24`} value={state.seed} onChange={handleSeedEdit}></textarea>
                        </FormGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={saveState} className={btnClasses.secondary}>Save State</button>
                            <label className={`${btnClasses.secondary} text-center cursor-pointer`}>
                                Restore State
                                <input type="file" accept=".yaml,.yml" onChange={restoreState} className="hidden" />
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
						/>
						<FormGroup label="Crossover Chunk Size">
							<div className="grid grid-cols-3 gap-4">
								<input
									type="number"
									name="rules.minChunk"
									value={state.rules.minChunk}
									onChange={handleInputChange}
									className={inputClasses}
									title="The smallest crossover segment size."
								/>
								<input
									type="number"
									name="rules.maxChunk"
									value={state.rules.maxChunk}
									onChange={handleInputChange}
									className={inputClasses}
									title="The largest crossover segment size."
								/>
								<input
									type="number"
									name="rules.targetChunk"
									value={state.rules.targetChunk}
									onChange={handleInputChange}
									className={inputClasses}
									title="The preferred crossover segment size."
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
							/>
						</FormGroup>
						<FormGroup label="High-Value Part Size Range">
							<div className="grid grid-cols-2 gap-4">
								<input
									type="number"
									name="rules.minPart"
									value={state.rules.minPart}
									onChange={handleInputChange}
									className={inputClasses}
								/>
								<input
									type="number"
									name="rules.maxPart"
									value={state.rules.maxPart}
									onChange={handleInputChange}
									className={inputClasses}
								/>
							</div>
						</FormGroup>
						<FormGroup label="Final Tail Length Offset">
							<input
								type="number"
								name="rules.targetOffset"
								value={state.rules.targetOffset}
								onChange={handleInputChange}
								className={inputClasses}
							/>
						</FormGroup>
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
								/>
								<p className="text-xs text-gray-400">Extends the base seed with random characters, preserving a prefix.</p>
							</FormGroup>
							<FormGroup label="TG1">
								<input
									type="number"
									name="counts.tg1"
									value={state.counts.tg1}
									onChange={handleInputChange}
									className={inputClasses}
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
								/>
								<p className="text-xs text-gray-400">Overwrites a large part of the serial with a random chunk from the repository.</p>
							</FormGroup>
						</div>
					</Accordion>

                    <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={startGeneration} disabled={isGenerating} className={btnClasses.primary}>
                                Generate Serials
                            </button>
                            <button onClick={resetForm} disabled={isGenerating} className={btnClasses.secondary}>
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
                        >
                            Filter
                        </button>
                        {validationResult && (
                            <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-md text-center whitespace-pre-wrap">
                                {validationResult}
                            </div>
                        )}
                    </Accordion>
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
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h3 className="text-lg font-semibold">📝 YAML Output (Read-Only)</h3>
                            <div className="flex gap-2">
                                <button onClick={copyToClipboard} className={btnClasses.tertiary}>
                                    {copyText}
                                </button>
                                <button onClick={downloadYAML} className={btnClasses.tertiary}>
                                    Download
                                </button>
                                <button onClick={() => setOutputYaml('')} className={btnClasses.tertiary}>
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

export default App;
