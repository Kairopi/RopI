/**
 * DOCX Parser - Production Grade
 * 
 * Based on SurfSense document parsing patterns
 * Uses mammoth for DOCX extraction
 * 
 * Features:
 * - Text extraction (plain text)
 * - HTML extraction (preserves formatting)
 * - Handles images and embedded content
 * - Error handling for malformed documents
 * 
 * Reference: Task 2.3 from Phase 2 (Document Parsing)
 */

import mammoth from 'mammoth'

export interface DOCXParseResult {
  text: string
  html: string
  metadata?: {
    wordCount: number
    characterCount: number
    paragraphCount: number
  }
  warnings?: string[]
}

export interface DOCXParseOptions {
  includeHTML?: boolean // Default: true
  preserveFormatting?: boolean // Default: true
}

/**
 * Parse DOCX file and extract content
 * 
 * @param file - DOCX file to parse
 * @param options - Optional parsing options
 * @returns Parsed DOCX with text and HTML
 */
export async function parseDOCX(
  file: File,
  options: DOCXParseOptions = {}
): Promise<DOCXParseResult> {
  const { includeHTML = true, preserveFormatting = true } = options
  
  try {
    console.log('📘 Parsing DOCX:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`)
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Extract raw text (no formatting)
    const textResult = await mammoth.extractRawText({ 
      arrayBuffer,
    })
    
    const text = textResult.value
    const warnings: string[] = textResult.messages.map(msg => msg.message)
    
    // Log warnings
    if (warnings.length > 0) {
      console.warn('⚠️ DOCX parsing warnings:', warnings)
    }
    
    // Extract HTML (preserves formatting)
    let html = ''
    
    if (includeHTML) {
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: preserveFormatting ? [
          // Custom style mappings for better HTML output
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Code'] => pre:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
        ] : undefined,
      })
      
      html = htmlResult.value
      
      // Add any new warnings from HTML conversion
      htmlResult.messages.forEach(msg => {
        if (!warnings.includes(msg.message)) {
          warnings.push(msg.message)
        }
      })
    }
    
    // Calculate metadata
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
    const characterCount = text.length
    const paragraphCount = text.split(/\n\n+/).filter(p => p.trim().length > 0).length
    
    console.log('✅ DOCX parsed successfully:', {
      words: wordCount,
      chars: characterCount,
      paragraphs: paragraphCount,
    })
    
    return {
      text,
      html,
      metadata: {
        wordCount,
        characterCount,
        paragraphCount,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error: any) {
    console.error('❌ DOCX parsing error:', error)
    
    // Provide helpful error messages
    if (error.message?.includes('not a valid zip file')) {
      throw new Error('Invalid DOCX file. The file may be corrupted or not a valid Word document.')
    } else if (error.message?.includes('End of central directory')) {
      throw new Error('DOCX file is incomplete or truncated.')
    } else {
      throw new Error(`Failed to parse DOCX: ${error.message || 'Unknown error'}`)
    }
  }
}

/**
 * Check if file is a valid DOCX
 */
export function isDOCX(file: File): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  )
}

/**
 * Check if file is legacy DOC format
 */
export function isDOC(file: File): boolean {
  return (
    file.type === 'application/msword' ||
    file.name.toLowerCase().endsWith('.doc')
  )
}

/**
 * Estimate reading time for DOCX text
 */
export function estimateReadingTime(text: string, wordsPerMinute: number = 200): number {
  const words = text.split(/\s+/).filter(word => word.length > 0).length
  return Math.ceil(words / wordsPerMinute)
}

/**
 * Extract headings from HTML for table of contents
 */
export function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = []
  
  // Match h1, h2, h3, etc.
  const headingRegex = /<h([1-6])>(.*?)<\/h\1>/gi
  let match
  
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      text: match[2].replace(/<[^>]*>/g, ''), // Strip any remaining HTML tags
    })
  }
  
  return headings
}

/**
 * Clean HTML for display (remove mammoth-specific classes)
 */
export function cleanHTML(html: string): string {
  return html
    .replace(/class="[^"]*"/g, '') // Remove classes
    .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
    .trim()
}

/**
 * Split DOCX text into chunks for processing
 * Useful for sending to LLMs with token limits
 */
export function chunkDOCXText(
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
