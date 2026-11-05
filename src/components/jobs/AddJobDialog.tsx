/**
 * Add Job Dialog Component
 * Pattern from Resume Matcher's manual-add-application-dialog.tsx
 */

import { useState } from 'react';
import { Plus } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createJobApplication } from '@/lib/jobs/job-service';

interface AddJobDialogProps {
  userId: string;
  onAdded: () => void;
  /** Optional controlled mode (parent renders its own trigger button) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddJobDialog({ userId, onAdded, open: controlledOpen, onOpenChange }: AddJobDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => (isControlled ? onOpenChange?.(value) : setInternalOpen(value));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [closesOn, setClosesOn] = useState('');

  const reset = () => {
    setJobTitle('');
    setCompany('');
    setLocation('');
    setJobUrl('');
    setDescription('');
    setRequirements('');
    setSalaryMin('');
    setSalaryMax('');
    setError(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!jobTitle.trim() || !company.trim() || !description.trim()) {
      setError('Job title, company, and description are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createJobApplication(userId, {
        job_title: jobTitle.trim(),
        company: company.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        job_url: jobUrl.trim() || undefined,
        requirements: requirements.trim() || undefined,
        salary_min: salaryMin ? parseInt(salaryMin) : undefined,
        salary_max: salaryMax ? parseInt(salaryMax) : undefined,
        source: 'manual',
        // End of the closing day, local time. Ropi plans the application before it.
        deadline: closesOn ? new Date(closesOn + 'T17:00:00').toISOString() : undefined,
      });

      reset();
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setSubmitting(false);
    }
  };

  // Prevent Enter from bubbling to dialog (Resume Matcher pattern)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.stopPropagation();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4" />
            Add Job
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Job to Pipeline</DialogTitle>
          <DialogDescription>
            Add the details to score your fit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Required fields */}
          <div className="space-y-2">
            <Label htmlFor="job-title">
              Job Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">
              Company <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Anthropic"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Job Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Paste the full job description here..."
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Optional fields */}
          <div className="space-y-2">
            <Label htmlFor="closes-on">Applications close (optional)</Label>
            <Input
              id="closes-on"
              type="date"
              value={closesOn}
              onChange={(e) => setClosesOn(e.target.value)}
              disabled={submitting}
              className="w-auto"
            />
            <p className="text-[12px] text-muted-foreground">Ropi books 30 minutes in your week to apply before it closes.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Remote, San Francisco"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-url">Job URL (optional)</Label>
              <Input
                id="job-url"
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements (optional)</Label>
            <Textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Required skills and qualifications..."
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary-min">Min Salary (optional)</Label>
              <Input
                id="salary-min"
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="100000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary-max">Max Salary (optional)</Label>
              <Input
                id="salary-max"
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="150000"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !jobTitle || !company || !description}
          >
            {submitting ? 'Adding...' : 'Add Job'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
