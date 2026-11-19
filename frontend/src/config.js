// Configuración pública del frontend (factor III).
// En Docker llega por runtime-config.js; en desarrollo por import.meta.env.
const runtime = window.__TIENDA_CONFIG__ || {};
const read = (name) => (runtime[name] || import.meta.env[name] || "").trim();

export const config = {
  apiUrl: read("VITE_API_URL").replace(/\/+$/, ""),
  firebase: {
    apiKey: read("VITE_FIREBASE_API_KEY"),
    authDomain: read("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: read("VITE_FIREBASE_PROJECT_ID"),
    appId: read("VITE_FIREBASE_APP_ID"),
  },
};

export const missing = Object.entries({
  VITE_API_URL: config.apiUrl,
  VITE_FIREBASE_API_KEY: config.firebase.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.firebase.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.firebase.projectId,
  VITE_FIREBASE_APP_ID: config.firebase.appId,
}).filter(([, v]) => !v).map(([k]) => k);
