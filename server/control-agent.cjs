const WebSocket = require('ws');
const { mouse, keyboard, Button, Point, screen, Key } = require('@nut-tree-fork/nut-js');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const shortcutPath = path.join(
  process.env.APPDATA,
  'Microsoft\\Windows\\Start Menu\\Programs\\Startup\\LANLinkHelper.lnk'
);

// Helper: Show native Windows MessageBox
function showMessage(title, message) {
  try {
    const escapedTitle = title.replace(/'/g, "''");
    const escapedMessage = message.replace(/'/g, "''");
    const script = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${escapedMessage}', '${escapedTitle}', 'OK', 'Information')`;
    execSync(`powershell -Command "${script}"`, { stdio: 'ignore' });
  } catch (e) {
    try { execSync(`msg * "${title}\n\n${message}"`, { stdio: 'ignore' }); } catch (err) {}
  }
}

// Helper: Check if shortcut already exists in Startup folder
function isStartupRegistered() {
  return fs.existsSync(shortcutPath);
}

// Helper: Inject link shortcut to Startup folder with minimized WindowStyle = 7
function registerStartup() {
  try {
    const execPath = process.execPath;
    const psScript = `$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/\\/g, '\\\\')}'); $Shortcut.TargetPath = '${execPath.replace(/\\/g, '\\\\')}'; $Shortcut.WindowStyle = 7; $Shortcut.Save()`;
    execSync(`powershell -Command "${psScript}"`, { stdio: 'ignore' });
    return true;
  } catch (err) {
    console.error('Failed to create startup shortcut:', err);
    return false;
  }
}

// Branch 1: Triggered via CLI to remove the startup shortcut
if (process.argv.includes('--uninstall')) {
  console.log('⏳ [LANLink Helper] Removing Windows Startup Shortcut...');
  try {
    if (fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
    }
    showMessage('LANLink Helper', '원격 제어 도우미 시작 프로그램 등록이 정상 해제되었습니다.');
  } catch (err) {
    console.error('Failed to remove shortcut:', err.message);
  }
  process.exit(0);
}

// Branch 2: Double-click launch (Auto-registers shortcut to Startup folder on first launch)
if (!isStartupRegistered()) {
  console.log('⏳ [LANLink Helper] Injecting Windows Startup Shortcut...');
  if (registerStartup()) {
    showMessage(
      'LANLink Helper',
      '원격 제어 도우미가 윈도우 시작 프로그램에 안전하게 등록되었습니다!\n\n이제 PC를 켤 때마다 화면 가림 없이 작업 표시줄 밑으로 자동 기동되어 평생 편리하게 쓰실 수 있습니다.'
    );
  }
}

// Run the signaling outbound connection client immediately
runControlAgent();

function runControlAgent() {
  mouse.config.mouseSpeed = 10000;

  const targetUrls = [
    'ws://localhost:5173/pn-lanlink-app/signaling',
    'ws://localhost:10000',
    'wss://lanlink.onrender.com'
  ];

  let currentWs = null;
  let urlIndex = 0;
  let reconnectTimer = null;

  const KEY_MAP = {
    'Enter': Key.Enter,
    'Backspace': Key.Backspace,
    'Tab': Key.Tab,
    'Escape': Key.Escape,
    ' ': Key.Space,
    'ArrowUp': Key.Up,
    'ArrowDown': Key.Down,
    'ArrowLeft': Key.Left,
    'ArrowRight': Key.Right,
    'Shift': Key.LeftShift,
    'Control': Key.LeftControl,
    'Alt': Key.LeftAlt,
    'Meta': Key.LeftSuper,
    'Delete': Key.Delete,
    'Home': Key.Home,
    'End': Key.End,
    'PageUp': Key.PageUp,
    'PageDown': Key.PageDown,
    'CapsLock': Key.CapsLock,
    'F1': Key.F1,
    'F2': Key.F2,
    'F3': Key.F3,
    'F4': Key.F4,
    'F5': Key.F5,
    'F6': Key.F6,
    'F7': Key.F7,
    'F8': Key.F8,
    'F9': Key.F9,
    'F10': Key.F10,
    'F11': Key.F11,
    'F12': Key.F12,
  };

  let screenWidth = 1920;
  let screenHeight = 1080;
  async function updateScreenSize() {
    try {
      screenWidth = await screen.width();
      screenHeight = await screen.height();
      console.log(`💻 Screen resolution detected: ${screenWidth}x${screenHeight}`);
    } catch (e) {
      console.warn('Failed to retrieve screen resolution, fallback to 1920x1080:', e.message);
      screenWidth = 1920;
      screenHeight = 1080;
    }
  }
  updateScreenSize();

  async function executeAction(data) {
    try {
      if (data.type === 'mousemove') {
        const targetX = Math.round(data.x * screenWidth);
        const targetY = Math.round(data.y * screenHeight);
        await mouse.setPosition(new Point(targetX, targetY));
      } 
      else if (data.type === 'mousedown') {
        const btn = data.button === 2 ? Button.RIGHT : data.button === 1 ? Button.MIDDLE : Button.LEFT;
        await mouse.pressButton(btn);
      } 
      else if (data.type === 'mouseup') {
        const btn = data.button === 2 ? Button.RIGHT : data.button === 1 ? Button.MIDDLE : Button.LEFT;
        await mouse.releaseButton(btn);
      }
      else if (data.type === 'wheel') {
        const amount = Math.max(1, Math.round(Math.abs(data.deltaY) / 100));
        if (data.deltaY > 0) {
          await mouse.scrollDown(amount);
        } else {
          await mouse.scrollUp(amount);
        }
      }
      else if (data.type === 'keydown') {
        const mappedKey = KEY_MAP[data.key];
        if (mappedKey !== undefined) {
          await keyboard.pressKey(mappedKey);
        } else if (data.key.length === 1) {
          await keyboard.type(data.key);
        }
      }
      else if (data.type === 'keyup') {
        const mappedKey = KEY_MAP[data.key];
        if (mappedKey !== undefined) {
          await keyboard.releaseKey(mappedKey);
        }
      }
    } catch (e) {
      console.error('Failed to execute control action in agent:', e);
    }
  }

  // 1. Centralized Outbound Signaling connection
  function connectToSignaling() {
    if (currentWs) return;

    const url = targetUrls[urlIndex];
    console.log(`📡 [LANLink Helper] Connecting to signaling server: ${url}`);
    
    const ws = new WebSocket(url);

    ws.on('open', () => {
      currentWs = ws;
      console.log(`🔌 [LANLink Helper] Connected successfully to signaling server: ${url}`);
      
      ws.send(JSON.stringify({
        type: 'agent-register',
        from: 'agent'
      }));

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await executeAction(data);
        } catch (err) {}
      });
    });

    const handleFailure = (err) => {
      console.log(`⚠️ [LANLink Helper] Connection failed or closed for ${url}. Error: ${err ? err.message : 'Closed'}`);
      ws.terminate();
      if (currentWs === ws || !currentWs) {
        currentWs = null;
      }
      
      urlIndex = (urlIndex + 1) % targetUrls.length;

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectToSignaling();
        }, 3000);
      }
    };

    ws.on('error', handleFailure);
    ws.on('close', handleFailure);
  }

  connectToSignaling();

  // 2. Parallel Local Loopback Server (ultra-low latency 0ms path)
  try {
    const { WebSocketServer } = WebSocket;
    const localWss = new WebSocketServer({ port: 5000 });
    console.log('⚡ [LANLink Helper] Local direct socket server listening on ws://127.0.0.1:5000');
    
    localWss.on('connection', (localWs) => {
      console.log('🔌 [LANLink Helper] Local direct control channel connected.');
      
      localWs.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await executeAction(data);
        } catch (err) {}
      });

      localWs.on('close', () => {
        console.log('❌ [LANLink Helper] Local direct control channel disconnected.');
      });
    });
  } catch (err) {
    console.warn('⚠️ [LANLink Helper] Failed to start local 5000 server (might be occupied):', err.message);
  }
}
