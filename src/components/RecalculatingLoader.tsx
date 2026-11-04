/**
 * RecalculatingLoader Component
 * 
 * Shows animated loader with real-time calculation timer
 * Updates at 60fps for smooth counting
 */

import { useEffect, useState } from 'react';
import { Loader2 } from '@/components/icons';
import { Card } from '@/components/ui/card';

interface RecalculatingLoaderProps {
  startTime: number;
  message?: string;
}

export default function RecalculatingLoader({ 
  startTime, 
  message = 'Recalculating schedule' 
}: RecalculatingLoaderProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Update at ~60fps for smooth timer
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 16);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <Card className="p-8 bg-muted/50 border-primary/20">
      <div className="flex flex-col items-center gap-4">
        {/* Spinning loader */}
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        
        {/* Message */}
        <div className="text-center">
          <div className="text-sm font-medium mb-1">
            {message}
          </div>
          
          {/* Real-time timer */}
          <div className="text-xs text-muted-foreground font-mono">
            {elapsed}ms
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Compact inline variant for tight spaces
 */
export function InlineRecalculatingLoader({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 16);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2">
      <Loader2 className="w-4 h-4 text-primary animate-spin" />
      <span className="text-sm text-muted-foreground">
        Recalculating... <span className="font-mono">{elapsed}ms</span>
      </span>
    </div>
  );
}
