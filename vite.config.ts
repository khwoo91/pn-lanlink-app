import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { WebSocketServer } from 'ws';

// @ts-ignore
import os from 'os';

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (
          net.address.startsWith('192.168.') ||
          net.address.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)
        ) {
          return net.address;
        }
      }
    }
  }
  return 'localhost';
}

export default defineConfig({
  base: '/pn-lanlink-app/',
  plugins: [
    tailwindcss(),
    {
      name: 'signaling-server',
      configureServer(server) {
        if (!server.httpServer) return;

        const wss = new WebSocketServer({ noServer: true });
        const localIp = getLocalIPv4();

        server.httpServer.on('upgrade', (request: any, socket: any, head: any) => {
          const url = new URL(request.url || '', `http://${request.headers.host}`);
          if (url.pathname === '/pn-lanlink-app/signaling') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          }
        });

        const activeRooms = new Map<string, any>(); // ip -> room

        function broadcast(data: any) {
          const str = JSON.stringify(data);
          for (const client of wss.clients) {
            if (client.readyState === 1) { // OPEN
              client.send(str);
            }
          }
        }

        wss.on('connection', (ws: any) => {
          // Send server detected IP to client
          ws.send(JSON.stringify({
            type: 'server-info',
            from: 'server',
            to: 'client',
            ip: localIp
          }));

          // Send current active room list to newly connected client
          ws.send(JSON.stringify({
            type: 'room-list-response',
            from: 'server',
            to: 'client',
            rooms: Array.from(activeRooms.values())
          }));

          ws.on('message', (message: any) => {
            try {
              const msg = JSON.parse(message.toString());

              if (msg.type === 'room-register') {
                ws.roomIp = msg.room.ip;
                activeRooms.set(msg.room.ip, msg.room);
                broadcast({
                  type: 'room-list-response',
                  from: 'server',
                  to: 'all',
                  rooms: Array.from(activeRooms.values())
                });
              }
              else if (msg.type === 'room-unregister') {
                activeRooms.delete(msg.ip);
                ws.roomIp = undefined;
                broadcast({
                  type: 'room-list-response',
                  from: 'server',
                  to: 'all',
                  rooms: Array.from(activeRooms.values())
                });
              }
              else if (msg.type === 'room-list-request') {
                ws.send(JSON.stringify({
                  type: 'room-list-response',
                  from: 'server',
                  to: 'client',
                  rooms: Array.from(activeRooms.values())
                }));
              }
              else {
                // Forward WebRTC signaling (offers, answers, candidates, joins, leaves)
                broadcast(msg);
              }
            } catch (e) {
              console.error('Error handling WebSocket message in server:', e);
            }
          });

          ws.on('close', () => {
            if (ws.roomIp) {
              activeRooms.delete(ws.roomIp);
              broadcast({
                type: 'room-list-response',
                from: 'server',
                to: 'all',
                rooms: Array.from(activeRooms.values())
              });
            }
          });
        });

        console.log(`\n⚡ [LANLink Signaling Server] Embedded at ws://${localIp}:5173/pn-lanlink-app/signaling`);
        console.log(`📡 [LANLink Web App] Access link for other Wi-Fi devices: http://${localIp}:5173/pn-lanlink-app/\n`);
      }
    }
  ],
});
