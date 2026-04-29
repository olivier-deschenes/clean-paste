export const STORAGE_KEY = 'enabledSites';

export function normalizeSite(site: string | null | undefined): string | null {
  if (!site) {
    return null;
  }

  try {
    const url = new URL(site);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeSites(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sites = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalizedSite = normalizeSite(item);

    if (normalizedSite) {
      sites.add(normalizedSite);
    }
  }

  return Array.from(sites).sort((left, right) => left.localeCompare(right));
}

export async function getEnabledSites(): Promise<string[]> {
  const storedSettings = await browser.storage.sync.get(STORAGE_KEY);
  return normalizeSites(storedSettings[STORAGE_KEY]);
}

async function saveEnabledSites(sites: string[]): Promise<string[]> {
  const normalizedSites = normalizeSites(sites);
  await browser.storage.sync.set({ [STORAGE_KEY]: normalizedSites });
  return normalizedSites;
}

export async function setSiteEnabled(
  site: string,
  enabled: boolean,
): Promise<string[]> {
  const normalizedSite = normalizeSite(site);

  if (!normalizedSite) {
    return getEnabledSites();
  }

  const nextSites = new Set(await getEnabledSites());

  if (enabled) {
    nextSites.add(normalizedSite);
  } else {
    nextSites.delete(normalizedSite);
  }

  return saveEnabledSites(Array.from(nextSites));
}

export function isSiteEnabled(
  enabledSites: string[],
  site: string | null | undefined,
): boolean {
  const normalizedSite = normalizeSite(site);
  return normalizedSite ? enabledSites.includes(normalizedSite) : false;
}
