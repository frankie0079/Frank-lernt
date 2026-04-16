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
  destroy: () => void;
}

export async function createAudioMixer(trackUrl: string): Promise<AudioMixerHandle> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx();

  // Fetch + decode the MP3 into an AudioBuffer (iOS-safe).
  const res = await fetch(trackUrl);
  if (!res.ok) throw new Error(`Music load failed: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);

  const dest = context.createMediaStreamDestination();

  let source: AudioBufferSourceNode | null = null;
  let started = false;

  return {
    audioStream: dest.stream,
    context,
    start: () => {
      if (started) return;
      started = true;
      source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true; // cover slideshows longer than the track
      source.connect(dest);
      source.start(0);
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
