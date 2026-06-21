export interface LANRoom {
  name: string;
  ip: string;
  locked: boolean;
  fps: number;
}

/**
 * mDNS Local network room scan and registration simulator.
 */
export const mockRooms: LANRoom[] = [
  { name: '김철수 시니어', ip: '192.168.1.12', locked: true, fps: 60 },
  { name: '박나리 수석', ip: '192.168.1.84', locked: false, fps: 30 }
];

export function scanLocalNetworkRooms(): Promise<LANRoom[]> {
  return new Promise((resolve) => {
    // Simulate short network delay
    setTimeout(() => {
      resolve(mockRooms);
    }, 800);
  });
}
