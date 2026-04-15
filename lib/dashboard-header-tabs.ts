/** Shared header tab strip (ART models, HUB sections, etc.) */
export type DashboardHeaderTabs = {
  active: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  ariaLabel: string;
};
