import { createHash, randomBytes } from 'crypto';

export function generateApiKey() {
  const random = randomBytes(24).toString('hex');

  return {
    key: `vgl_live_${random}`,
    prefix: random.slice(0, 8),
  };
}

export function hashApiKey(key: string) {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    throw new Error('API_KEY_PEPPER is missing from .env');
  }

  return createHash('sha256')
    .update(key + pepper)
    .digest('hex');
}
