import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Avatar } from '../Avatar';
import { AvatarImageError, processAvatarFile } from '../../utils/avatarImage';
import styles from './AvatarEditor.module.css';

/** What the one main avatar position shows right now. */
type Preview =
  | { kind: 'saved' } // the persisted value (photo or initials)
  | { kind: 'image'; dataUrl: string } // processed new photo — not saved yet
  | { kind: 'removed' }; // photo will be removed once saved

function errorMessage(err: unknown): string {
  return err instanceof ApiError || err instanceof AvatarImageError
    ? err.message
    : 'Something went wrong. Please try again.';
}

/**
 * Profile photo editor for Settings → Profile (own account only — this is
 * never a way to edit another contact's avatar).
 *
 * One main avatar position: it shows the saved photo (or initials) until a
 * photo is chosen or Remove is pressed, then it previews the pending change
 * with an explicit "not saved yet" note. Choosing a photo or removing never
 * touches the saved value on its own; Save goes through AuthContext → API →
 * handler → userStore, and success is shown only after the API confirmed
 * and the state was updated. Cancel discards a pending preview. Processing
 * and saving disable every conflicting control, and stale asynchronous work
 * (fast re-selections, leaving the page, logout or re-login mid-save) can
 * never repaint the UI.
 */
export function AvatarEditor() {
  const { user, updateAvatar } = useAuth();
  const [preview, setPreview] = useState<Preview>({ kind: 'saved' });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Monotonic token so only the latest selection may set the preview. */
  const selectSeqRef = useRef(0);
  /** Flipped on unmount; late responses after leaving the page are dropped. */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const busy = processing || saving;
  const savedDataUrl = user?.avatarUrl;
  const pendingDataUrl =
    preview.kind === 'image'
      ? preview.dataUrl
      : preview.kind === 'removed'
        ? undefined
        : savedDataUrl;
  const dirty = preview.kind !== 'saved';

  if (!user) return null;

  function choosePhoto() {
    if (busy) return;
    setError(null);
    setSuccess(null);
    fileInputRef.current?.click();
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so choosing the exact same file again still fires change.
    event.target.value = '';
    if (!file || busy) return;
    const seq = ++selectSeqRef.current;
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const dataUrl = await processAvatarFile(file);
      if (!aliveRef.current || seq !== selectSeqRef.current) return;
      setPreview({ kind: 'image', dataUrl });
    } catch (err) {
      // Rejection keeps the saved photo untouched and stays retryable.
      if (!aliveRef.current || seq !== selectSeqRef.current) return;
      setError(errorMessage(err));
    } finally {
      if (aliveRef.current && seq === selectSeqRef.current) setProcessing(false);
    }
  }

  function previewRemoval() {
    if (busy) return;
    setError(null);
    setSuccess(null);
    setPreview({ kind: 'removed' });
  }

  function cancelChanges() {
    if (busy) return;
    setError(null);
    setSuccess(null);
    setPreview({ kind: 'saved' });
  }

  async function saveChanges() {
    if (busy || !dirty) return;
    const pending = preview;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const applied = await updateAvatar(pending.kind === 'removed' ? null : pending.dataUrl);
      if (!aliveRef.current) return;
      if (!applied) {
        // The session changed while saving (logout / fresh login); the stale
        // response was discarded, so fall back to the persisted value.
        setPreview({ kind: 'saved' });
        return;
      }
      setPreview({ kind: 'saved' });
      setSuccess(pending.kind === 'removed' ? 'Photo removed.' : 'Photo saved.');
    } catch (err) {
      // Failure keeps the saved photo exactly as it was; retry is possible.
      if (!aliveRef.current) return;
      setError(errorMessage(err));
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.identity}>
        <Avatar
          initials={user.username.slice(0, 2)}
          color="teal"
          size="lg"
          name={user.username}
          src={pendingDataUrl}
        />
        <div className={styles.identityInfo}>
          <p className={styles.displayName}>{user.username}</p>
          <p className={styles.memberSince}>PQPM member (demo account)</p>
        </div>
      </div>

      {preview.kind === 'image' && (
        <p className={styles.previewNote}>Preview — not saved yet.</p>
      )}
      {preview.kind === 'removed' && (
        <p className={styles.previewNote}>Preview — your photo is removed when you save.</p>
      )}

      <div className={styles.actions}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.fileInput}
          disabled={busy}
          onChange={handleFileChosen}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={choosePhoto}
          disabled={busy}
        >
          <Camera size={16} aria-hidden="true" />
          <span>Choose photo</span>
        </button>
        {savedDataUrl !== undefined && preview.kind !== 'removed' && (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={previewRemoval}
            disabled={busy}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>Remove photo</span>
          </button>
        )}
        {dirty && (
          <>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void saveChanges()}
              disabled={busy}
            >
              Save photo
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={cancelChanges}
              disabled={busy}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {success && (
        <p className={styles.successText} role="status">
          {success}
        </p>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}

      <p className={styles.hint}>
        JPEG, PNG or WebP, up to 2 MiB and at least 64×64 pixels. Photos are
        center-cropped to a square and saved at 256×256 in this browser (demo).
      </p>
    </div>
  );
}
