/**
 * Document Upload Demo Page
 * 
 * Demonstrates document parsing capabilities
 * Shows parsed content and metadata
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import DashboardLayout from '../components/DashboardLayout'
import { DocumentUpload, type ParsedDocument } from '../components/documents/DocumentUpload'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Calendar,
  User,
  Hash,
  Clock,
  BookOpen,
} from '@/components/icons'

export default function DocumentUploadDemo() {
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null)
  const [studyMaterials, setStudyMaterials] = useState<any>(null)

  const handleDocumentParsed = (doc: ParsedDocument) => {
    console.log('📄 Document parsed:', doc)
    setParsedDoc(doc)
  }

  const handleGenerateStudyMaterials = async (text: string) => {
    // Simulate study material generation
    console.log('🎓 Generating study materials from:', text.substring(0, 100) + '...')
    
    // In production, this would call Meta Muse API or another LLM
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setStudyMaterials({
      flashcards: Math.floor(text.split(/\s+/).length / 50),
      quizQuestions: Math.floor(text.split(/\s+/).length / 100),
      summary: 'Generated summary would appear here',
    })
    
    console.log('✅ Study materials generated')
  }

  const wordCount = parsedDoc ? parsedDoc.text.split(/\s+/).filter(w => w.length > 0).length : 0
  const readingTime = Math.ceil(wordCount / 200) // 200 words per minute

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              Document Upload
            </h1>
            <p className="text-muted-foreground mt-2">
              Upload PDF or DOCX files to automatically generate study materials
            </p>
          </motion.div>
        </div>

        {/* Upload Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <DocumentUpload
            onDocumentParsed={handleDocumentParsed}
            onGenerateStudyMaterials={handleGenerateStudyMaterials}
            maxFileSize={10}
            allowedTypes={['pdf', 'docx']}
          />
        </motion.div>

        {/* Parsed Document Display */}
        {parsedDoc && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Document Metadata */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Document Information
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">File Name</div>
                  <div className="font-medium text-sm truncate">{parsedDoc.fileName}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Type</div>
                  <Badge variant="outline" className="uppercase">
                    {parsedDoc.fileType}
                  </Badge>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    Words
                  </div>
                  <div className="font-medium">{wordCount.toLocaleString()}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Reading Time
                  </div>
                  <div className="font-medium">{readingTime} min</div>
                </div>
              </div>

              {/* PDF-specific metadata */}
              {parsedDoc.fileType === 'pdf' && parsedDoc.metadata.title && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parsedDoc.metadata.title && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Title</div>
                        <div className="text-sm">{parsedDoc.metadata.title}</div>
                      </div>
                    )}
                    {parsedDoc.metadata.author && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Author
                        </div>
                        <div className="text-sm">{parsedDoc.metadata.author}</div>
                      </div>
                    )}
                    {parsedDoc.metadata.pageCount && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Pages</div>
                        <div className="text-sm">{parsedDoc.metadata.pageCount}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DOCX-specific metadata */}
              {parsedDoc.fileType === 'docx' && parsedDoc.metadata.paragraphCount && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Paragraphs</div>
                      <div className="text-sm">{parsedDoc.metadata.paragraphCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Characters</div>
                      <div className="text-sm">{parsedDoc.metadata.characterCount?.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Study Materials Generated */}
            {studyMaterials && (
              <Card className="p-6 bg-primary/5 border-primary">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Study Materials Generated
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-background border">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <div className="text-sm font-medium">Flashcards</div>
                    </div>
                    <div className="text-2xl font-bold">{studyMaterials.flashcards}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Review cards created
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-background border">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <div className="text-sm font-medium">Quiz Questions</div>
                    </div>
                    <div className="text-2xl font-bold">{studyMaterials.quizQuestions}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Questions generated
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-background border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <div className="text-sm font-medium">Summary</div>
                    </div>
                    <div className="text-2xl font-bold">1</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Key points extracted
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button size="sm">
                    <BookOpen className="w-4 h-4" />
                    Start Reviewing
                  </Button>
                  <Button size="sm" variant="outline">
                    View All Materials
                  </Button>
                </div>
              </Card>
            )}

            {/* Text Preview */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Content Preview</h2>
              <div className="max-h-96 overflow-y-auto">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                  {parsedDoc.text.substring(0, 2000)}
                  {parsedDoc.text.length > 2000 && '\n\n... (truncated)'}
                </pre>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}
