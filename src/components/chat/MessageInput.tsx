import { useRef } from 'react';
import { Send } from 'lucide-react';
import styles from './MessageInput.module.css';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

/**
 * Message composer (PRD §5.4 Input area).
 * Enter sends, Shift+Enter inserts a newline. The textarea auto-grows.
 */
export function MessageInput({ value, onChange, onSend, disabled }: MessageInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function autoresize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.composer}>
        <textarea
          ref={ref}
          className={styles.input}
          placeholder="Type a message"
          value={value}
          rows={1}
          onChange={(e) => {
            onChange(e.target.value);
            autoresize(e.target);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Message"
        />
        <button
          type="button"
          className={styles.send}
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
      <div className={styles.modeNote}>
        <strong>Demo mode</strong> — messages stay in this browser; E2EE not active.
      </div>
      <p className={styles.hint}>Enter to send, Shift+Enter for a new line</p>
    </div>
  );
}
