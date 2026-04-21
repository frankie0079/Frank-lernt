// PROJ-34: Audio mixer for slideshow rendering.
//
// MediaRecorder needs a single MediaStream containing both video (canvas) and
// audio (music) tracks. AudioContext cannot run inside a Worker, so we mix on
// the main thread and pass the combined stream to MediaRecorder.
//
// iOS fix: decodes the MP3 into an AudioBuffer and plays it via
// AudioBufferSourceNode. HTMLAudioElement + createMediaElementSource was
// unreliable on iOS Safari — the pipeline stalled after ~3 seconds,
// producing slideshows with only a brief audio intro then silence.

export interface AudioMixerHandle {
  audioStream: MediaStream;
  context: AudioContext;
  start: () => void;
  /** Schedule a linear fade-out from current gain to 0 over the given duration, starting `delaySec` from now. */
  fadeOut: (delaySec: number, durationSec: number) => void;
  destroy: () => void;
}

export async function createAudioMixer(trackUrl: string): Promise<AudioMixerHandle> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx();

  // Fetch + decode the MP3 into an AudioBuffer (iOS-safe). Hard 10 s
  // timeout so a hung network request can't freeze the whole render.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let arrayBuffer: ArrayBuffer;
  try {
    const res = await fetch(trackUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Music load failed: HTTP ${res.status}`);
    arrayBuffer = await res.arrayBuffer();
  } finally {
    clearTimeout(timeoutId);
  }
  const audioBuffer = await context.decodeAudioData(arrayBuffer);

  const gain = context.createGain();
  gain.gain.value = 1;
  const dest = context.createMediaStreamDestination();
  gain.connect(dest);

  let source: AudioBufferSourceNode | null = null;
  let started = false;
  let startTime = 0;

  return {
    audioStream: dest.stream,
    context,
    start: () => {
      if (started) return;
      started = true;
      startTime = context.currentTime;
      source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(gain);
      source.start(0);
    },
    fadeOut: (delaySec: number, durationSec: number) => {
      const t0 = (startTime || context.currentTime) + delaySec;
      gain.gain.setValueAtTime(1, t0);
      gain.gain.linearRampToValueAtTime(0, t0 + durationSec);
    },
    destroy: () => {
      try {
        source?.stop();
      } catch {
        /* ignore */
      }
      try {
        source?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        context.close();
      } catch {
        /* ignore */
      }
    },
  };
}

export function combineStreams(videoStream: MediaStream, audioStream: MediaStream | null): MediaStream {
  const tracks = [...videoStream.getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  return new MediaStream(tracks);
}
