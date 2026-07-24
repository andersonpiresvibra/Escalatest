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

    return fetch(proxyUrl, options);
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
