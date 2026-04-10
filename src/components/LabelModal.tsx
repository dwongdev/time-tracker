import { useState } from 'react';
import Modal from 'react-modal';
import { formatDuration, calculateDuration, formatTo12Hour } from '../utils/timeUtils';

interface LabelModalProps {
  isOpen: boolean;
  startTime: string;
  endTime: string;
  onClose: () => void;
  onSave: (label: string, color: string) => void;
  onDelete?: () => void;
  availableColors: string[];
  mode?: 'create' | 'edit';
  initialLabel?: string;
  initialColor?: string;
}

export default function LabelModal({
  isOpen,
  startTime,
  endTime,
  onClose,
  onSave,
  onDelete,
  availableColors,
  mode = 'create',
  initialLabel = '',
  initialColor,
}: LabelModalProps) {
  const [label, setLabel] = useState(initialLabel);
  const [selectedColor, setSelectedColor] = useState(initialColor || availableColors[0]);

  const duration = calculateDuration(startTime, endTime);

  const handleSave = () => {
    if (label.trim()) {
      onSave(label.trim(), selectedColor);
      setLabel('');
      setSelectedColor(availableColors[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && label.trim()) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
      setLabel('');
    }
  };

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const modalStyles = {
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
    },
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      border: 'none',
      borderRadius: '16px',
      padding: 0,
      maxWidth: '500px',
      width: '90%',
      background: isDark ? '#111827' : '#ffffff',
    },
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} style={modalStyles}>
      <div className="p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {mode === 'edit' ? 'Edit Time Block' : 'Create Time Block'}
        </h3>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatTo12Hour(startTime)} - {formatTo12Hour(endTime)}
          </div>
          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
          <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {formatDuration(duration)}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Work, Gym, Study..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:outline-none transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Color
            </label>
            <div className="grid grid-cols-5 gap-3">
              {availableColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`h-12 rounded-lg transition-all border-none bg-transparent p-0 ${
                    selectedColor === color
                      ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-gray-100 scale-105'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          {mode === 'edit' && onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this time block?')) {
                  onDelete();
                  onClose();
                }
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 active:scale-95 transition-all border-none"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-none"
          >
            {mode === 'edit' ? 'Save Changes' : 'Create Block'}
          </button>
          <button
            onClick={() => {
              onClose();
              setLabel(initialLabel);
              setSelectedColor(initialColor || availableColors[0]);
            }}
            className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all bg-transparent"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
