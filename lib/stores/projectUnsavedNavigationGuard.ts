import { create } from 'zustand';
import { useProjectEditorStore } from '@/lib/stores/projectEditorStore';

type State = {
  /** Registered while project entry editor is mounted (EntryEditor project + edit). */
  revertDraftFn: (() => void) | null;
  /** Queued publish/unpublish toggle not yet saved (EntryEditor). */
  unsavedPublishIntent: boolean;
  modalOpen: boolean;
  pendingAction: (() => void) | null;
};

type Actions = {
  setRevertDraftFn: (fn: (() => void) | null) => void;
  /** Run `action` immediately, or open warning modal if project has unsaved edits. */
  requestNavigate: (action: () => void) => void;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
};

export const useProjectUnsavedNavigationGuard = create<State & Actions>((set, get) => ({
  revertDraftFn: null,
  unsavedPublishIntent: false,
  modalOpen: false,
  pendingAction: null,

  setRevertDraftFn: (fn) => set({ revertDraftFn: fn }),

  requestNavigate: (action) => {
    const { revertDraftFn, unsavedPublishIntent } = get();
    const fieldsDirty = useProjectEditorStore.getState().isDirty;
    if (!revertDraftFn || (!fieldsDirty && !unsavedPublishIntent)) {
      action();
      return;
    }
    set({ pendingAction: action, modalOpen: true });
  },

  confirmDiscard: () => {
    const { revertDraftFn, pendingAction } = get();
    revertDraftFn?.();
    set({ modalOpen: false, pendingAction: null });
    queueMicrotask(() => pendingAction?.());
  },

  cancelDiscard: () => set({ modalOpen: false, pendingAction: null }),
}));
