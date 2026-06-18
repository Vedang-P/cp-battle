import { cn } from '@/lib/utils';

interface GlowTextProps {
  children: React.ReactNode;
  intensity?: 'normal' | 'strong';
  color?: 'green' | 'amber' | 'red' | 'cyan';
  className?: string;
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'p';
}

const colorClasses = {
  green: {
    normal: 'glow-green',
    strong: 'glow-green-strong',
  },
  amber: {
    normal: 'glow-amber',
    strong: 'glow-amber',
  },
  red: {
    normal: 'glow-red',
    strong: 'glow-red',
  },
  cyan: {
    normal: 'glow-cyan',
    strong: 'glow-cyan-strong',
  },
};

const colorValues = {
  green: '#00ff41',
  amber: '#ffb000',
  red: '#ff0040',
  cyan: '#00d4ff',
};

export function GlowText({
  children,
  intensity = 'normal',
  color = 'green',
  className,
  as: Tag = 'span',
}: GlowTextProps) {
  return (
    <Tag
      className={cn(colorClasses[color][intensity], className)}
      style={{ color: colorValues[color] }}
    >
      {children}
    </Tag>
  );
}

export default GlowText;
