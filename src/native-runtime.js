import { invoke } from '@tauri-apps/api/core';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

const origin = 'https://tomodo.app';
let permission = 'default';
window.TomodoNative = Object.freeze({
  origin,
  redirectTo: 'tomodo://auth/callback',
  storage: {
    getItem: key => invoke('auth_read', { key }),
    setItem: (key, value) => invoke('auth_write', { key, value }),
    removeItem: key => invoke('auth_remove', { key })
  },
  fetch: (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, origin);
    const headers = new Headers(options.headers);
    if (url.origin === origin) headers.set('Origin', origin);
    return nativeFetch(url.href, { ...options, headers });
  },
  openUrl,
  async listenForAuth(callback) {
    await onOpenUrl(urls => { for (const url of urls) callback(url); });
    for (const url of await getCurrent() || []) await callback(url);
  },
  get notificationPermission() { return permission; },
  async requestNotificationPermission() {
    permission = await requestPermission();
    return permission;
  },
  notify: (title, body) => sendNotification({ title, body })
});
// Keep browser notification UI in sync with the native permission state.
isPermissionGranted().then(granted => {
  permission = granted ? 'granted' : 'default';
  window.dispatchEvent(new Event('tomodo:notifications'));
}).catch(() => {});
