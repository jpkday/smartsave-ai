// app/components/ui/index.tsx
// Reusable UI components for SmartSaveAI

import React from 'react';

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-bb-panel border border-bb-line rounded-lg shadow-sm p-4 md:p-6 ${className}`}>
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-bb-panel border border-bb-line rounded-lg shadow-sm p-4 ${className}`}>
    {children}
  </div>
);

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = '4xl'
}) => (
  <div className="min-h-screen app-bg text-bb-cream p-4 md:p-8">
    <div className={`max-w-${maxWidth} mx-auto`}>
      {children}
    </div>
  </div>
);

// ============================================================================
// BADGE COMPONENTS
// ============================================================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'blue' | 'yellow' | 'teal' | 'red' | 'orange' | 'gray';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'green',
  size = 'md',
  className = ''
}) => {
  const colors = {
    green: 'bg-bb-green/10 text-bb-green',
    blue: 'bg-white/5 text-bb-muted',
    yellow: 'bg-bb-gold/10 text-bb-gold',
    teal: 'bg-white/5 text-bb-cream',
    red: 'bg-bb-red/10 text-bb-red',
    orange: 'bg-bb-gold/10 text-bb-gold',
    gray: 'bg-white/5 text-bb-muted',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span className={`${colors[variant]} ${sizes[size]} rounded-full font-semibold whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
};

export const CheckmarkBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Badge variant="blue" size="sm" className={className}>
    ✓
  </Badge>
);

export const BestDealBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Badge variant="green" size="md" className={className}>
    Best Deal!
  </Badge>
);

// ============================================================================
// BUTTON COMPONENTS
// ============================================================================

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'teal' | 'yellow' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button'
}) => {
  const variants = {
    primary: 'bg-bb-gold text-bb-navy hover:brightness-110',
    teal: 'border border-bb-line bg-transparent text-bb-cream hover:bg-white/5',
    yellow: 'bg-bb-gold text-bb-navy hover:brightness-110',
    danger: 'text-bb-red border border-bb-red/30 hover:bg-bb-red/10',
    secondary: 'border border-bb-line bg-transparent text-bb-cream hover:bg-white/5',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant]} ${sizes[size]} rounded-lg font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
};

// ============================================================================
// PRICE CLASSIFICATION COMPONENTS
// ============================================================================

interface PriceClassificationProps {
  type: 'best' | 'close' | 'skip';
  mobile?: boolean;
  className?: string;
}

export const PriceClassification: React.FC<PriceClassificationProps> = ({
  type,
  mobile = false,
  className = ''
}) => {
  const classifications = {
    best: {
      label: 'Best Price!',
      mobileLabel: 'Best Price!',
      emoji: '✅',
      color: 'text-bb-green'
    },
    close: {
      label: 'Close Enough',
      mobileLabel: 'Close Enough',
      emoji: '➖',
      color: 'text-bb-gold'
    },
    skip: {
      label: 'Skip This One',
      mobileLabel: 'Skip',
      emoji: '❌',
      color: 'text-bb-red'
    }
  };

  const { label, mobileLabel, emoji, color } = classifications[type];

  if (mobile) {
    return (
      <span className={`font-semibold ${color} ${className}`}>
        {emoji} {mobileLabel}
      </span>
    );
  }

  return (
    <span className={`font-semibold ${color} ${className}`}>
      {emoji} {label}
    </span>
  );
};

// ============================================================================
// COVERAGE INDICATOR
// ============================================================================

interface CoverageIndicatorProps {
  coverage: number;
  total: number;
  className?: string;
}

export const CoverageIndicator: React.FC<CoverageIndicatorProps> = ({
  coverage,
  total,
  className = ''
}) => {
  const isComplete = coverage === total;
  const percentage = ((coverage / total) * 100).toFixed(0);

  return (
    <p className={`text-xs md:text-sm flex items-center gap-1 ${isComplete ? 'text-bb-green' : 'text-bb-gold'
      } ${className}`}>
      <span>
        {coverage}/{total} items ({percentage}% coverage)
        {!isComplete && ' ⚠️'}
      </span>
      {isComplete && <CheckmarkBadge />}
    </p>
  );
};

// ============================================================================
// FAVORITE STAR
// ============================================================================

interface FavoriteStarProps {
  isFavorite: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const FavoriteStar: React.FC<FavoriteStarProps> = ({
  isFavorite,
  size = 'xl',
  className = ''
}) => {
  if (!isFavorite) return null;

  return (
    <span className={`text-bb-gold text-${size} ${className}`}>
      ⭐
    </span>
  );
};

// ============================================================================
// PRICE INPUT
// ============================================================================

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
}

export const PriceInput: React.FC<PriceInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder = '0.00',
  className = ''
}) => {
  const handleChange = (inputValue: string) => {
    // Remove all non-digit characters
    const digits = inputValue.replace(/\D/g, '');

    let priceValue = '';
    if (digits !== '') {
      // Convert to cents, then to dollars
      const cents = parseInt(digits, 10);
      priceValue = (cents / 100).toFixed(2);
    }

    onChange(priceValue);
  };

  return (
    <div className={`flex items-center bg-bb-raised border border-bb-line rounded-lg px-3 py-3 focus-within:border-bb-gold/50 focus-within:ring-2 focus-within:ring-bb-gold/50 ${className}`}>
      <span className="text-bb-cream font-semibold mr-1">$</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyPress={onKeyPress}
        className="w-full text-right font-semibold text-bb-cream bg-transparent placeholder:text-slate-500 focus:outline-none"
      />
    </div>
  );
};

// ============================================================================
// STORE BADGE
// ============================================================================

interface StoreBadgeProps {
  store: string;
  className?: string;
}

export const StoreBadge: React.FC<StoreBadgeProps> = ({ store, className = '' }) => (
  <Badge variant="teal" className={className}>
    {store}
  </Badge>
);

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  action,
  className = ''
}) => (
  <Card className={`text-center ${className}`}>
    <p className="text-bb-muted text-base md:text-lg mb-4">{title}</p>
    {message && (
      <p className="text-sm text-bb-muted mb-4">{message}</p>
    )}
    {action && (
      <Button onClick={action.onClick} variant="primary">
        {action.label}
      </Button>
    )}
  </Card>
);

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger';
  };
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  count,
  action,
  className = ''
}) => (
  <div className={`flex justify-between items-center mb-4 ${className}`}>
    <h2 className="text-xl md:text-2xl font-bold text-bb-cream">
      {title} {count !== undefined && `(${count})`}
    </h2>
    {action && (
      <button
        onClick={action.onClick}
        className={`${action.variant === 'danger'
            ? 'text-bb-red hover:brightness-110'
            : 'text-bb-gold hover:brightness-110'
          } font-semibold cursor-pointer text-sm`}
      >
        {action.label}
      </button>
    )}
  </div>
);

// ============================================================================
// ITEM ROW COMPONENT
// ============================================================================

interface ItemRowProps {
  children: React.ReactNode;
  isFavorite?: boolean;
  isChecked?: boolean;
  className?: string;
}

export const ItemRow: React.FC<ItemRowProps> = ({
  children,
  isFavorite = false,
  isChecked = false,
  className = ''
}) => {
  const getRowClasses = () => {
    if (isChecked) {
      return 'bg-bb-raised border-bb-line';
    }
    if (isFavorite) {
      return 'bg-bb-raised border-bb-gold/30 hover:bg-white/5';
    }
    return 'bg-bb-panel border-bb-line hover:bg-white/5';
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition ${getRowClasses()} ${className}`}>
      {children}
    </div>
  );
};

// ============================================================================
// DATE AGE DISPLAY
// ============================================================================

interface DateAgeProps {
  date: string;
  className?: string;
}

export const DateAge: React.FC<DateAgeProps> = ({ date, className = '' }) => {
  const getDaysAgo = (dateString: string) => {
    const dateObj = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - dateObj.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  };

  return (
    <span className={`text-bb-muted ${className}`}>
      ({getDaysAgo(date)})
    </span>
  );
};