declare const React: any;

interface FormGroupProps {
    label: string;
    children: React.ReactNode;
}

const FormGroup: React.FC<FormGroupProps> = ({ label, children }) => (
    <div className="flex flex-col gap-2">
        <label className="font-medium text-gray-400 text-sm">{label}</label>
        {children}
    </div>
);

window.FormGroup = FormGroup;