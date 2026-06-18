/**
 * ELO rank tier system — gives players recognizable progression.
 *
 * Tiers: Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster
 * Each tier has a custom ASCII badge and color.
 */

export interface RankTier {
  name: string;
  minElo: number;
  maxElo: number;
  color: string;
  glowClass: string;
  badge: string;
}

export const RANK_TIERS: RankTier[] = [
  {
    name: 'Bronze',
    minElo: 0,
    maxElo: 1199,
    color: '#cd7f32',
    glowClass: 'text-amber-700',
    badge: '┌─────┐\n│  B  │\n└─────┘',
  },
  {
    name: 'Silver',
    minElo: 1200,
    maxElo: 1399,
    color: '#c0c0c0',
    glowClass: 'text-gray-300',
    badge: '┌─────┐\n│  S  │\n└─────┘',
  },
  {
    name: 'Gold',
    minElo: 1400,
    maxElo: 1599,
    color: '#ffd700',
    glowClass: 'text-yellow-400',
    badge: '┌─────┐\n│  G  │\n└─────┘',
  },
  {
    name: 'Platinum',
    minElo: 1600,
    maxElo: 1799,
    color: '#00d4ff',
    glowClass: 'text-cyan-400',
    badge: '┌─────┐\n│  P  │\n└─────┘',
  },
  {
    name: 'Diamond',
    minElo: 1800,
    maxElo: 1999,
    color: '#b3e5fc',
    glowClass: 'text-cyan-200',
    badge: '┌─────┐\n│  D  │\n└─────┘',
  },
  {
    name: 'Master',
    minElo: 2000,
    maxElo: 2199,
    color: '#ff00ff',
    glowClass: 'text-purple-400',
    badge: '┌─────┐\n│  M  │\n└─────┘',
  },
  {
    name: 'Grandmaster',
    minElo: 2200,
    maxElo: 99999,
    color: '#ff0040',
    glowClass: 'text-red-500',
    badge: '┌─────┐\n│ GM  │\n└─────┘',
  },
];

export function getRankTier(elo: number): RankTier {
  return RANK_TIERS.find((t) => elo >= t.minElo && elo <= t.maxElo) ?? RANK_TIERS[0]!;
}

export function getNextTier(elo: number): RankTier | null {
  const current = getRankTier(elo);
  const idx = RANK_TIERS.indexOf(current);
  return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1]! : null;
}
