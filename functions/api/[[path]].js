import { handleApi } from '../../server/router.mjs';
export const onRequest = context => handleApi(context.request, context.env);
