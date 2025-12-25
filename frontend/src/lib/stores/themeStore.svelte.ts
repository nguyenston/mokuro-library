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
        dark: ['#0f172a', '#1e293b', '#334155', '#6366f1', '#334155'],
        light: ['#f8fafc', '#ffffff', '#e2e8f0', '#4f46e5', '#cbd5e1']
      },
      colors: {
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
          'main-background': '#f8fafc', // slate-50
          'card-background': '#ffffff', // white
          'card-highlight': '#f1f5f9', // slate-100
          'border-color': '#e2e8f0', // slate-200
          'primary-color': '#4f46e5', // indigo-600
          'primary-hover': '#4338ca', // indigo-700
          'primary-surface': '#e0e7ff', // indigo-100
          'main-text': '#020617', // slate-950 (Deepest Slate, nearly black)
          'muted-text': '#334155', // slate-700 (Much darker than before)
          'reading-color': '#4f46e5'
        }
      }
    },
    {
      id: 'catppuccin',
      name: 'Catppuccin',
      previewColors: {
        dark: ['#1e1e2e', '#181825', '#313244', '#587dbd', '#242f4a'],
        light: ['#eff1f5', '#e6e9ef', '#ccd0da', '#1e66f5', '#bcc0cc']
      },
      colors: {
        dark: {
          'main-background': '#1e1e2e',    // Mocha Base
          'card-background': '#181825',    // Mocha Mantle
          'card-highlight': '#313244',     // Mocha Surface0
          'border-color': '#313244',       // Mocha Surface0
          'primary-color': '#587dbd',      // Accessible Blue (4.58:1 Contrast)
          'primary-hover': '#4c6fb8',      // Darkened Blue for interaction
          'primary-surface': '#242f4a',    // Deep Blue Surface (Mocha Overlay0/1 mix)
          'main-text': '#cdd6f4',          // Mocha Text
          'muted-text': '#bac2de',         // Mocha Subtext1
          'reading-color': '#587dbd'       // Accessible Blue
        },
        light: {
          'main-background': '#eff1f5',    // Latte Base
          'card-background': '#ffffff',    // White
          'card-highlight': '#ccd0da',     // Latte Surface0
          'border-color': '#bcc0cc',       // Latte Surface1
          'primary-color': '#1e66f5',      // Latte Blue
          'primary-hover': '#179299',      // Latte Teal
          'primary-surface': '#dce0e8',    // Latte Crust
          'main-text': '#181825',          // Mantle (for high contrast text)
          'muted-text': '#4c4f69',         // Latte Text (muted)
          'reading-color': '#1e66f5'       // Latte Blue
        }
      }
    },
    {
      id: 'dracula',
      name: 'Dracula',
      previewColors: {
        dark: ['#282a36', '#343746', '#44475a', '#bd93f9', '#44475a'],
        light: ['#f8f8f2', '#ffffff', '#e2e2e2', '#9333ea', '#d1d5db']
      },
      colors: {
        dark: {
          'main-background': '#282a36',
          'card-background': '#343746',
          'card-highlight': '#44475a',
          'border-color': '#44475a',
          'primary-color': '#bd93f9',
          'primary-hover': '#ff79c6',
          'primary-surface': '#463f5d',
          'main-text': '#f8f8f2',
          'muted-text': '#6272a4',
          'reading-color': '#bd93f9'
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
        light: ['#f2efe1', '#e4dec5', '#d2cbb2', '#af3a03', '#d2cbb2']
      },
      colors: {
        dark: {
          'main-background': '#282828',    // Dark0
          'card-background': '#3c3836',    // Dark1
          'card-highlight': '#504945',     // Dark2
          'border-color': '#504945',       // Dark2
          'primary-color': '#fe8019',      // Bright Orange
          'primary-hover': '#d65d0e',      // Neutral Orange
          'primary-surface': '#533926',    // Darkened Orange Surface
          'main-text': '#ebdbb2',          // Light1
          'muted-text': '#a89984',         // Gray
          'reading-color': '#fe8019'
        },
        light: {
          'main-background': '#f2efe1',    // Desaturated Cream (More "Paper" than "Lemon")
          'card-background': '#e4dec5',    // Desaturated Beige
          'card-highlight': '#d2cbb2',     // Desaturated Darker Beige
          'border-color': '#b6af9a',       // Adjusted Border
          'primary-color': '#af3a03',      // Dark Orange
          'primary-hover': '#9d3202',      // Deep Rust
          'primary-surface': '#ebe5cf',    // Desaturated Tinted Surface
          'main-text': '#1c1917',          // Stone-900
          'muted-text': '#57534e',         // Stone-600
          'reading-color': '#af3a03'
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
      'main-background': '#f8fafc', // slate-50
      'card-background': '#ffffff', // white
      'card-highlight': '#f1f5f9', // slate-100
      'border-color': '#e2e8f0', // slate-200
      'primary-color': '#4f46e5', // indigo-600
      'primary-hover': '#4338ca', // indigo-700
      'primary-surface': '#e0e7ff', // indigo-100 (Fixed from dark color)
      'main-text': '#020617', // slate-950 (high contrast)
      'muted-text': '#475569', // slate-600 (improved contrast)
      'reading-color': '#4f46e5'
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
        'main-background': '#f8fafc', // slate-50
        'card-background': '#ffffff', // white
        'card-highlight': '#f1f5f9', // slate-100
        'border-color': '#e2e8f0', // slate-200
        'primary-color': '#4f46e5', // indigo-600
        'primary-hover': '#4338ca', // indigo-700
        'primary-surface': '#e0e7ff', // indigo-100
        'main-text': '#020617', // slate-950 (high contrast)
        'muted-text': '#475569', // slate-600 (improved contrast)
        'reading-color': '#4f46e5'
      }
    };
    if (this.isCustomThemeEnabled) {
      this.applyCustomTheme();
    }
  }
}

export const themeStore = new ThemeStore();

