'use client';

import { useRef } from 'react';
import { formatDateWithWeekday } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';

export interface DateInputWithWeekdayProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  /** 未選択時に表示するテキスト */
  placeholder?: string;
  /** ラッパー用のクラス（見た目を入力欄に合わせる） */
  wrapperClassName?: string;
}

/**
 * 日付を yyyy/mm/dd（曜日）で表示し、クリックでネイティブ日付ピッカーを開く入力欄。
 * 内部では value/onChange は YYYY-MM-DD で扱う。
 */
const DateInputWithWeekday = ({
  value,
  onChange,
  placeholder = 'yyyy/mm/dd（曜日）で選択',
  wrapperClassName,
  className,
  id,
  min,
  max,
  disabled,
  ...rest
}: DateInputWithWeekdayProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (disabled) return;
    const el = inputRef.current;
    if (el) {
      el.focus();
      if (typeof el.showPicker === 'function') el.showPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      className={cn(
        'flex h-11 w-full cursor-pointer items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        wrapperClassName
      )}
      aria-label={placeholder}
    >
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        disabled={disabled}
        id={id}
        tabIndex={-1}
        className={cn('absolute h-0 w-0 opacity-0 [clip:rect(0,0,0,0)]', className)}
        aria-hidden
        {...rest}
      />
      <span className={cn(!value && 'text-muted-foreground')}>
        {value ? formatDateWithWeekday(value) : placeholder}
      </span>
    </div>
  );
};

DateInputWithWeekday.displayName = 'DateInputWithWeekday';

export { DateInputWithWeekday };
