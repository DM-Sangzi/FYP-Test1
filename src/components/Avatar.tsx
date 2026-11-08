import { useState } from 'react';
import type { AvatarColor } from '../types';
import styles from './Avatar.module.css';

interface AvatarProps {
  initials: string;
  color: AvatarColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  /** Accessible label for the avatar (usually the contact's name). */
  name: string;
  /** Photo to show instead of the initials (JPEG data URL). When absent,
   *  or when the image fails to load, the initials remain visible. */
  src?: string;
}

const SIZE_MAP = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 88,
} as const;

/**
 * Circular avatar showing a photo or contact initials, with an optional
 * online dot. Colour is driven by the `--avatar-*` design tokens; initials
 * are always rendered underneath the photo so a failed load falls back
 * cleanly instead of showing a broken image.
 */
export function Avatar({ initials, color, size = 'md', online = false, name, src }: AvatarProps) {
  const px = SIZE_MAP[size];
  const [imgFailed, setImgFailed] = useState(false);
  // A fresh src retries the image (a previously failed one doesn't stick).
  // Adjusting state during render, per react.dev — no effect needed.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setImgFailed(false);
  }
  const showImage = src !== undefined && !imgFailed;

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
      {showImage && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={styles.img}
          onError={() => setImgFailed(true)}
        />
      )}
      {online && <span className={`${styles.dot} ${styles[`${size}Dot`]}`} aria-hidden="true" />}
    </span>
  );
}
