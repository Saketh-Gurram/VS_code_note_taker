import type { WebviewToHostMsg, HostToWebviewMsg } from './types';

interface VsCodeApi {
  postMessage(msg: WebviewToHostMsg): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Acquire once and reuse — calling multiple times throws
const api: VsCodeApi = (typeof acquireVsCodeApi !== 'undefined')
  ? acquireVsCodeApi()
  : {
      postMessage: (msg) => console.log('[mock postMessage]', msg),
      getState: () => undefined,
      setState: () => {},
    };

export function postMessage(msg: WebviewToHostMsg): void {
  api.postMessage(msg);
}

export function getState<T>(): T | undefined {
  return api.getState<T>();
}

export function setState<T>(state: T): void {
  api.setState(state);
}

export function onMessage(handler: (msg: HostToWebviewMsg) => void): () => void {
  const listener = (event: MessageEvent) => handler(event.data as HostToWebviewMsg);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
