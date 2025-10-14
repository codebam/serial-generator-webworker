const FormGroup = ({ label, children }) => (
    <div className="flex flex-col gap-2">
        <label className="font-medium text-gray-400 text-sm">{label}</label>
        {children}
    </div>
);