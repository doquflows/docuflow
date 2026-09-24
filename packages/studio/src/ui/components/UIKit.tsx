import type { ReactNode } from 'react';
import type { PillTone, BtnVariant, IconName } from '../types';
import Icon from './Icon';

interface PillProps { tone?: PillTone; children: ReactNode; }
export function Pill({ tone = 'default', children }: PillProps) {
  return (
    <span className={`df-pill${tone !== 'default' ? ` df-pill--${tone}` : ''}`}>
      {children}
    </span>
  );
}

interface BtnProps {
  variant?: BtnVariant;
  icon?: IconName;
  kbd?: string;
  children?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
}
export function Btn({ variant = 'default', icon, kbd, children, onClick, active, type = 'button', disabled, ...rest }: BtnProps) {
  const cls = [
    'df-btn',
    variant !== 'default' && `df-btn--${variant}`,
    active && 'df-btn--active',
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} {...rest}>
      {icon && <Icon name={icon} size={13} />}
      {children}
      {kbd && <span className="df-kbd">{kbd}</span>}
    </button>
  );
}

interface KbdProps { children: ReactNode; }
export function Kbd({ children }: KbdProps) {
  return <span className="df-kbd">{children}</span>;
}

interface FieldProps { label: string; value: string; mono?: boolean; }
export function Field({ label, value, mono }: FieldProps) {
  return (
    <div className="df-field">
      <div className="df-field__label">{label}</div>
      <div className={`df-field__value${mono ? ' df-field__value--mono' : ''}`}>{value}</div>
    </div>
  );
}
