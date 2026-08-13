import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTheme } from "@/theme/ThemeProvider";

export interface CommandNavItem {
  label: string;
  to: string;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandNavItem[];
}

/**
 * Paleta de comandos (⌘K / Ctrl+K): navegação rápida por todas as telas visíveis
 * da org + troca de tema. Substitui a ausência de busca global no shell antigo.
 * O atalho é registrado no AppShell (dono do estado `open`).
 */
export function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  // Agrupa preservando a ordem de aparição dos grupos.
  const groups: string[] = [];
  for (const item of items) if (!groups.includes(item.group)) groups.push(item.group);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar telas, métricas, organizações…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {items
              .filter((i) => i.group === group)
              .map((i) => (
                <CommandItem key={i.to} value={`${group} ${i.label}`} onSelect={() => go(i.to)}>
                  {i.label}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Tema">
          <CommandItem value="tema claro light" onSelect={() => { setTheme("light"); onOpenChange(false); }}>
            <Sun className="mr-2 h-4 w-4" /> Tema claro
          </CommandItem>
          <CommandItem value="tema escuro dark command center" onSelect={() => { setTheme("dark"); onOpenChange(false); }}>
            <Moon className="mr-2 h-4 w-4" /> Tema escuro
          </CommandItem>
          <CommandItem value="tema sistema" onSelect={() => { setTheme("light"); onOpenChange(false); }}>
            <Monitor className="mr-2 h-4 w-4" /> Padrão (claro)
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
