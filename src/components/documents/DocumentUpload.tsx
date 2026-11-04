/**
 * Document Upload Component - Production Grade
 * 
 * Based on SurfSense document upload patterns
 * Supports: PDF, DOCX with drag-and-drop
 * 
 * Features:
 * - Drag-and-drop file upload
 * - File type validation
 * - Progress tracking
 * - Auto-generation of study materials
 * - Error handling with user feedback
 * 
 * Reference: Task 2.4 from Phase 2 (Document Parsing)
 */

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  File,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  BookOpen,
} from '@/components/icons'
import { parsePDF, isPDF } from '@/lib/documents/pdf-parser'
import { parseDOCX, isDOCX, isDOC } from '@/lib/documents/docx-parser'

export interface ParsedDocument {
  fileName: string
  fileType: 'pdf' | 'docx'
  text: string
  /** PDF only: text per page, so quotes can cite a page */
  pages?: string[]
  metadata: any
  parsedAt: Date
}

export interface DocumentUploadProps {
  onDocumentParsed: (document: ParsedDocument) => void
  onGenerateStudyMaterials?: (text: string) => Promise<void>
  maxFileSize?: number // MB
  allowedTypes?: Array<'pdf' | 'docx'>
}

export function DocumentUpload({
  onDocumentParsed,
  onGenerateStudyMaterials,
  maxFileSize = 10, // 10MB default
  allowedTypes = ['pdf', 'docx'],
}: DocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 })
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsProcessing(true)
      setError(null)
      setSuccessMessage(null)
      setCurrentFile(file)

      try {
        // Validate file size
        const fileSizeMB = file.size / (1024 * 1024)
        if (fileSizeMB > maxFileSize) {
          throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds ${maxFileSize}MB limit`)
        }

        let result: any
        let fileType: 'pdf' | 'docx'

        // Parse based on file type
        if (isPDF(file) && allowedTypes.includes('pdf')) {
          console.log('📄 Processing PDF...')
          result = await parsePDF(file, {
            onProgress: (prog) => setProgress(prog),
          })
          fileType = 'pdf'
        } else if (isDOCX(file) && allowedTypes.includes('docx')) {
          console.log('📘 Processing DOCX...')
          result = await parseDOCX(file)
          fileType = 'docx'
        } else if (isDOC(file)) {
          throw new Error('Legacy .doc files are not supported. Please convert to .docx format.')
        } else {
          throw new Error('Unsupported file type. Please upload a PDF or DOCX file.')
        }

        // Check if document has content
        if (!result.text || result.text.trim().length === 0) {
          throw new Error('Document appears to be empty or text could not be extracted.')
        }

        console.log('✅ Document parsed successfully:', {
          type: fileType,
          chars: result.text.length,
          words: result.text.split(/\s+/).length,
        })

        // Create parsed document object
        const parsedDoc: ParsedDocument = {
          fileName: file.name,
          fileType,
          text: result.text,
          pages: Array.isArray(result.pages) ? result.pages : undefined,
          metadata: result.metadata,
          parsedAt: new Date(),
        }

        // Notify parent component
        onDocumentParsed(parsedDoc)

        // Generate study materials if handler provided
        if (onGenerateStudyMaterials) {
          console.log('🎓 Generating study materials...')
          await onGenerateStudyMaterials(result.text)
        }

        setSuccessMessage(`Successfully processed ${file.name}`)
        setProgress({ current: 0, total: 0, percentage: 0 })
      } catch (error: any) {
        console.error('❌ Document processing error:', error)
        setError(error.message || 'Failed to process document')
      } finally {
        setIsProcessing(false)
        setCurrentFile(null)
      }
    },
    [maxFileSize, allowedTypes, onDocumentParsed, onGenerateStudyMaterials]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFileUpload(acceptedFiles[0])
      }
    },
    [handleFileUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: isProcessing,
  })

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <Card
        {...getRootProps()}
        className={`
          relative overflow-hidden transition-all duration-200 cursor-pointer
          ${isDragActive ? 'border-primary bg-accent' : 'border-dashed bg-background'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="px-6 py-9 text-center">
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-3"
              >
                <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary" />
                <div>
                  <h3 className="font-sans text-[14px] font-semibold tracking-normal mb-1">Reading your document</h3>
                  {currentFile && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {currentFile.name}
                    </p>
                  )}
                  {progress.total > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <span>Page {progress.current} of {progress.total}</span>
                        <span>•</span>
                        <span>{progress.percentage}%</span>
                      </div>
                      <div className="max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress.percentage}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : isDragActive ? (
              <motion.div
                key="drag-active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-3"
              >
                <Upload className="w-7 h-7 mx-auto text-primary" />
                <div>
                  <h3 className="font-semibold text-primary">Drop file here</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Release to start processing
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-3"
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                  <Upload className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <h3 className="font-sans text-[14px] font-semibold tracking-normal">
                    Drop a file, or <span className="text-primary">browse</span>
                  </h3>
                  <p className="num mt-1 text-[11.5px] text-muted-foreground">PDF · DOCX · up to {maxFileSize} MB</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-4 bg-success/10 border-success/25">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-success">
                    {successMessage}
                  </p>
                  {onGenerateStudyMaterials && (
                    <p className="text-xs text-success mt-1">
                      Study materials will be generated automatically
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-4 bg-destructive/10 border-destructive/25">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    className="mt-2 h-auto p-0 text-xs text-destructive hover:text-destructive"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
