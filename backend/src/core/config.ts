import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(8).optional(),
  COOKIE_SECRET: z.string().min(8).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().optional(),
  AUTH_LOCKOUT_WINDOW_MINUTES: z.coerce.number().optional(),
  AUTH_LOCKOUT_DURATION_MINUTES: z.coerce.number().optional()
});

// Lazy validation - only parse when config is accessed
let _config: z.infer<typeof envSchema> | undefined;

export function getConfig() {
  if (!_config) {
    _config = envSchema.parse(process.env);
  }
  return _config;
}

// For backward compatibility, export a getter that validates on first access
export const config = new Proxy({} as z.infer<typeof envSchema>, {
  get(target, prop) {
    const cfg = getConfig();
    return cfg[prop as keyof typeof cfg];
  }
});
