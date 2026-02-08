interface IconProps {
  name: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export function Icon({ name, size = 24, className = '', onClick }: IconProps) {
  return (
    <span
      className={`material-icons-round select-none ${className}`}
      style={{ fontSize: size }}
      onClick={onClick}
    >
      {name}
    </span>
  );
}
