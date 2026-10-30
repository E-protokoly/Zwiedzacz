import React from 'react';

interface CountryFlagProps {
  code: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  code,
  size = 'sm',
  className = '',
}) => {
  const cleanCode = (code || 'UN').toLowerCase();

  const dimensions =
    size === 'xs'
      ? 'w-4 h-3'
      : size === 'sm'
      ? 'w-5 h-3.5'
      : size === 'md'
      ? 'w-6 h-4'
      : 'w-8 h-6';

  return (
    <img
      src={`https://flagcdn.com/w40/${cleanCode}.png`}
      srcSet={`https://flagcdn.com/w80/${cleanCode}.png 2x`}
      alt={code}
      loading="lazy"
      className={`${dimensions} object-cover rounded-[2px] border border-slate-300/60 dark:border-slate-700 shrink-0 inline-block ${className}`}
    />
  );
};
