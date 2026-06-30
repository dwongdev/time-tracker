interface ExportPreviewModalProps {
  imageUrl: string;
  onClose: () => void;
  onDownload: () => void;
}

export default function ExportPreviewModal({ imageUrl, onClose, onDownload }: ExportPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60] p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 border-none shadow-none rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'transparent', color: 'var(--text-muted)', width: 28, height: 28, cursor: 'pointer', padding: 0 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Export Preview
        </h3>

        <div
          className="rounded-lg overflow-hidden mb-6"
          style={{ border: '1px solid var(--border)' }}
        >
          <img src={imageUrl} alt="Chart export preview" className="w-full h-auto block" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDownload}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-95 transition-all border-none"
          >
            Download PNG
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all bg-transparent"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
