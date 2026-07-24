/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as originalCreateClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

export const customProxyFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let originalUrl = '';
  if (typeof input === 'string') {
    originalUrl = input;
  } else if (input instanceof URL) {
    originalUrl = input.toString();
  } else if (input instanceof Request) {
    originalUrl = input.url;
  }

  // If on the server side (SSR), fetch directly since CORS doesn't apply
  if (typeof window === 'undefined') {
    return fetch(input, init);
  }

  if (originalUrl.includes('supabase.co')) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isDevEnv = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('run.app');
    
    if (!isDevEnv) {
      // In production (e.g. Cloudflare Pages static), fetch directly to Supabase to bypass non-existent server proxy
      return fetch(input, init);
    }

    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const proxyUrl = `${base}/api/supabase-proxy?url=${encodeURIComponent(originalUrl)}`;
    const options: RequestInit = {
      method: init?.method || (input instanceof Request ? input.method : 'GET'),
    };

    const headers = new Headers();
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    } else if (input instanceof Request && input.headers) {
      input.headers.forEach((value, key) => {
        headers.set(key, value);
      });
    }
    options.headers = headers;

    if (init?.body !== undefined) {
      options.body = init.body;
    } else if (input instanceof Request && input.body) {
      options.body = await input.text();
    }

    try {
      const response = await fetch(proxyUrl, options);
      if (!response.ok && (response.status === 404 || response.status === 500 || response.status === 502 || response.status === 504)) {
        console.warn(`Proxy fetch returned status ${response.status}. Falling back to direct Supabase connection.`);
        return fetch(input, init);
      }
      return response;
    } catch (err) {
      console.warn('Proxy fetch failed, falling back to direct Supabase connection:', err);
      return fetch(input, init);
    }
  }

  return fetch(input, init);
};

export function createClient(supabaseUrl: string, supabaseKey: string, options?: SupabaseClientOptions<any>): SupabaseClient {
  const mergedOptions: SupabaseClientOptions<any> = {
    ...options,
    global: {
      ...options?.global,
      fetch: customProxyFetch,
    },
  };
  return originalCreateClient(supabaseUrl, supabaseKey, mergedOptions);
}
