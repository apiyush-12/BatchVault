export interface Memory {
  id: string;
  batchId: string;
  caption: string | null;
  eventName: string | null;
  occurredOn: string;
  createdAt: string;
}

export interface MemoryWithMedia extends Memory {
  imageUrl: string | null;
}
