import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
// @ts-ignore
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
            wss.handleUpgrade(request, socket, head, (ws: any) => {
              (wss as any).emit('connection', ws, request);
            });
          }
        });

        const activeRooms = new Map<string, any>(); // ip -> room
        const activeAgents = new Map<string, any>(); // clientIp -> agentWs

        function broadcast(data: any, senderWs?: any) {
          const str = JSON.stringify(data);
          const senderIp = senderWs ? senderWs.clientPublicIp : null;
          if (wss.clients) {
            for (const client of wss.clients) {
              if (client.readyState === 1 && !(client as any).isAgent) { // OPEN and not an agent
                if (!senderIp || 
                    (client as any).clientPublicIp === senderIp || 
                    senderIp === '127.0.0.1' || 
                    (client as any).clientPublicIp === '127.0.0.1' ||
                    (client as any).clientPublicIp === localIp ||
                    senderIp === localIp) {
                  client.send(str);
                }
              }
            }
          }
        }

        function broadcastAgentStatus(publicIp: string, connected: boolean) {
          const payload = JSON.stringify({
            type: 'agent-status',
            from: 'server',
            to: 'client',
            connected: connected
          });
          if (wss.clients) {
            for (const client of wss.clients) {
              if (client.readyState === 1 && !(client as any).isAgent) {
                const cip = (client as any).clientPublicIp;
                if (cip === publicIp || publicIp === '127.0.0.1' || cip === '127.0.0.1' || cip === localIp || publicIp === localIp) {
                  client.send(payload);
                }
              }
            }
          }
        }

        (wss as any).on('connection', (ws: any, req: any) => {
          let clientIp = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || localIp || '127.0.0.1';
          if (clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
          }
          if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
            clientIp = '127.0.0.1';
          }
          ws.clientPublicIp = clientIp;
          ws.isAgent = false;

          // Send initial server info with agent status to host
          const agentExists = activeAgents.has(clientIp);
          ws.send(JSON.stringify({
            type: 'server-info',
            from: 'server',
            to: 'client',
            ip: clientIp,
            agentConnected: agentExists
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

              // 1. Agent Registration from LANLink_Helper.exe
              if (msg.type === 'agent-register') {
                ws.isAgent = true;
                activeAgents.set(ws.clientPublicIp, ws);
                console.log(`🔌 [LANLink Dev Server] Agent registered for IP: ${ws.clientPublicIp}`);
                broadcastAgentStatus(ws.clientPublicIp, true);
              } 
              // 2. Host query agent connection status
              else if (msg.type === 'agent-check') {
                const exists = activeAgents.has(ws.clientPublicIp);
                ws.send(JSON.stringify({
                  type: 'agent-status',
                  from: 'server',
                  to: 'client',
                  connected: exists
                }));
              }
              // 3. Relay mouse/keyboard action events to the registered agent
              else if (msg.type === 'agent-control') {
                const agentWs = activeAgents.get(ws.clientPublicIp);
                if (agentWs && agentWs.readyState === 1) {
                  agentWs.send(JSON.stringify(msg.control));
                }
              }
              // 4. Room Register & Signaling messages
              else if (msg.type === 'room-register') {
                ws.roomIp = msg.room.ip;
                activeRooms.set(msg.room.ip, msg.room);
                broadcast({
                  type: 'room-list-response',
                  from: 'server',
                  to: 'all',
                  rooms: Array.from(activeRooms.values())
                }, ws);
              }
              else if (msg.type === 'room-unregister') {
                const targetIp = msg.ip || ws.roomIp;
                if (targetIp) {
                  activeRooms.delete(targetIp);
                }
                ws.roomIp = undefined;
                broadcast({
                  type: 'room-list-response',
                  from: 'server',
                  to: 'all',
                  rooms: Array.from(activeRooms.values())
                }, ws);
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
                broadcast(msg, ws);
              }
            } catch (e) {
              console.error('Error handling WebSocket message in server:', e);
            }
          });

          ws.on('close', () => {
            if (ws.isAgent) {
              activeAgents.delete(ws.clientPublicIp);
              console.log(`❌ [LANLink Dev Server] Agent disconnected for IP: ${ws.clientPublicIp}`);
              broadcastAgentStatus(ws.clientPublicIp, false);
            }
            if (ws.roomIp) {
              activeRooms.delete(ws.roomIp);
              broadcast({
                type: 'room-list-response',
                from: 'server',
                to: 'all',
                rooms: Array.from(activeRooms.values())
              }, ws);
            }
          });
        });

        console.log(`\n⚡ [LANLink Signaling Server] Embedded at ws://${localIp}:5173/pn-lanlink-app/signaling`);
        console.log(`📡 [LANLink Web App] Access link for other Wi-Fi devices: http://${localIp}:5173/pn-lanlink-app/\n`);
      }
    }
  ],
});
