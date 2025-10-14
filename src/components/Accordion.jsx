



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


