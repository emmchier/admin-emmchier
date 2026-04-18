export type ArtModel = 'project' | 'category' | 'navigationGroup' | 'tech';

export const ART_MODEL_LABELS: Record<ArtModel, string> = {
  project: 'Projects',
  navigationGroup: 'Project groups',
  category: 'Categories',
  tech: 'Tech',
};

// NOTE: Tech remains an internal entity (used by Project form), but it's not a navigable section in ART.
export const ART_MODELS: ArtModel[] = ['project', 'navigationGroup', 'category'];

export type ArtModelTabState = {
  active: ArtModel;
  onChange: (model: ArtModel) => void;
};
