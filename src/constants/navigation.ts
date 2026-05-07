import type { ActivePanel, IconName } from '../types';

export type BottomTabItem = {
  id: ActivePanel;
  label: string;
  icon: IconName;
};

export const bottomTabs: BottomTabItem[] = [
  { id: 'flow', label: 'Flow', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'library', label: 'Library', icon: 'albums' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];
