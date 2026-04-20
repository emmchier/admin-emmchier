 'use client';
 
 import * as React from 'react';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 
 export function ConfirmDiscardDialog(props: {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   title?: string;
   description?: string;
   discardLabel?: string;
   cancelLabel?: string;
   onDiscard: () => void;
 }) {
   const {
     open,
     onOpenChange,
     onDiscard,
     title = 'Discard changes?',
     description = 'You have unsaved changes. If you close now, they will be lost.',
     discardLabel = 'Discard changes',
     cancelLabel = 'Keep editing',
   } = props;
 
   return (
     <AlertDialog open={open} onOpenChange={onOpenChange}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle>{title}</AlertDialogTitle>
           <AlertDialogDescription>{description}</AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
           <AlertDialogAction
             className="bg-amber-600 hover:bg-amber-600/90 focus-visible:ring-amber-600"
             onClick={(e) => {
               e.preventDefault();
               onDiscard();
             }}
           >
             {discardLabel}
           </AlertDialogAction>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
   );
 }
