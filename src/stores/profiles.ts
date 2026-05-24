import { defineStore } from 'pinia';
import { getCryptocurrencyById } from '../data/miningCatalog';
import type { MiningConfig, SavedMiningProfile } from '../types/mining';

const profilesKey = 'androminer-profiles';

interface ProfilesState {
  profiles: SavedMiningProfile[];
  activeProfileId: string;
  loaded: boolean;
}

const cloneConfig = (config: MiningConfig): MiningConfig => {
  const catalogCoin = getCryptocurrencyById(config.coin.id) || config.coin;

  return {
    ...config,
    coin: { ...catalogCoin, poolExamples: [...(catalogCoin.poolExamples || [])] }
  };
};

const readProfiles = (): SavedMiningProfile[] => {
  try {
    const raw = localStorage.getItem(profilesKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedMiningProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeProfiles = (profiles: SavedMiningProfile[]): void => {
  localStorage.setItem(profilesKey, JSON.stringify(profiles));
};

export const useProfilesStore = defineStore('profiles', {
  state: (): ProfilesState => ({
    profiles: [],
    activeProfileId: '',
    loaded: false
  }),
  getters: {
    profilesByCoin:
      (state) =>
      (coinId: string): SavedMiningProfile[] =>
        state.profiles.filter((profile) => profile.coinId === coinId),
    activeProfile: (state): SavedMiningProfile | undefined =>
      state.profiles.find((profile) => profile.id === state.activeProfileId)
  },
  actions: {
    load(): void {
      if (this.loaded) {
        return;
      }

      this.profiles = readProfiles();
      this.activeProfileId =
        localStorage.getItem(`${profilesKey}:active`) || this.profiles[0]?.id || '';
      this.loaded = true;
    },
    persist(): void {
      writeProfiles(this.profiles);
      localStorage.setItem(`${profilesKey}:active`, this.activeProfileId);
    },
    saveFromConfig(name: string, config: MiningConfig): SavedMiningProfile {
      const now = new Date().toISOString();
      const profile: SavedMiningProfile = {
        id: crypto.randomUUID(),
        name,
        coinId: config.coin.id,
        createdAt: now,
        updatedAt: now,
        config: cloneConfig(config)
      };

      this.profiles.unshift(profile);
      this.activeProfileId = profile.id;
      this.persist();
      return profile;
    },
    createDefaults(config: MiningConfig): void {
      this.saveFromConfig('Profile 1', config);
    },
    renameProfile(id: string, name: string): void {
      const profile = this.profiles.find((item) => item.id === id);
      const trimmed = name.trim();

      if (!profile || !trimmed) {
        return;
      }

      profile.name = trimmed;
      profile.updatedAt = new Date().toISOString();
      this.persist();
    },
    saveActiveConfig(config: MiningConfig): void {
      if (!this.activeProfileId) {
        this.saveFromConfig('Profile 1', config);
        return;
      }

      this.updateProfile(this.activeProfileId, config);
    },
    updateProfile(id: string, config: MiningConfig): void {
      const index = this.profiles.findIndex((profile) => profile.id === id);
      if (index === -1) {
        return;
      }

      this.profiles[index] = {
        ...this.profiles[index],
        coinId: config.coin.id,
        updatedAt: new Date().toISOString(),
        config: cloneConfig(config)
      };
      this.persist();
    },
    duplicateProfile(id: string): void {
      const source = this.profiles.find((profile) => profile.id === id);
      if (!source) {
        return;
      }

      const now = new Date().toISOString();
      const copy: SavedMiningProfile = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} Copy`,
        createdAt: now,
        updatedAt: now,
        config: cloneConfig(source.config)
      };
      this.profiles.unshift(copy);
      this.activeProfileId = copy.id;
      this.persist();
    },
    deleteProfile(id: string): void {
      this.profiles = this.profiles.filter((profile) => profile.id !== id);
      if (this.activeProfileId === id) {
        this.activeProfileId = this.profiles[0]?.id || '';
      }
      this.persist();
    },
    setActive(id: string): void {
      this.activeProfileId = id;
      this.persist();
    },
    replaceAll(profiles: SavedMiningProfile[], activeProfileId = ''): void {
      this.profiles = profiles;
      this.activeProfileId = activeProfileId || profiles[0]?.id || '';
      this.persist();
    }
  }
});
