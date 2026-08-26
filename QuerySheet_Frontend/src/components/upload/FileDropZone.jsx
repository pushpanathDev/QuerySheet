import { useState, useRef, useCallback } from 'react'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Only ${ACCEPTED_EXTENSIONS.join(', ')} files are accepted.`
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File exceeds maximum size of 5 MB (got ${formatBytes(file.size)}).`
  }
  return null
}

/**
 * Three visual states: idle | dragover | selected
 * Validates extension and size before calling onFile(file).
 */
export default function FileDropZone({ onFile }) {
  const [dragState, setDragState] = useState('idle') // 'idle' | 'dragover'
  const [selectedFile, setSelectedFile] = useState(null)
  const [validationError, setValidationError] = useState('')
  const inputRef = useRef(null)

  const processFile = useCallback(
    (file) => {
      const error = validateFile(file)
      if (error) {
        setValidationError(error)
        setSelectedFile(null)
        return
      }
      setValidationError('')
      setSelectedFile(file)
      onFile(file)
    },
    [onFile]
  )

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragState('dragover')
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragState('idle')
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragState('idle')
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleInputChange(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleRemove() {
    setSelectedFile(null)
    setValidationError('')
    onFile(null)
  }

  if (selectedFile) {
    return (
      <div className="border-2 border-brand/40 bg-brand-soft rounded-xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-brand/15 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted">{formatBytes(selectedFile.size)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="File drop zone. Click or drag a CSV or XLSX file here."
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none',
          dragState === 'dragover'
            ? 'border-brand bg-brand-soft scale-[1.01]'
            : 'border-line bg-surface hover:border-brand/50 hover:bg-brand-soft/50',
        ].join(' ')}
      >
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${dragState === 'dragover' ? 'bg-brand/15' : 'bg-black/5'}`}
        >
          <svg
            className={`w-6 h-6 ${dragState === 'dragover' ? 'text-brand' : 'text-muted'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">
            Drop your file here
          </p>
          <p className="text-xs text-muted mt-1">
            or <span className="text-brand font-medium">browse to upload</span>
          </p>
        </div>
        <p className="text-xs text-muted">Supports .csv, .xlsx · Max 5 MB</p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-red-600 flex items-center gap-1.5">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {validationError}
        </p>
      )}
    </div>
  )
}
