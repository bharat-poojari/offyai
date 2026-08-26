import { FiSend } from 'react-icons/fi';

export default function InputBox({ value, onChange, onSend, disabled }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) onSend();
    }
  };

  return (
    <div className="p-3 border-t border-gray-700 flex gap-2 bg-gray-800">
      <textarea
        className="flex-1 resize-none p-2 rounded-lg bg-gray-900 text-gray-100 text-sm outline-none"
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type your message..."
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="p-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition"
      >
        <FiSend />
      </button>
    </div>
  );
}
