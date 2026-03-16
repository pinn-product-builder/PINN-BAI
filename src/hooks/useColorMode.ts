import { useEffect, useState } from 'react';

export const useColorMode = () => {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('pinn-color-mode');
    if (stored) return stored === 'dark';
    return false; // default light
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('pinn-color-mode', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return { isDark, toggle };
};
