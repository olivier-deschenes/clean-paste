import {
  STORAGE_KEY,
  getEnabledSites,
  isSiteEnabled,
  normalizeSite,
  setSiteEnabled,
} from '@/utils/site-settings';

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    void toggleSiteForTab(tab);
  });

  browser.tabs.onActivated.addListener(() => {
    void refreshAllTabBadges();
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.status && !changeInfo.url) {
      return;
    }

    void updateBadge(tabId, changeInfo.url ?? tab.url);
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEY]) {
      return;
    }

    void refreshAllTabBadges();
  });

  void refreshAllTabBadges();
});

async function refreshAllTabBadges() {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id != null)
      .map((tab) => updateBadge(tab.id!, tab.url)),
  );
}

async function updateBadge(tabId: number, site: string | undefined) {
  const normalizedSite = normalizeSite(site);
  const enabled = normalizedSite
    ? isSiteEnabled(await getEnabledSites(), normalizedSite)
    : false;

  await browser.action.setBadgeText({
    tabId,
    text: enabled ? 'ON' : 'OFF',
  });

  await browser.action.setBadgeBackgroundColor({
    tabId,
    color: enabled ? '#16a34a' : '#dc2626',
  });

  await browser.action.setTitle({
    tabId,
    title: normalizedSite
      ? enabled
        ? 'Clean Paste is enabled for this site. Click to disable.'
        : 'Clean Paste is disabled for this site. Click to enable.'
      : "Clean Paste can't run on this page.",
  });
}

async function toggleSiteForTab(tab: { id?: number; url?: string }) {
  if (tab.id == null) {
    return;
  }

  const site = normalizeSite(tab.url);

  if (!site) {
    await updateBadge(tab.id, tab.url);
    return;
  }

  const enabledSites = await getEnabledSites();
  const nextEnabled = !isSiteEnabled(enabledSites, site);

  if (nextEnabled) {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/content.js'],
    });
  }

  await setSiteEnabled(site, nextEnabled);
  await updateBadge(tab.id, tab.url);
}
