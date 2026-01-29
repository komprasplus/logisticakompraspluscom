import { useCallback } from "react";

/**
 * Hook to play notification sounds.
 * Uses Web Audio API for reliable, instant playback.
 */
export const useNotificationSound = () => {
  const playNotificationPing = useCallback(() => {
    playGlobalNotificationPing();
  }, []);

  return { playNotificationPing };
};

// --- Global, singleton sound player ---
// Keeps audio state outside React lifecycles to avoid accidental re-render coupling.
let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return globalAudioContext;
}

export function playGlobalNotificationPing() {
  try {
    const ctx = getAudioContext();

    // Resume if suspended (browser autoplay policy). IMPORTANT: catch promise.
    if (ctx.state === "suspended") {
      void ctx.resume().catch((err) => {
        // Don't allow an unhandledrejection loop
        console.warn("AudioContext resume failed:", err);
      });
    }

    const now = ctx.currentTime;

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
}
