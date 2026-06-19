'use client';

/**
 * Music player hook — playlist with loop-all behavior.
 *
 * - Plays through all tracks in /audio/manifest.json, then loops back to track 1.
 * - Mute toggle persisted in localStorage.
 * - Volume persisted in localStorage.
 * - Uses a module-level singleton Audio element so music persists across navigations.
 * - Handles audio load errors by skipping to the next track.
 * - Pauses/resumes on tab visibility changes (mobile-friendly).
 */

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';

interface AudioPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTrack: string;
  trackIndex: number;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  nextTrack: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerState | null>(null);

export function useAudioPlayer(): AudioPlayerState | null {
  return useContext(AudioPlayerContext);
}

interface Track {
  file: string;
  title: string;
}

const STORAGE_KEY_MUTED = 'zapdos-music-muted';
const STORAGE_KEY_VOLUME = 'zapdos-music-volume';

// Module-level singleton — survives React remounts / page navigations
let singletonAudio: HTMLAudioElement | null = null;
let singletonTracks: Track[] = [];
let singletonTrackIndex = 0;
let singletonEndedHandler: (() => void) | null = null;
let singletonErrorHandler: (() => void) | null = null;
let singletonHasSetSrc = false;

function getAudio(): HTMLAudioElement {
  if (!singletonAudio) {
    singletonAudio = new Audio();
    singletonAudio.loop = false;
    singletonAudio.preload = 'auto';
  }
  return singletonAudio;
}

/** Read saved mute preference synchronously (safe for SSR since window check guards it). */
function getInitialMuted(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(STORAGE_KEY_MUTED);
  return saved !== null ? saved === 'true' : true;
}

/** Read saved volume preference synchronously. */
function getInitialVolume(): number {
  if (typeof window === 'undefined') return 0.4;
  const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
  return saved !== null ? parseFloat(saved) : 0.4;
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>(singletonTracks);
  const [trackIndex, setTrackIndex] = useState(singletonTrackIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(getInitialMuted);
  const [volume, setVolumeState] = useState(getInitialVolume);
  const [initialized, setInitialized] = useState(false);
  const trackIndexRef = useRef(trackIndex);
  trackIndexRef.current = trackIndex;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  // Load manifest on mount
  useEffect(() => {
    fetch('/audio/manifest.json')
      .then((r) => r.json())
      .then((data) => {
        if (data.tracks && data.tracks.length > 0) {
          singletonTracks = data.tracks;
          setTracks(data.tracks);

          const audio = getAudio();

          // Set initial volume from saved preference
          audio.volume = isMutedRef.current ? 0 : volumeRef.current;

          // Only set src if not already playing (preserve current playback)
          if (!singletonHasSetSrc) {
            audio.src = `/audio/music/${data.tracks[0].file}`;
            singletonHasSetSrc = true;
          }

          // Wire up ended handler (once)
          if (!singletonEndedHandler) {
            singletonEndedHandler = () => {
              const next = (trackIndexRef.current + 1) % tracksRef.current.length;
              const nextTrack = tracksRef.current[next];
              if (nextTrack) {
                audio.src = `/audio/music/${nextTrack.file}`;
                audio.play().catch(() => {});
              }
              singletonTrackIndex = next;
              setTrackIndex(next);
            };
            audio.addEventListener('ended', singletonEndedHandler);
          }

          // Wire up error handler (once) — skip to next track on load failure
          if (!singletonErrorHandler) {
            singletonErrorHandler = () => {
              console.warn('[audio] track failed to load, skipping to next');
              const next = (trackIndexRef.current + 1) % tracksRef.current.length;
              const nextTrack = tracksRef.current[next];
              if (nextTrack) {
                audio.src = `/audio/music/${nextTrack.file}`;
                audio.play().catch(() => {});
              }
              singletonTrackIndex = next;
              setTrackIndex(next);
            };
            audio.addEventListener('error', singletonErrorHandler);
          }

          setInitialized(true);
        }
      })
      .catch(() => {
        setInitialized(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update volume when muted/volume changes
  useEffect(() => {
    const audio = singletonAudio;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
    }
  }, [isMuted, volume]);

  // Sync playing state from the singleton
  useEffect(() => {
    if (!initialized) return;
    const audio = getAudio();
    const check = () => {
      setIsPlaying(!audio.paused);
    };
    audio.addEventListener('play', check);
    audio.addEventListener('pause', check);
    return () => {
      audio.removeEventListener('play', check);
      audio.removeEventListener('pause', check);
    };
  }, [initialized]);

  // Pause on tab hide, resume on tab show (mobile-friendly)
  useEffect(() => {
    if (!initialized) return;

    let wasPlayingBeforeHide = false;

    const handleVisibility = () => {
      const audio = singletonAudio;
      if (!audio) return;

      if (document.hidden) {
        // Tab is being hidden — remember if we were playing
        wasPlayingBeforeHide = !audio.paused;
      } else {
        // Tab is visible again — resume if we were playing before
        if (wasPlayingBeforeHide && !isMutedRef.current) {
          audio.play().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [initialized]);

  const togglePlay = useCallback(() => {
    const audio = getAudio();
    if (tracksRef.current.length === 0) return;
    if (!audio.paused) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY_MUTED, String(next));
      if (!next) {
        const audio = getAudio();
        audio.play().catch(() => {});
      }
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
  }, []);

  const nextTrack = useCallback(() => {
    const audio = getAudio();
    const next = (trackIndexRef.current + 1) % tracksRef.current.length;
    const nextTrack = tracksRef.current[next];
    if (nextTrack) {
      audio.src = `/audio/music/${nextTrack.file}`;
      audio.play().catch(() => {});
    }
    singletonTrackIndex = next;
    setTrackIndex(next);
  }, []);

  const currentTrack = tracks[trackIndex]?.title ?? '';

  return (
    <AudioPlayerContext.Provider
      value={{
        isPlaying,
        isMuted,
        volume,
        currentTrack,
        trackIndex,
        togglePlay,
        toggleMute,
        setVolume,
        nextTrack,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}
