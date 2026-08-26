import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('dark');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        setIsLoading(true);
        let savedTheme = 'system';
        
        // Try to get theme from electron API first
        if (window.electronAPI?.getSettings) {
          try {
            const settings = await window.electronAPI.getSettings();
            if (settings.theme) {
              savedTheme = settings.theme;
            }
          } catch (error) {
            console.error('Failed to load theme from electron:', error);
          }
        }
        
        // Fallback to localStorage
        if (!savedTheme || savedTheme === 'system') {
          const localTheme = localStorage.getItem('offyai-theme');
          if (localTheme) {
            savedTheme = localTheme;
          }
        }
        
        setTheme(savedTheme);
      } catch (error) {
        console.error('Failed to load theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  useEffect(() => {
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setResolvedTheme(systemTheme);
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    if (isLoading) return;

    // Apply theme to document using appUtils
    if (window.appUtils?.applyTheme) {
      window.appUtils.applyTheme(theme);
    } else {
      // Fallback theme application
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolvedTheme);
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
    
    // Store theme preference
    const saveTheme = async () => {
      try {
        localStorage.setItem('offyai-theme', theme);
        
        if (window.electronAPI?.saveSettings) {
          try {
            const currentSettings = await window.electronAPI.getSettings();
            await window.electronAPI.saveSettings({
              ...currentSettings,
              theme: theme
            });
          } catch (error) {
            console.error('Failed to save theme to electron:', error);
          }
        }
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    };

    saveTheme();
  }, [resolvedTheme, theme, isLoading]);

  const value = {
    theme,
    setTheme: (newTheme) => {
      setTheme(newTheme);
    },
    resolvedTheme,
    isLoading,
    toggleTheme: () => {
      setTheme(current => {
        if (current === 'dark') return 'light';
        if (current === 'light') return 'system';
        return 'dark';
      });
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;