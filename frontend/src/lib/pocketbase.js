import PocketBase from 'pocketbase';
const endpoint = import.meta.env.VITE_POCKETBASE_URL;
if (!endpoint) throw new Error('Set VITE_POCKETBASE_URL in frontend/.env.local');
const pb = new PocketBase(endpoint);
export default pb;
