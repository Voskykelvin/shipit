export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  merchantId: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const SESSION_KEY = 'shipit.session';

function readSession(): AuthSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || !session.expiresAt || new Date(session.expiresAt) <= new Date()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

async function decodeResponse<T>(response: Response): Promise<T> {
  const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}

export const api = {
  get session(): AuthSession | null {
    return readSession();
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const session = await decodeResponse<AuthSession>(response);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async logout(): Promise<void> {
    const session = readSession();
    try {
      if (session) {
        await this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
      }
    } finally {
      window.localStorage.removeItem(SESSION_KEY);
    }
  },

  async request<T>(path: string, init: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
    const session = readSession();
    const headers = new Headers(init.headers);
    if (session) headers.set('Authorization', `Bearer ${session.token}`);
    if (init.body !== undefined && init.body !== null && typeof init.body !== 'string') {
      headers.set('Content-Type', 'application/json');
    }
    const body = init.body !== undefined && init.body !== null && typeof init.body !== 'string'
      ? JSON.stringify(init.body)
      : init.body;
    return decodeResponse<T>(await fetch(`/api${path}`, { ...init, headers, body }));
  },

  async requestText<T>(path: string, body: string): Promise<T> {
    const session = readSession();
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        Authorization: session ? `Bearer ${session.token}` : '',
        'Content-Type': 'text/csv',
      },
      body,
    });
    return decodeResponse<T>(response);
  },

  async download(path: string): Promise<Blob> {
    const session = readSession();
    const response = await fetch(`/api${path}`, {
      headers: session ? { Authorization: `Bearer ${session.token}` } : {},
    });
    if (!response.ok) {
      await decodeResponse<never>(response);
    }
    return response.blob();
  },

  async publicRequest<T>(path: string): Promise<T> {
    return decodeResponse<T>(await fetch(`/api${path}`));
  },
};
