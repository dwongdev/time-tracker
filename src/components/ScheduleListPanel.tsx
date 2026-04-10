import type { TimeBlock } from '../types/schedule';
import { formatTo12Hour, calculateDuration, formatDuration, sortTimeBlocks } from '../utils/timeUtils';

interface ScheduleListPanelProps {
  timeBlocks: TimeBlock[];
  onBlockClick: (block: TimeBlock) => void;
  onClose: () => void;
}

export default function ScheduleListPanel({ timeBlocks, onBlockClick, onClose }: ScheduleListPanelProps) {
  const sorted = sortTimeBlocks(timeBlocks);

  // Calculate total scheduled time
  const totalMinutes = sorted.reduce((sum, block) => sum + calculateDuration(block.startTime, block.endTime), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Schedule Overview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {sorted.length} block{sorted.length !== 1 ? 's' : ''} &middot; {formatDuration(totalMinutes)} scheduled
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
              No time blocks yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((block) => {
                const duration = calculateDuration(block.startTime, block.endTime);
                return (
                  <button
                    key={block.id}
                    onClick={() => onBlockClick(block)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: block.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100 flex-1 truncate text-sm">
                      {block.label}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTo12Hour(block.startTime)} - {formatTo12Hour(block.endTime)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline min-w-[52px] text-right">
                        {formatDuration(duration)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
