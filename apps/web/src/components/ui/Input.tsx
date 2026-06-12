import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-stone-300 text-sm mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'w-full bg-stone-800 border border-stone-700 rounded px-3 py-2',
          'text-stone-50 placeholder-stone-500 text-sm transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-red-400 text-xs">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
