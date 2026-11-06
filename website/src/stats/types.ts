export interface Group {
  key: string;
  count: number;
  share: number;
}

export interface Breakdown {
  published: boolean;
  groups: Group[];
  other: number;
  unshared: number;
}

export interface ReleaseDownloads {
  tag: string;
  publishedAt: string | null;
  prerelease: boolean;
  total: number;
  variants: Record<string, number>;
}

export interface Downloads {
  available: boolean;
  fetchedAt?: string;
  stale?: boolean;
  total?: number;
  byVariant?: Record<string, number>;
  releases?: ReleaseDownloads[];
  history: { day: string; total: number }[];
}

export interface PublicStats {
  generatedAt: string;
  minGroupSize: number;
  retentionDays: number;
  active: { daily: number; weekly: number; monthly: number };
  countries: Breakdown;
  androidVersions: Breakdown;
  appVersions: Breakdown;
  variants: Breakdown;
  history: {
    daily: { day: string; count: number }[];
    monthly: { month: string; count: number }[];
  };
  downloads: Downloads | null;
}
