'use client';

import * as React from 'react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import type { EntryEditorLabels } from '@/components/cms/EntryEditor';
import type { HubTab } from '@/lib/hub-models';
import { HubCvPanel } from '@/components/dashboard/hub/HubCvPanel';
import { HubEntityDashboard } from '@/components/dashboard/hub/HubEntityDashboard';

type EntityCfg = {
  contentTypeId: string;
  primaryFieldId: string;
  displayTitleFieldId?: string;
  entityPluralLabel: string;
  newLabel: string;
  editorLabels: Partial<EntryEditorLabels>;
};

export function HubWorkspace(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  activeTab: HubTab;
}) {
  const { entryLocale, contentfulSpaceId, actions, activeTab } = props;

  if (activeTab === 'cv') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-4">
        <HubCvPanel />
      </div>
    );
  }

  const entity = HUB_ENTITY_CONFIG[activeTab];
  if (!entity) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-4">
      <HubEntityDashboard
        entryLocale={entryLocale}
        contentfulSpaceId={contentfulSpaceId}
        actions={actions}
        contentTypeId={entity.contentTypeId}
        primaryFieldId={entity.primaryFieldId}
        displayTitleFieldId={entity.displayTitleFieldId}
        entityPluralLabel={entity.entityPluralLabel}
        newLabel={entity.newLabel}
        editorLabels={entity.editorLabels}
      />
    </div>
  );
}

const HUB_ENTITY_CONFIG: Record<Exclude<HubTab, 'cv'>, EntityCfg> = {
  resume: {
    contentTypeId: 'resume',
    primaryFieldId: '__entryId__',
    displayTitleFieldId: '__entryId__',
    entityPluralLabel: 'Resume',
    newLabel: 'New resume',
    editorLabels: {
      createSubtitle: 'Nuevo resume',
      createEmptyTitle: 'Nuevo resume',
      editEmptyTitle: 'Resume',
      publishToast: 'Resume publicado',
      unpublishToast: 'Resume oculto',
      deleteDialogTitle: 'Eliminar resume',
      deleteDialogDescription: (t) => `¿Eliminar el resume '${t}'?`,
    },
  },
  experience: {
    contentTypeId: 'experience',
    primaryFieldId: 'roleEn',
    displayTitleFieldId: 'roleEn',
    entityPluralLabel: 'Experience',
    newLabel: 'New experience',
    editorLabels: {
      createSubtitle: 'Nueva experiencia',
      createEmptyTitle: 'Nueva experiencia',
      editEmptyTitle: 'Experiencia',
      publishToast: 'Experiencia publicada',
      unpublishToast: 'Experiencia oculta',
      deleteDialogTitle: 'Eliminar experiencia',
      deleteDialogDescription: (t) => `¿Eliminar la experiencia '${t}'?`,
    },
  },
  course: {
    contentTypeId: 'course',
    primaryFieldId: 'titleEn',
    displayTitleFieldId: 'titleEn',
    entityPluralLabel: 'Courses',
    newLabel: 'New course',
    editorLabels: {
      createSubtitle: 'Nuevo curso',
      createEmptyTitle: 'Nuevo curso',
      editEmptyTitle: 'Curso',
      publishToast: 'Curso publicado',
      unpublishToast: 'Curso oculto',
      deleteDialogTitle: 'Eliminar curso',
      deleteDialogDescription: (t) => `¿Eliminar el curso '${t}'?`,
    },
  },
  study: {
    contentTypeId: 'study',
    primaryFieldId: 'titleEn',
    displayTitleFieldId: 'titleEn',
    entityPluralLabel: 'Studies',
    newLabel: 'New study',
    editorLabels: {
      createSubtitle: 'Nuevo estudio',
      createEmptyTitle: 'Nuevo estudio',
      editEmptyTitle: 'Estudio',
      publishToast: 'Estudio publicado',
      unpublishToast: 'Estudio oculto',
      deleteDialogTitle: 'Eliminar estudio',
      deleteDialogDescription: (t) => `¿Eliminar el estudio '${t}'?`,
    },
  },
  language: {
    contentTypeId: 'language',
    primaryFieldId: 'nameEn',
    displayTitleFieldId: 'nameEn',
    entityPluralLabel: 'Languages',
    newLabel: 'New language',
    editorLabels: {
      createSubtitle: 'Nuevo idioma',
      createEmptyTitle: 'Nuevo idioma',
      editEmptyTitle: 'Idioma',
      publishToast: 'Idioma publicado',
      unpublishToast: 'Idioma oculto',
      deleteDialogTitle: 'Eliminar idioma',
      deleteDialogDescription: (t) => `¿Eliminar el idioma '${t}'?`,
    },
  },
  contact: {
    contentTypeId: 'contact',
    primaryFieldId: 'email',
    displayTitleFieldId: 'email',
    entityPluralLabel: 'Contacts',
    newLabel: 'New contact',
    editorLabels: {
      createSubtitle: 'Nuevo contacto',
      createEmptyTitle: 'Nuevo contacto',
      editEmptyTitle: 'Contacto',
      publishToast: 'Contacto publicado',
      unpublishToast: 'Contacto oculto',
      deleteDialogTitle: 'Eliminar contacto',
      deleteDialogDescription: (t) => `¿Eliminar el contacto '${t}'?`,
    },
  },
  socialNetwork: {
    contentTypeId: 'socialNetwork',
    primaryFieldId: 'platform',
    displayTitleFieldId: 'platform',
    entityPluralLabel: 'Social networks',
    newLabel: 'New social',
    editorLabels: {
      createSubtitle: 'Nueva red',
      createEmptyTitle: 'Nueva red',
      editEmptyTitle: 'Red social',
      publishToast: 'Red publicada',
      unpublishToast: 'Red oculta',
      deleteDialogTitle: 'Eliminar red',
      deleteDialogDescription: (t) => `¿Eliminar la red '${t}'?`,
    },
  },
  tech: {
    contentTypeId: 'tech',
    primaryFieldId: 'nameEn',
    displayTitleFieldId: 'nameEn',
    entityPluralLabel: 'Tech',
    newLabel: 'New tech',
    editorLabels: {
      createSubtitle: 'Nueva tech',
      createEmptyTitle: 'Nueva tech',
      editEmptyTitle: 'Tech',
      publishToast: 'Tech publicada',
      unpublishToast: 'Tech oculta',
      deleteDialogTitle: 'Eliminar tech',
      deleteDialogDescription: (t) => `¿Eliminar la tech '${t}'?`,
    },
  },
};
