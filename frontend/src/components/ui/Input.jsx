// src/components/ui/Input.jsx
const Input = ({ label, error, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && (
      <label className="text-sm font-medium text-gray-700">{label}</label>
    )}
    <input
      className={`
        w-full px-3 py-2 rounded-lg border text-sm
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
        ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}
        ${className}
      `}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

export default Input;