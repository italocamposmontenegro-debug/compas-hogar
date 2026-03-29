import logoFull from '../../assets/logo.svg';
import logoIcon from '../../assets/logo-icon.svg';

type BrandLogoProps = {
  mode?: 'full' | 'icon';
  className?: string;
  alt?: string;
  decorative?: boolean;
};

export function BrandLogo({
  mode = 'full',
  className = '',
  alt = 'Compás Hogar',
  decorative = false,
}: BrandLogoProps) {
  const src = mode === 'icon' ? logoIcon : logoFull;

  return (
    <img
      src={src}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
