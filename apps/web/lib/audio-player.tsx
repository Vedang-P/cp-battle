'use client';

/**
 * Music player hook — playlist with loop-all behavior.
 *
 * - Plays through all tracks in /audio/manifest.json, then loops back to track 1.
 * - Mute toggle persisted in localStorage.
 * - Volume persisted in localStorage.
 * - AudioContext resumes on first user gesture (browser autoplay policy).
 * - Music ducks (lowers volume) during SFX playback for drama.
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

const STORAGE_KEY_MUTED = 'cpbattle-music-muted';
const STORAGE_KEY_VOLUME = 'cpbattle-music-volume';

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // start muted (autoplay policy)
  const [volume, setVolumeState] = useState(0.4);
  const [initialized, setInitialized] = useState(false);

  // Load manifest + saved preferences on mount
  useEffect(() => {
    fetch('/audio/manifest.json')
      .then((r) => r.json())
      .then((data) => {
        if (data.tracks && data.tracks.length > 0) {
          setTracks(data.tracks);
        }
      })
      .catch(() => {
        // No manifest — player stays dormant
      });

    const savedMuted = localStorage.getItem(STORAGE_KEY_MUTED);
    const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
    if (savedMuted !== null) setIsMuted(savedMuted === 'true');
    if (savedVolume !== null) setVolumeState(parseFloat(savedVolume));

    setInitialized(true);
  }, []);

  // Create audio element once tracks are loaded
  useEffect(() => {
    if (!initialized || tracks.length === 0) return;

    const audio = new Audio();
    audio.loop = false; // we handle looping manually for playlist mode
    audio.volume = isMuted ? 0 : volume;
    audio.preload = 'auto';
    audioRef.current = audio;

    const currentTrack = tracks[0];
    if (currentTrack) {
      audio.src = `/audio/music/${currentTrack.file}`;
    }

    // When a track ends, advance to the next (loop-all)
    const handleEnded = () => {
      setTrackIndex((prev) => {
        const next = (prev + 1) % tracks.length;
        const nextTrack = tracks[next];
        if (nextTrack && audioRef.current) {
          audioRef.current.src = `/audio/music/${nextTrack.file}`;
          audioRef.current.play().catch(() => {});
        }
        return next;
      });
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, tracks]);

  // Update volume when muted/volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [isMuted, volume]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || tracks.length === 0) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, tracks.length]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY_MUTED, String(next));
      // If unmuting, also start playing
      if (!next && audioRef.current && !isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return next;
    });
  }, [isPlaying]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
  }, []);

  const nextTrack = useCallback(() => {
    setTrackIndex((prev) => {
      const next = (prev + 1) % tracks.length;
      const nextTrack = tracks[next];
      if (nextTrack && audioRef.current) {
        audioRef.current.src = `/audio/music/${nextTrack.file}`;
        if (isPlaying) {
          audioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  }, [tracks, isPlaying]);

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
