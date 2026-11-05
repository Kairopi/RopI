/**
 * Your resume, once: upload a PDF or DOCX, or paste it. Either way you see the
 * text Ropi will use before you save, and can fix anything the file reader got
 * wrong (two-column PDFs sometimes come out in an odd order).
 */
import { useRef, useState } from 'react';
import { Upload, FileText, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { saveBaseResume } from '@/lib/jobs/job-service';
import { parsePDF, isPDF } from '@/lib/documents/pdf-parser';
import { parseDOCX, isDOCX } from '@/lib/documents/docx-parser';

interface ResumeUploadDialogProps {
  userId: string;
  onSuccess: () => void;
  /** Optional controlled mode (parent renders its own trigger button) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ResumeUploadDialog({ userId, onSuccess, open: controlledOpen, onOpenChange }: ResumeUploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => (isControlled ? onOpenChange?.(value) : setInternalOpen(value));
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setError(null);
    setReading(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('That file is over 10 MB. Try a smaller PDF, or paste the text.');
      const result = isPDF(file) ? await parsePDF(file) : isDOCX(file) ? await parseDOCX(file) : null;
      if (!result) throw new Error('Ropi reads PDF and DOCX files. For anything else, paste the text.');
      const text = String(result.text ?? '').replace(/\n{3,}/g, '\n\n').trim();
      if (text.length < 80) throw new Error('No text came out of that file (it may be a scanned image). Paste the text instead.');
      setResumeText(text);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file. Paste the text instead.');
    } finally {
      setReading(false);
    }
  };

  const handleSave = async () => {
    if (!resumeText.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await saveBaseResume(userId, resumeText.trim());
      setResumeText('');
      setFileName(null);
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the resume');
    } finally {
      setSaving(false);
    }
  };

  const words = resumeText.trim() ? resumeText.trim().split(/\s+/).length : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload />
            Add resume
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your resume
          </DialogTitle>
          <DialogDescription>Upload a PDF or Word file, or paste it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void readFile(f);
            }}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-background px-4 py-4 transition-colors hover:border-primary/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              {reading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">{reading ? 'Reading your file' : fileName ? `Read from ${fileName}` : 'Upload your resume'}</div>
              <div className="text-[12px] text-muted-foreground">{fileName ? 'Check the text below, then save. Click to choose a different file.' : 'PDF or DOCX, up to 10 MB. Or drop it here.'}</div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              aria-label="Upload resume file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = '';
              }}
            />
          </div>

          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {fileName ? 'the text Ropi will use' : 'or paste it'}
            <span className="h-px flex-1 bg-border" />
          </div>

          <Textarea
            aria-label="Resume text"
            placeholder="Paste your resume here"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="min-h-[300px] text-[13px] leading-relaxed"
          />

          {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-[13px] text-destructive">{error}</div>}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] tabular-nums text-muted-foreground">{words ? `${words} words` : ''}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResumeText('');
                  setFileName(null);
                  setOpen(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || reading || !resumeText.trim()}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? 'Saving' : 'Save resume'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
