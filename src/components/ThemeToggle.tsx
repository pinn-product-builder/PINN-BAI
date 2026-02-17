import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useColorMode } from '@/hooks/useColorMode';

const ThemeToggle = () => {
  const { isDark, toggle } = useColorMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl"
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
};

export default ThemeToggle;
