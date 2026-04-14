export type PreviewOpenRequest =
  | { kind: 'original'; file: File; alt: string }
  | { kind: 'processed'; url: string; alt: string };
