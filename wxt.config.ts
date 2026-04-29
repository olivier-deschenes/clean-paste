import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Clean Paste',
    description: 'Automatically paste plain text on the sites you choose.',
    permissions: ['storage', 'tabs', 'scripting', 'activeTab'],
    action: {
      default_title: 'Toggle Clean Paste for this site',
    },
  },
});
