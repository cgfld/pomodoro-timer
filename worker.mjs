import { handleApi } from './server/router.mjs';
export default {
  fetch(request,env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.tomodo.app') {
      url.hostname = 'tomodo.app';
      return Response.redirect(url.href, 308);
    }
    return url.pathname.startsWith('/api/') ? handleApi(request,env) : env.ASSETS.fetch(request);
  }
};
