import { browser } from '$app/environment';

export interface ThemeColors {
  'main-background': string;
  'card-background': string;
  'card-highlight': string;
  'border-color': string;
  'primary-color': string;
  'primary-surface': string;
  'primary-hover': string;
  'main-text': string;
  'muted-text': string;
  'reading-color': string;
}

export interface Theme {
  id: string;
  name: string;
  colors: {
    dark: ThemeColors;
    light: ThemeColors;
  };
  previewColors: {
    dark: [string, string, string, string, string]; // 5 colors: main-bg, card-bg, card-highlight, primary, border
    light: [string, string, string, string, string];
  };
}

class ThemeStore {
  // Current theme
  currentTheme = $state<Theme | null>(null);

  // Color mode: 'dark' | 'light' | 'system'
  colorMode = $state<'dark' | 'light' | 'system'>('system');

  // Resolved color mode (dark or light, never system)
  // This is a getter that checks system preference when mode is 'system'
  getResolvedColorMode(): 'dark' | 'light' {
    if (this.colorMode === 'system' && typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.colorMode as 'dark' | 'light';
  }

  // Available themes
  themes = $state<Theme[]>([
    {
      id: 'mokuro',
      name: 'Mokuro',
      previewColors: {
        dark: ['#0f172a', '#1e293b', '#334155', '#6366f1', '#334155'], // main-bg, card-bg, card-highlight, primary, border
        light: ['#334155', '#475569', '#64748b', '#6366f1', '#64748b'] // lighter slate tones maintaining the dark theme character
      },
      colors: {
        dark: {
          'main-background': '#0f172a', // slate-900
          'card-background': '#1e293b', // slate-800
          'card-highlight': '#334155', // slate-700
          'border-color': '#334155', // slate-700
          'primary-color': '#6366f1', // indigo-500
          'primary-hover': '#4f46e5', // indigo-600
          'primary-surface': '#202752', // tinted slate-950/indigo-900 blend
          'main-text': '#f1f5f9', // slate-100
          'muted-text': '#94a3b8', // slate-400
          'reading-color': '#6366f1' // indigo-500
        },
        light: {
          'main-background': '#334155', // slate-700
          'card-background': '#475569', // slate-600
          'card-highlight': '#64748b', // slate-500
          'border-color': '#64748b', // slate-500
          'primary-color': '#6366f1', // indigo-500
          'primary-hover': '#818cf8', // indigo-400
          'primary-surface': '#3d4974', // tinted slate-800/indigo-800 blend
          'main-text': '#f1f5f9', // slate-100
          'muted-text': '#cbd5e1', // slate-300
          'reading-color': '#6366f1' // indigo-500
        }
      }
    },
    {
      id: 'catppuccin',
      name: 'Catppuccin',
      previewColors: {
        dark: ['#1e1e2e', '#181825', '#313244', '#89b4fa', '#313244'],
        light: ['#5b5f7d', '#6e738d', '#8b8fa8', '#1e66f5', '#8b8fa8']
      },
      colors: {
        dark: {
          'main-background': '#1e1e2e', // base (Mocha)
          'card-background': '#181825', // mantle (Mocha)
          'card-highlight': '#313244', // surface0 (Mocha)
          'border-color': '#313244', // surface0 (Mocha)
          'primary-color': '#89b4fa', // blue (Mocha)
          'primary-hover': '#74c7ec', // sapphire (Mocha)
          'primary-surface': '#333c57', // tinted base/blue blend
          'main-text': '#cdd6f4', // text (Mocha)
          'muted-text': '#bac2de', // subtext1 (Mocha)
          'reading-color': '#89b4fa' // blue (Mocha)
        },
        light: {
          'main-background': '#5b5f7d', // lighter purple-gray
          'card-background': '#6e738d', // lighter purple-gray for cards
          'card-highlight': '#8b8fa8', // lighter purple-gray for hover
          'border-color': '#8b8fa8', // visible borders
          'primary-color': '#1e66f5', // blue (Latte)
          'primary-hover': '#3584e4', // sapphire (Latte)
          'primary-surface': '#4f6095', // tinted purple-gray/blue blend
          'main-text': '#eff1f5', // base (Latte)
          'muted-text': '#dce0e8', // surface0 (Latte)
          'reading-color': '#1e66f5' // blue (Latte)
        }
      }
    },
    {
      id: 'dracula',
      name: 'Dracula',
      previewColors: {
        dark: ['#282a36', '#343746', '#44475a', '#bd93f9', '#44475a'],
        light: ['#4a5568', '#556270', '#6272a4', '#bd93f9', '#6272a4']
      },
      colors: {
        dark: {
          'main-background': '#282a36', // background
          'card-background': '#343746', // current line
          'card-highlight': '#44475a', // selection
          'border-color': '#44475a', // selection
          'primary-color': '#bd93f9', // purple
          'primary-hover': '#ff79c6', // pink
          'primary-surface': '#463f5d', // tinted background/purple blend
          'main-text': '#f8f8f2', // foreground
          'muted-text': '#6272a4', // comment
          'reading-color': '#bd93f9' // purple
        },
        light: {
          'main-background': '#4a5568', // lighter purple-gray
          'card-background': '#556270', // lighter purple-gray for cards
          'card-highlight': '#6272a4', // even lighter purple-gray for hover
          'border-color': '#6272a4', // visible borders
          'primary-color': '#bd93f9', // purple
          'primary-hover': '#c9a9ff', // lighter purple for hover
          'primary-surface': '#616284', // tinted purple-gray/purple blend
          'main-text': '#f8f8f2', // foreground (cream)
          'muted-text': '#a0a0a0', // lighter muted text
          'reading-color': '#bd93f9' // purple
        }
      }
    },
    {
      id: 'gruvbox',
      name: 'Gruvbox',
      previewColors: {
        dark: ['#282828', '#3c3836', '#504945', '#fe8019', '#504945'],
        light: ['#665c54', '#7c6f64', '#928374', '#d65d0e', '#928374']
      },
      colors: {
        dark: {
          'main-background': '#282828', // bg0
          'card-background': '#3c3836', // bg1
          'card-highlight': '#504945', // bg2
          'border-color': '#504945', // bg2
          'primary-color': '#fe8019', // orange
          'primary-hover': '#d65d0e', // bright_orange
          'primary-surface': '#533926', // tinted bg0/orange blend
          'main-text': '#ebdbb2', // fg
          'muted-text': '#a89984', // gray
          'reading-color': '#fe8019' // orange
        },
        light: {
          'main-background': '#665c54', // lighter warm brown
          'card-background': '#7c6f64', // lighter warm gray for cards
          'card-highlight': '#928374', // even lighter warm gray for hover
          'border-color': '#928374', // visible borders
          'primary-color': '#d65d0e', // bright_orange
          'primary-hover': '#fe8019', // orange
          'primary-surface': '#7d5c46', // tinted warm brown/orange blend
          'main-text': '#fbf1c7', // bg0 (light beige)
          'muted-text': '#d5c4a1', // bg2 (lighter beige)
          'reading-color': '#d65d0e' // bright_orange
        }
      }
    }
  ]);

  // Custom theme colors (when custom theme is enabled)
  customColors = $state<{
    dark: ThemeColors;
    light: ThemeColors;
  }>({
    dark: {
      'main-background': '#0f172a',
      'card-background': '#1e293b',
      'card-highlight': '#334155',
      'border-color': '#334155',
      'primary-color': '#6366f1',
      'primary-surface': '#202752',
      'primary-hover': '#4f46e5',
      'main-text': '#f1f5f9',
      'muted-text': '#94a3b8',
      'reading-color': '#6366f1'
    },
    light: {
      'main-background': '#f8fafc',
      'card-background': '#e2e8f0',
      'card-highlight': '#cbd5e1',
      'border-color': '#cbd5e1',
      'primary-color': '#6366f1',
      'primary-hover': '#4f46e5',
      'primary-surface': '#3d4974',
      'main-text': '#0f172a',
      'muted-text': '#64748b',
      'reading-color': '#6366f1'
    }
  });

  isCustomThemeEnabled = $state(false);

  constructor() {
    // Initialize with Mokuro theme
    this.currentTheme = this.themes[0];

    // Load saved preferences from localStorage
    if (browser) {
      const savedColorMode = localStorage.getItem('mokuro_color_mode');
      if (savedColorMode === 'dark' || savedColorMode === 'light' || savedColorMode === 'system') {
        this.colorMode = savedColorMode;
      }

      const savedTheme = localStorage.getItem('mokuro_theme');
      if (savedTheme) {
        try {
          const theme = JSON.parse(savedTheme);
          if (theme.id === 'custom') {
            this.isCustomThemeEnabled = true;
            this.customColors = theme.colors;
          } else {
            const foundTheme = this.themes.find(t => t.id === theme.id);
            if (foundTheme) {
              this.currentTheme = foundTheme;
            }
          }
        } catch (e) {
          console.error('Failed to load saved theme:', e);
        }
      }

    }

    // Apply initial theme
    this.applyCurrentTheme();

    // Initialize reactive updates
    this.initReactiveUpdates();
  }

  /**
   * Apply theme colors based on current color mode
   */
  applyThemeColors(colors: ThemeColors) {
    if (!browser) return;

    const root = document.documentElement;

    // Map theme colors to CSS variables
    // Main background colors
    root.style.setProperty('--color-theme-main', colors['main-background']);
    root.style.setProperty('--color-theme-surface', colors['card-background']);
    root.style.setProperty('--color-theme-surface-hover', colors['card-highlight']);

    // Border colors
    root.style.setProperty('--color-theme-border', colors['border-color']);
    root.style.setProperty('--color-theme-border-light', colors['border-color']);
    root.style.setProperty('--color-theme-border-active', colors['primary-color']);

    // Text colors
    root.style.setProperty('--color-theme-primary', colors['main-text']);
    root.style.setProperty('--color-theme-secondary', colors['muted-text']);
    root.style.setProperty('--color-theme-tertiary', colors['muted-text']); // Using muted-text for tertiary

    // Accent colors (primary color)
    root.style.setProperty('--color-accent', colors['primary-color']);
    root.style.setProperty('--color-accent-hover', colors['primary-hover']);
    root.style.setProperty('--color-accent-surface', colors['primary-surface']);

    // Reading color (used for progress indicators)
    root.style.setProperty('--color-progress', colors['reading-color']);

    // Note: We do NOT override these colors (they remain fixed):
    // - --color-status-success: #10b981 (green for read status)
    // - --color-status-warning: #f59e0b (yellow for bookmarks)
    // - --color-status-danger: #ef4444 (red for errors)
    // - --color-status-unread: #0ea5e9 (blue for unread)
    // These are functional colors that should remain consistent for accessibility
  }

  /**
   * Apply a theme by setting CSS variables on the document root
   * Maps theme colors to CSS variables used throughout the app
   */
  applyTheme(theme: Theme) {
    const mode = this.getResolvedColorMode();
    this.applyThemeColors(theme.colors[mode]);
  }

  /**
   * Apply current theme (handles custom vs preset)
   */
  applyCurrentTheme() {
    if (this.isCustomThemeEnabled) {
      this.applyCustomTheme();
    } else if (this.currentTheme) {
      this.applyTheme(this.currentTheme);
    }
  }

  /**
   * Apply custom theme colors
   */
  applyCustomTheme() {
    const mode = this.getResolvedColorMode();
    this.applyThemeColors(this.customColors[mode]);
  }

  /**
   * Set color mode (dark, light, or system)
   */
  setColorMode(mode: 'dark' | 'light' | 'system') {
    this.colorMode = mode;
    if (browser) {
      localStorage.setItem('mokuro_color_mode', mode);
    }
    this.applyCurrentTheme();
  }

  /**
   * Initialize reactive theme updates
   * This should be called after the store is created to set up reactive updates
   */
  initReactiveUpdates() {
    if (!browser) return;

    // Watch for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (this.colorMode === 'system') {
        this.applyCurrentTheme();
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  /**
   * Set the active theme
   */
  setTheme(themeId: string) {
    if (themeId === 'custom') {
      this.isCustomThemeEnabled = true;
      this.applyCustomTheme();
      if (browser) {
        localStorage.setItem('mokuro_theme', JSON.stringify({
          id: 'custom',
          colors: this.customColors
        }));
      }
    } else {
      this.isCustomThemeEnabled = false;
      const theme = this.themes.find(t => t.id === themeId);
      if (theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        if (browser) {
          localStorage.setItem('mokuro_theme', JSON.stringify({ id: theme.id }));
        }
      }
    }
  }

  /**
   * Update custom theme color
   */
  updateCustomColor(mode: 'dark' | 'light', key: keyof ThemeColors, value: string) {
    this.customColors[mode][key] = value;
    if (this.isCustomThemeEnabled) {
      this.applyCustomTheme();
      if (browser) {
        localStorage.setItem('mokuro_theme', JSON.stringify({
          id: 'custom',
          colors: this.customColors
        }));
      }
    }
  }

  /**
   * Reset custom colors to default (Mokuro theme)
   */
  resetCustomColors() {
    this.customColors = {
      dark: {
        'main-background': '#0f172a',
        'card-background': '#1e293b',
        'card-highlight': '#334155',
        'border-color': '#334155',
        'primary-color': '#6366f1',
        'primary-hover': '#4f46e5',
        'primary-surface': '#202752',
        'main-text': '#f1f5f9',
        'muted-text': '#94a3b8',
        'reading-color': '#6366f1'
      },
      light: {
        'main-background': '#f8fafc',
        'card-background': '#e2e8f0',
        'card-highlight': '#cbd5e1',
        'border-color': '#cbd5e1',
        'primary-color': '#6366f1',
        'primary-hover': '#4f46e5',
        'primary-surface': '#3d4974',
        'main-text': '#0f172a',
        'muted-text': '#64748b',
        'reading-color': '#6366f1'
      }
    };
    if (this.isCustomThemeEnabled) {
      this.applyCustomTheme();
    }
  }
}

export const themeStore = new ThemeStore();

