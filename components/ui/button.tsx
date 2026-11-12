import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'default' | 'small' | 'icon';
  busy?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', busy = false, fullWidth = false,
    disabled, type = 'button', children, className = '', style, ...rest }, ref,
) {
  return (
    <button {...rest} ref={ref} type={type} disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`studio-button studio-button--${variant} studio-button--${size} ${className}`}
      style={{ ...style, ...(fullWidth ? { width: '100%' } : {}) }}>
      {busy && <span aria-hidden="true" className="studio-button-spinner" />}
      {children}
    </button>
  );
});
