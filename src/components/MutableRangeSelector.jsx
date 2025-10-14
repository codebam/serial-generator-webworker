import React from 'react';
import FormGroup from './FormGroup.jsx';

const MutableRangeSelector = ({ seed, start, end, setRange, inputClasses }) => {
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
                    />
                </FormGroup>
            </div>
        </FormGroup>
    );
};

export default MutableRangeSelector;
