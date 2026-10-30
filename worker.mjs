import { handleApi } from './server/router.mjs';
export default {
  fetch(request,env) {
    return new URL(request.url).pathname.startsWith('/api/') ? handleApi(request,env) : env.ASSETS.fetch(request);
  }
};
