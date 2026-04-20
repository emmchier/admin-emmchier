 'use client';
 
 import * as React from 'react';
 import {
   Sheet,
   SheetContent,
   SheetFooter,
   SheetHeader,
   SheetScrollBody,
   SheetTitle,
 } from '@/components/ui/sheet';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
 import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
 import { ConfirmDiscardDialog } from '@/components/ui/ConfirmDiscardDialog';
import { derivePlatformFromUrlInput, stripUrlForDisplay, validateSocialUrl } from '@/lib/url/socialUrl';
 
 type Draft = { platform: string; url: string };

 export function HubSocialNetworkSideSheet(props: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   actions: ArtActions;
   onCreated: (id: string) => void | Promise<void>;
 }) {
   const { open, onOpenChange, actions, onCreated } = props;
   const [busy, setBusy] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);
   const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);
 
   const [draft, setDraft] = React.useState<Draft>({ platform: '', url: '' });
   const baselineRef = React.useRef<Draft>({ platform: '', url: '' });
 
   React.useEffect(() => {
     if (!open) return;
     const empty = { platform: '', url: '' };
     setDraft(empty);
     baselineRef.current = empty;
     setError(null);
     setBusy(false);
   }, [open]);
 
   const isDirty = JSON.stringify(draft) !== JSON.stringify(baselineRef.current);
 
  const urlCheck = React.useMemo(() => validateSocialUrl(draft.url), [draft.url]);
  const derivedPlatform = React.useMemo(
    () => derivePlatformFromUrlInput(draft.url),
    [draft.url],
  );
  const canSave = urlCheck.ok && Boolean(derivedPlatform.trim()) && !busy;

   const requestClose = React.useCallback(() => {
     if (busy) return;
    // Only ask to discard when the user could actually save.
    if (isDirty && canSave) {
       setConfirmDiscardOpen(true);
       return;
     }
     onOpenChange(false);
  }, [busy, isDirty, canSave, onOpenChange]);
 
   const save = React.useCallback(async () => {
     if (busy) return;
     setBusy(true);
     setError(null);
     try {
      const urlResult = validateSocialUrl(draft.url);
      if (!urlResult.ok) {
        setError('Invalid URL');
        return;
      }
       const fields = {
        platform: derivedPlatform.trim(),
        url: urlResult.normalized,
       };
       const created = await actions.createEntryAction({ contentTypeId: 'socialNetwork', fields });
       await actions.publishEntryAction(created.id);
      baselineRef.current = { platform: derivedPlatform.trim(), url: stripUrlForDisplay(urlResult.normalized) };
       await onCreated(created.id);
       onOpenChange(false);
     } catch (e) {
       setError(e instanceof Error ? e.message : 'Failed to save');
     } finally {
       setBusy(false);
     }
   }, [actions, busy, draft, onCreated, onOpenChange]);
 
   return (
     <>
       <Sheet
         open={open}
         onOpenChange={(nextOpen) => {
           if (nextOpen) onOpenChange(true);
           else requestClose();
         }}
       >
         <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
             <SheetTitle className="text-base">New Social Network</SheetTitle>
           </SheetHeader>
 
          <SheetScrollBody className="pb-4 pt-2">
             {error ? <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
 
            <div className="grid gap-6">
              <div className="grid gap-2 w-full md:w-1/2">
                <Label className="text-sm">Url</Label>
                <Input
                  value={draft.url}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraft((p) => ({ ...p, url: next }));
                    if (error) setError(null);
                  }}
                />
              </div>
              <div className="grid gap-2 w-full md:w-1/2">
                <Label className="text-sm">Platform</Label>
                <Input value={derivedPlatform} disabled />
              </div>
            </div>
           </SheetScrollBody>
 
           <SheetFooter>
             <div className="flex w-full items-center justify-end gap-2">
               <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>
                 <X className="mr-2 h-4 w-4" />
                 Close
               </Button>
              <Button type="button" onClick={() => void save()} disabled={!urlCheck.ok || !derivedPlatform.trim() || busy}>
                 {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Save
               </Button>
             </div>
           </SheetFooter>
         </SheetContent>
       </Sheet>
 
       <ConfirmDiscardDialog
         open={confirmDiscardOpen}
         onOpenChange={(o) => !o && setConfirmDiscardOpen(false)}
         title="Discard changes?"
         description="You have unsaved changes. If you close now, they will be lost."
         discardLabel="Discard and close"
         cancelLabel="Keep editing"
         onDiscard={() => {
           setConfirmDiscardOpen(false);
           onOpenChange(false);
         }}
       />
     </>
   );
 }
