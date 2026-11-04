/**
 * PDF Parser - Production Grade
 * 
 * Based on SurfSense document parsing patterns
 * Uses pdfjs-dist for client-side PDF extraction
 * 
 * Features:
 * - Page-by-page text extraction
 * - Metadata extraction (title, author, page count)
 * - Error handling for malformed PDFs
 * - Progress tracking for large documents
 * 
 * Reference: Task 2.2 from Phase 2 (Document Parsing)
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Serve the worker from our own bundle so it always matches the installed
// pdfjs-dist version (cdnjs has no 6.5.438 build, which broke every PDF upload).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface PDFParseResult {
  text: string
  pages: string[]
  metadata: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creator?: string
    producer?: string
    creationDate?: string
    modificationDate?: string
    pageCount: number
  }
}

export interface PDFParseOptions {
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  maxPages?: number // Limit for very large PDFs
}

/**
 * Parse PDF file and extract text content
 * 
 * @param file - PDF file to parse
 * @param options - Optional parsing options
 * @returns Parsed PDF with text, pages, and metadata
 */
export async function parsePDF(
  file: File,
  options: PDFParseOptions = {}
): Promise<PDFParseResult> {
  const { onProgress, maxPages } = options
  
  try {
    console.log('📄 Parsing PDF:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`)
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    
    console.log('✅ PDF loaded:', pdf.numPages, 'pages')
    
    // Determine page count (respect maxPages limit)
    const totalPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages
    
    // Extract text from all pages
    const pages: string[] = []
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        // Get page
        const page = await pdf.getPage(pageNum)
        
        // Extract text content
        const textContent = await page.getTextContent()
        
        // Combine text items into single string
        const pageText = textContent.items
          .map((item: any) => {
            // Handle different item types
            if ('str' in item) {
              return item.str
            }
            return ''
          })
          .filter(text => text.trim().length > 0)
          .join(' ')
        
        pages.push(pageText)
        
        // Report progress
        if (onProgress) {
          onProgress({
            current: pageNum,
            total: totalPages,
            percentage: Math.round((pageNum / totalPages) * 100),
          })
        }
        
        console.log(`📄 Page ${pageNum}/${totalPages}: ${pageText.length} chars`)
      } catch (pageError) {
        console.error(`Failed to parse page ${pageNum}:`, pageError)
        pages.push(`[Error parsing page ${pageNum}]`)
      }
    }
    
    // Get metadata
    const metadata = (await pdf.getMetadata()) as { info?: Record<string, any> }
    
    // Combine all pages into single text
    const fullText = pages.join('\n\n')
    
    console.log('✅ PDF parsed successfully:', {
      pages: pages.length,
      totalChars: fullText.length,
      title: metadata.info?.Title || 'Untitled',
    })
    
    return {
      text: fullText,
      pages,
      metadata: {
        title: metadata.info?.Title,
        author: metadata.info?.Author,
        subject: metadata.info?.Subject,
        keywords: metadata.info?.Keywords,
        creator: metadata.info?.Creator,
        producer: metadata.info?.Producer,
        creationDate: metadata.info?.CreationDate,
        modificationDate: metadata.info?.ModDate,
        pageCount: pdf.numPages,
      },
    }
  } catch (error: any) {
    console.error('❌ PDF parsing error:', error)
    
    // Provide helpful error messages
    if (error.name === 'InvalidPDFException') {
      throw new Error('Invalid PDF file. The file may be corrupted or not a valid PDF.')
    } else if (error.name === 'PasswordException') {
      throw new Error('PDF is password protected. Please provide an unlocked version.')
    } else if (error.name === 'MissingPDFException') {
      throw new Error('PDF file is empty or missing.')
    } else {
      throw new Error(`Failed to parse PDF: ${error.message || 'Unknown error'}`)
    }
  }
}

/**
 * Check if file is a valid PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * Estimate reading time for PDF text
 */
export function estimateReadingTime(text: string, wordsPerMinute: number = 200): number {
  const words = text.split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

/**
 * Split PDF text into chunks for processing
 * Useful for sending to LLMs with token limits
 */
export function chunkPDFText(
  text: string,
  maxChunkSize: number = 3000,
  overlap: number = 200
): string[] {
  const chunks: string[] = []
  const words = text.split(/\s+/)
  
  let start = 0
  
  while (start < words.length) {
    const end = Math.min(start + maxChunkSize, words.length)
    const chunk = words.slice(start, end).join(' ')
    chunks.push(chunk)
    
    // Move start with overlap
    start = end - overlap
    
    // Prevent infinite loop
    if (start === end) break
  }
  
  return chunks
}
