'use client';

/**
 * Music toggle button — terminal-style mute icon following the hacker theme.
 * Shows ♪ when playing, ♪̸ when muted. Visible in the navbar.
 */

import { useAudioPlayer } from '@/lib/audio-player';

export function MusicToggle() {
  const player = useAudioPlayer();
  if (!player) return null;

  // If no tracks loaded (no manifest or empty), don't render
  if (player.trackIndex === 0 && !player.currentTrack && player.isPlaying === false) {
    // Still render — user might add tracks later. But be subtle.
  }

  return (
    <button
      onClick={player.toggleMute}
      className="flex items-center gap-1 px-2 py-1 font-mono text-xs text-text-muted transition-colors hover:text-brand"
      aria-label={player.isMuted ? 'Unmute music' : 'Mute music'}
      title={player.isMuted ? 'Music: OFF' : `Music: ON — ${player.currentTrack}`}
    >
      <span className={`text-sm ${player.isMuted ? 'text-text-muted/50' : 'text-brand glow-green'}`}>
        {player.isMuted ? '♪̸' : '♪'}
      </span>
      <span className="hidden sm:inline text-[10px] uppercase tracking-wider">
        {player.isMuted ? 'mute' : 'play'}
      </span>
    </button>
  );
}
