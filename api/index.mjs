import { Firestore } from '@google-cloud/firestore';
import { createApp } from '../server/src/app.mjs';
import { loadConfig } from '../server/src/config.mjs';
import { createFirestoreStore } from '../server/src/firestoreStore.mjs';

// Vercel entry point. Every /v1/* and /healthz request is rewritten here (see vercel.json).
// FIREBASE_SERVICE_ACCOUNT holds the service-account key JSON; it is server-side only.
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? 'null');
if (!credentials?.client_email || !credentials?.private_key) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT must contain a Firebase service-account key.');
}

// Behind Vercel the socket address is the platform's, so rate limiting needs the client header.
const config = loadConfig({ CLIENT_IP_HEADER: 'x-real-ip', ...process.env });
const firestore = new Firestore({
  projectId: credentials.project_id,
  credentials: { client_email: credentials.client_email, private_key: credentials.private_key }
});

export default createApp({
  config,
  store: createFirestoreStore({ firestore, statsCacheSeconds: config.statsCacheSeconds })
}).handler;
