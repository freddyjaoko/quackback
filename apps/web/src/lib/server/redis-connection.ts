import type { RedisOptions } from 'ioredis'

/**
 * Extra ioredis options for hosted Redis-compatible stores.
 * `rediss://` enables TLS; platform certs often fail public-CA verification.
 * `family: 4` avoids IPv6 DNS issues on some PaaS dynos.
 */
export function redisConnectionOptions(url: string): RedisOptions {
  if (!url.startsWith('rediss://')) return {}
  return {
    family: 4,
    tls: { rejectUnauthorized: false },
  }
}
