export interface LANRoom {
  name: string;
  ip: string;
  locked: boolean;
  fps: number;
}

/**
 * mDNS Local network room scan and registration simulator.
 */
export const mockRooms: LANRoom[] = [];

export function scanLocalNetworkRooms(): Promise<LANRoom[]> {
  return new Promise((resolve) => {
    // Simulate short network delay
    setTimeout(() => {
      resolve(mockRooms);
    }, 800);
  });
}
