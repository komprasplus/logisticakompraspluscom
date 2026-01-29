import { useCallback, useRef } from "react";

/**
 * Hook to play notification sounds.
 * Uses Web Audio API for reliable, instant playback.
 */
export const useNotificationSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationPing = useCallback(() => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;

      // Resume if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Create oscillator for the ping sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Pleasant notification ping: two quick tones
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now); // A5
      oscillator.frequency.setValueAtTime(1320, now + 0.1); // E6

      // Volume envelope: quick attack, short sustain, fade out
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gainNode.gain.setValueAtTime(0.3, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.12);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.35);

      oscillator.start(now);
      oscillator.stop(now + 0.4);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }, []);

  return { playNotificationPing };
};
