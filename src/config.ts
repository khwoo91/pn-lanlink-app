// LANLink Signaling Server Configuration
// 로컬 테스트 시: 'ws://localhost:5173/pn-lanlink-app/signaling'
// Render.com 등 무료 클라우드 배포 시: 'wss://your-app.onrender.com'

const getSignalingUrl = (): string => {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.startsWith('192.168.') || 
                  hostname.startsWith('10.') || 
                  hostname.startsWith('172.');
  
  if (isLocal) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/pn-lanlink-app/signaling`;
  }
  return 'wss://pn-lanlink-signaling.onrender.com';
};

export const SIGNALING_URL = getSignalingUrl();
