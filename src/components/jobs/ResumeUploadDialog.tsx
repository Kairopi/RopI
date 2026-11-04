import { useState } from "react";
import { Upload, FileText } from '@/components/icons';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveBaseResume } from "@/lib/jobs/job-service";

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
  const [resumeText, setResumeText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!resumeText.trim()) {
      setError("Please paste your resume");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      await saveBaseResume(userId, resumeText.trim());
      setResumeText("");
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save resume");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload Base Resume
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload Your Base Resume
          </DialogTitle>
          <DialogDescription>
            Paste your resume text below. This will be used to score jobs and generate tailored versions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Paste your resume here (plain text or structured)..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResumeText("");
                setOpen(false);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={uploading || !resumeText.trim()}>
              {uploading ? "Saving..." : "Save Resume"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
