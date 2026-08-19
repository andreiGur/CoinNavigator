import { handleMatchRequest } from '../match/http.js';
import type { VercelLikeRequest, VercelLikeResponse } from '../http.js';

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse): Promise<void> {
  await handleMatchRequest(req, res);
}
