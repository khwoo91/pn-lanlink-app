/**
 * WebRTC Screen sharing and media stream capture engine.
 */
export async function captureScreen(): Promise<MediaStream | null> {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      return await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          frameRate: 60
        },
        audio: true
      });
    }
  } catch (err) {
    console.warn("Display media capture failed or cancelled: ", err);
  }
  return null;
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}
