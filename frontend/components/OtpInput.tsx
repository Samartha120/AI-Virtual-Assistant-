import * as React from 'react';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  inputClassName?: string;
  containerClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

function clampToDigits(value: string, length: number): string {
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly.slice(0, length);
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  inputClassName = '',
  containerClassName = '',
  inputMode = 'numeric',
}: OtpInputProps) {
  const normalized = React.useMemo(() => clampToDigits(value ?? '', length), [value, length]);

  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(() => {
    const arr = Array.from({ length }, (_, i) => normalized[i] ?? '');
    return arr;
  }, [normalized, length]);

  React.useEffect(() => {
    if (!autoFocus || disabled) return;
    const firstEmpty = digits.findIndex((d) => !d);
    const index = firstEmpty === -1 ? length - 1 : firstEmpty;
    refs.current[index]?.focus();
  }, [autoFocus, disabled, length]);

  const setAt = React.useCallback(
    (index: number, char: string) => {
      const next = digits.slice();
      next[index] = char;
      onChange(next.join(''));
    },
    [digits, onChange]
  );

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    refs.current[clamped]?.focus();
    refs.current[clamped]?.select();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setAt(index, '');
        return;
      }
      focusIndex(index - 1);
      setAt(Math.max(0, index - 1), '');
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex(index + 1);
      return;
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const raw = e.target.value;
    const digit = raw.replace(/\D/g, '').slice(-1);
    setAt(index, digit);
    if (digit) focusIndex(index + 1);
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digitsOnly = clampToDigits(pasted, length);
    if (!digitsOnly) return;

    const next = digits.slice();
    let writeAt = index;
    for (const ch of digitsOnly) {
      if (writeAt >= length) break;
      next[writeAt] = ch;
      writeAt += 1;
    }

    onChange(next.join(''));

    const nextFocus = Math.min(length - 1, writeAt);
    focusIndex(nextFocus);
  };

  return (
    <div className={['flex items-center justify-center gap-2', containerClassName].join(' ')}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digits[i]}
          disabled={disabled}
          inputMode={inputMode}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`OTP digit ${i + 1}`}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onChange={(e) => handleChange(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          className={[
            'h-12 w-11 rounded-xl border border-white/10 bg-black/20 text-center text-lg font-semibold text-white',
            'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            inputClassName,
          ].join(' ')}
          maxLength={1}
        />
      ))}
    </div>
  );
}
