/** Normalized profile image from HUB `resume.profileImage` (Asset). */
export type HubCVProfileImage = {
  id: string;
  url: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  contentType: string | null;
};

export type HubCVSocialNetwork = {
  id: string;
  platform: string;
  url: string;
  username: string;
};

export type HubCVContact = {
  email: string;
  socialNetworks: HubCVSocialNetwork[];
};

export type HubCVExperience = {
  id: string;
  companyEn: string;
  companyEs: string;
  roleEn: string;
  roleEs: string;
  startDate: string;
  endDate: string;
  descriptionEn: string;
  descriptionEs: string;
};

export type HubCVCourse = {
  id: string;
  companyEn: string;
  companyEs: string;
  titleEn: string;
  titleEs: string;
  startDate: string;
  endDate: string;
  descriptionEn: string;
  descriptionEs: string;
};

export type HubCVStudy = {
  id: string;
  schoolEn: string;
  schoolEs: string;
  titleEn: string;
  titleEs: string;
  startDate: string;
  endDate: string;
};

export type HubCVLanguage = {
  id: string;
  nameEn: string;
  nameEs: string;
  levelEn: string;
  levelEs: string;
};

/**
 * Full HUB CV in one Delivery round-trip (`resume` + `include: 2`).
 * Keys match UI / consumer expectations (arrays even when the model uses single links).
 */
export type HubCVPayload = {
  /** First published `resume` entry id, if any */
  resumeId: string | null;
  profileImage: HubCVProfileImage | null;
  experience: HubCVExperience[];
  courses: HubCVCourse[];
  studies: HubCVStudy[];
  languages: HubCVLanguage[];
  contact: HubCVContact | null;
};
