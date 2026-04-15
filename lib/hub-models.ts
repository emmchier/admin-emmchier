export type HubTab =
  | 'cv'
  | 'resume'
  | 'experience'
  | 'course'
  | 'study'
  | 'language'
  | 'contact'
  | 'socialNetwork'
  | 'tech';

export const HUB_TAB_LABELS: Record<HubTab, string> = {
  cv: 'CV',
  resume: 'Resume',
  experience: 'Experience',
  course: 'Courses',
  study: 'Studies',
  language: 'Languages',
  contact: 'Contact',
  socialNetwork: 'Social',
  tech: 'Tech',
};

export const HUB_TABS: HubTab[] = [
  'cv',
  'resume',
  'experience',
  'course',
  'study',
  'language',
  'contact',
  'socialNetwork',
  'tech',
];
