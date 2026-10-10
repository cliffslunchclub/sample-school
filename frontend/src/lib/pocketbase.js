import { isSampleSite, DEMO_MESSAGE } from './site';
import PocketBase from 'pocketbase';
const endpoint = import.meta.env.VITE_POCKETBASE_URL;
if (!endpoint) throw new Error('Set VITE_POCKETBASE_URL in frontend/.env.local');
const pb = new PocketBase(endpoint);
pb.beforeSend = (url, options) => {
  const method = String(options.method || 'GET').toUpperCase();
  const authRequest = /\/api\/collections\/users\/auth-(with-password|refresh)(?:\?|$)/.test(url);
  const previewRequest = /\/api\/import\/parse-csv(?:\?|$)/.test(url);
  if (isSampleSite && !['GET', 'HEAD'].includes(method) && !authRequest && !previewRequest) {
    window.alert(DEMO_MESSAGE);
    throw new Error(DEMO_MESSAGE);
  }
  options.headers = { ...options.headers, 'X-School-Slug': import.meta.env.VITE_SCHOOL_SLUG || 'sample' };
  return { url, options };
};
export default pb;

