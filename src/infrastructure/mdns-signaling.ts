export interface LANRoom {
  name: string;
  ip: string;
  code: string;
  locked: boolean;
  fps: number;
}

/**
 * Default mock rooms in the corporate network.
 */
export const mockRooms: LANRoom[] = [];

/**
 * Fetch all active rooms, combining localStorage registered rooms and default mock rooms.
 */
export function getActiveRooms(): LANRoom[] {
  try {
    const stored = localStorage.getItem("lanlink_active_rooms");
    const localRooms = stored ? JSON.parse(stored) : [];

    // Combine local rooms and mock rooms, prioritizing localRooms if duplicate IPs exist
    const allRooms = [...localRooms];
    for (const mock of mockRooms) {
      if (!allRooms.some((r) => r.ip === mock.ip)) {
        allRooms.push(mock);
      }
    }
    return allRooms;
  } catch (e) {
    return mockRooms;
  }
}

/**
 * Register a new room created on this machine.
 */
export function registerRoom(room: LANRoom): void {
  try {
    const stored = localStorage.getItem("lanlink_active_rooms");
    const rooms: LANRoom[] = stored ? JSON.parse(stored) : [];
    const index = rooms.findIndex((r) => r.ip === room.ip);
    if (index > -1) {
      rooms[index] = room;
    } else {
      rooms.push(room);
    }
    localStorage.setItem("lanlink_active_rooms", JSON.stringify(rooms));
  } catch (e) {
    console.error("Failed to register room:", e);
  }
}

/**
 * Unregister a room by its IP address.
 */
export function unregisterRoom(ip: string): void {
  try {
    const stored = localStorage.getItem("lanlink_active_rooms");
    if (stored) {
      const rooms: LANRoom[] = JSON.parse(stored);
      const filtered = rooms.filter((r) => r.ip !== ip);
      localStorage.setItem("lanlink_active_rooms", JSON.stringify(filtered));
    }
  } catch (e) {
    console.error("Failed to unregister room:", e);
  }
}

/**
 * Scan local network rooms.
 */
export function scanLocalNetworkRooms(): Promise<LANRoom[]> {
  return new Promise((resolve) => {
    // Simulate short network delay
    setTimeout(() => {
      resolve(getActiveRooms());
    }, 800);
  });
}
