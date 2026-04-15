export type ArtModel = 'project' | 'category' | 'navigationGroup' | 'tech';

export const ART_MODEL_LABELS: Record<ArtModel, string> = {
  project: 'Project',
  category: 'Category',
  navigationGroup: 'Navigation Group',
  tech: 'Tech',
};

export const ART_MODELS: ArtModel[] = ['project', 'category', 'navigationGroup', 'tech'];

export type ArtModelTabState = {
  active: ArtModel;
  onChange: (model: ArtModel) => void;
};
