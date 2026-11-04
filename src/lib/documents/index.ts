/**
 * Document Parsing Library - Exports
 * 
 * Centralized exports for all document parsing utilities
 */

// PDF Parser
export {
  parsePDF,
  isPDF,
  estimateReadingTime as estimatePDFReadingTime,
  chunkPDFText,
  type PDFParseResult,
  type PDFParseOptions,
} from './pdf-parser'

// DOCX Parser
export {
  parseDOCX,
  isDOCX,
  isDOC,
  estimateReadingTime as estimateDOCXReadingTime,
  extractHeadings,
  cleanHTML,
  chunkDOCXText,
  type DOCXParseResult,
  type DOCXParseOptions,
} from './docx-parser'
