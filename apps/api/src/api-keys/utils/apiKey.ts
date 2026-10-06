import { createHash, randomBytes } from 'crypto';

export const API_KEY_START = 'vgl_live_';

// A new key looks like vgl_live_ followed by 48 random hex characters.
// The first 8 of those are the "prefix": safe to show in lists, so people
// can tell which key is which without ever seeing the whole thing again.
export function generateApiKey() {
  const random = randomBytes(24).toString('hex');
  return { key: API_KEY_START + random, prefix: random.slice(0, 8) };
}

// Keys are stored hashed, like passwords, so a leaked database can't be
// used to send alerts. The pepper is a secret that lives in .env, not in
// the database, so the hashes are useless without it.
export function hashApiKey(key: string) {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    throw new Error('API_KEY_PEPPER is missing from .env');
  }
  return createHash('sha256')
    .update(key + pepper)
    .digest('hex');
}
