/**
 * WebRTC Screen sharing and media stream capture engine.
 */
export async function captureScreen(): Promise<MediaStream | null> {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      return await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          frameRate: 60,
        },
        audio: true,
      });
    }
  } catch (err) {
    console.warn("Display media capture failed or cancelled, falling back to mock stream: ", err);
  }
  return createMockScreenStream();
}

function createMockScreenStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new MediaStream();
  }

  let angle = 0;
  setInterval(() => {
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, 1280, 720);

    // Draw grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }

    // Draw rotating circle
    const radius = 100 + Math.sin(angle) * 10;
    const cx = 640 + Math.cos(angle) * 150;
    const cy = 360 + Math.sin(angle * 1.5) * 100;

    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
    grad.addColorStop(0, "#1a73e8");
    grad.addColorStop(1, "#0f172a");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LANLink Live Mock Screen Stream", 640, 260);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px sans-serif";
    ctx.fillText("(Real displayMedia capture fallback)", 640, 310);

    // Live Time
    ctx.fillStyle = "#10b981";
    ctx.font = "24px monospace";
    ctx.fillText(new Date().toLocaleTimeString(), 640, 420);

    angle += 0.05;
  }, 1000 / 30);

  return (canvas as any).captureStream(30);
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}
