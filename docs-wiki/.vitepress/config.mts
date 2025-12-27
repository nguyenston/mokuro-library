import { defineConfig } from 'vitepress';

export default defineConfig({
  // CRITICAL: This MUST be set for GitHub Pages deployment
  base: '/mokuro-library/',

  title: 'Mokuro Library',
  description: 'Self-hosted manga library with OCR reading capabilities',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/mokuro-library/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0f172a' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    // Appearance toggle
    appearance: 'dark', // Enable dark mode by default with toggle

    // Navigation bar
    nav: [
      { text: 'Guide', link: '/installation' },
      { text: 'Features', link: '/#features' },
      { text: 'GitHub', link: 'https://github.com/nguyenston/mokuro-library' }
    ],

    // Sidebar for the user guide
    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Installation & Deployment', link: '/installation' },
          { text: 'Authentication', link: '/authentication' },
        ]
      },
      {
        text: 'Library Management',
        collapsed: false,
        items: [
          { text: 'Managing Your Library', link: '/managing-your-library' },
          { text: 'Organizing Content', link: '/organizing-content' },
        ]
      },
      {
        text: 'Reading & Editing',
        collapsed: false,
        items: [
          { text: 'Using the Reader', link: '/using-the-reader' },
          { text: 'Editing OCR Text', link: '/ocr-editing' },
        ]
      },
      {
        text: 'Customization',
        collapsed: false,
        items: [
          { text: 'Appearance Settings', link: '/appearance-settings' },
          { text: 'Reader Settings', link: '/reader-settings' },
        ]
      }
    ],

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nguyenston/mokuro-library' }
    ],

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Built with ❤️ for manga readers'
    },

    // Search - Enhanced local search
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search documentation'
              },
              modal: {
                displayDetails: 'Display detailed list',
                resetButtonTitle: 'Reset search',
                backButtonTitle: 'Close search',
                noResultsText: 'No results for',
                footer: {
                  selectText: 'to select',
                  selectKeyAriaLabel: 'enter',
                  navigateText: 'to navigate',
                  navigateUpKeyAriaLabel: 'up arrow',
                  navigateDownKeyAriaLabel: 'down arrow',
                  closeText: 'to close',
                  closeKeyAriaLabel: 'escape'
                }
              }
            }
          }
        }
      }
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/nguyenston/mokuro-library/edit/master/docs-wiki/:path',
      text: 'Edit this page on GitHub'
    }
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  }
});
