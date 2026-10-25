import type { AvatarColor } from '../types';
import styles from './Avatar.module.css';

interface AvatarProps {
  initials: string;
  color: AvatarColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  /** Accessible label for the avatar (usually the contact's name). */
  name: string;
}

const SIZE_MAP = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 88,
} as const;

/**
 * Circular avatar showing contact initials, with an optional online dot.
 * Colour is driven by the `--avatar-*` design tokens.
 */
export function Avatar({ initials, color, size = 'md', online = false, name }: AvatarProps) {
  const px = SIZE_MAP[size];
  return (
    <span
      className={styles.avatar}
      style={
        {
          width: px,
          height: px,
          fontSize: px * 0.4,
          '--avatar-color': `var(--avatar-${color})`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={`${name} avatar`}
    >
      {initials.slice(0, 2).toUpperCase()}
      {online && <span className={`${styles.dot} ${styles[`${size}Dot`]}`} aria-hidden="true" />}
    </span>
  );
}
