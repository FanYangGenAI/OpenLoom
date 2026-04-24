import type { WsProgressEvent, WsResponse } from './protocol';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
};

export class WsClient {
  private readonly baseUrl: string;
  private readonly onProgress: (event: WsProgressEvent) => void;
  private readonly onConnectionChange: (connected: boolean) => void;
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private reconnectTimer: number | null = null;

  constructor(
    baseUrl: string,
    onProgress: (event: WsProgressEvent) => void,
    onConnectionChange: (connected: boolean) => void,
  ) {
    this.baseUrl = baseUrl;
    this.onProgress = onProgress;
    this.onConnectionChange = onConnectionChange;
  }

  connect(): void {
    this.ws = new WebSocket(this.baseUrl);
    this.ws.onopen = () => this.onConnectionChange(true);
    this.ws.onclose = () => {
      this.onConnectionChange(false);
      this.scheduleReconnect();
    };
    this.ws.onerror = () => this.onConnectionChange(false);
    this.ws.onmessage = (event) => this.handleMessage(event.data);
  }

  async request<TData>(type: string, data: Record<string, unknown>, timeoutMs = 120_000): Promise<TData> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    const requestId = `req-${++this.requestCounter}`;
    const payload = JSON.stringify({ type, requestId, data });
    this.ws.send(payload);

    return new Promise<TData>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs);
      this.pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private handleMessage(raw: string): void {
    let msg: WsResponse<unknown> | WsProgressEvent;
    try {
      msg = JSON.parse(raw) as WsResponse<unknown> | WsProgressEvent;
    } catch {
      return;
    }
    if (msg.type === 'extract.progress') {
      this.onProgress(msg);
      return;
    }
    if (msg.type === 'response' && msg.requestId && this.pending.has(msg.requestId)) {
      const pending = this.pending.get(msg.requestId)!;
      window.clearTimeout(pending.timeoutId);
      this.pending.delete(msg.requestId);
      if (msg.ok) pending.resolve(msg.data);
      else pending.reject(new Error(msg.error || 'Unknown request error'));
    }
  }
}
