import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OrgAvatarProps {
  name: string;
  logoUrl?: string | null;
  /** Tamanho do quadrado em classes Tailwind (ex: "w-10 h-10"). */
  sizeClassName?: string;
  /** Tamanho do texto da letra-fallback. */
  textClassName?: string;
  /** Bordas/raio do container. */
  roundedClassName?: string;
}

/**
 * Avatar consistente para uma organização: mostra `logo_url` quando
 * existe e cai num círculo/quadrado com a inicial do nome quando não.
 *
 * Encapsula o erro de carregamento da imagem (links quebrados ou logo
 * removido) — se der erro, automaticamente volta pra letra inicial.
 */
const OrgAvatar = ({
  name,
  logoUrl,
  sizeClassName = 'w-10 h-10',
  textClassName = 'text-sm',
  roundedClassName = 'rounded-xl',
}: OrgAvatarProps) => {
  const [imgError, setImgError] = useState(false);
  const showLogo = !!logoUrl && !imgError;

  return (
    <div
      className={cn(
        sizeClassName,
        roundedClassName,
        'flex items-center justify-center overflow-hidden shrink-0',
        showLogo ? 'bg-white border border-border' : 'bg-primary/10',
      )}
    >
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`Logo ${name}`}
          className="max-w-full max-h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={cn('font-bold text-primary', textClassName)}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

export default OrgAvatar;
