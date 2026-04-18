'use client';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast
          key={id}
          {...props}
          className={cn('flex-nowrap', props.className)}
        >
          <div className="grid min-w-0 flex-1 gap-1 pr-8">
            {title ? (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToastTitle className="line-clamp-2 wrap-break-word">
                      {title}
                    </ToastTitle>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-sm whitespace-pre-wrap"
                  >
                    {title}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {description ? (
              <ToastDescription>{description}</ToastDescription>
            ) : null}
          </div>
          {action ? (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
