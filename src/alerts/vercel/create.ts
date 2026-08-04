import { handleCreateAlertRequest, type VercelLikeRequest, type VercelLikeResponse } from '../http.js';

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse): Promise<void> {
  await handleCreateAlertRequest(req, res);
}
