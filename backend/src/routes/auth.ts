import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { Prisma } from '../generated/prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

// Schemas for request bodies for validation and safty
const registerBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 3 },
    password: { type: 'string', minLength: 6 },
  },
  required: ['username', 'password'],
};

const loginBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    password: { type: 'string' },
    rememberMe: { type: 'boolean', default: false },
    deviceFingerprint: { type: 'string' },
  },
  required: ['username', 'password', 'deviceFingerprint'],
};

const refreshBodySchema = {
  type: 'object',
  properties: {
    deviceFingerprint: { type: 'string' },
  },
  required: ['deviceFingerprint'],
};

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'change-me-in-production') {
  console.warn('WARNING: Using default JWT_SECRET in production. Set JWT_SECRET environment variable.');
}
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const COOKIE_MAX_AGE = ACCESS_TOKEN_EXPIRY;
const REFRESH_COOKIE_MAX_AGE = (rm: boolean) => { return rm ? 60 * 60 * 24 * 30 : 60 * 60 * 24 }; // 30d or 1d

const LOCKOUT_MAX_ATTEMPTS = parseInt(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS || '5', 10);
const LOCKOUT_WINDOW_MINUTES = parseInt(process.env.AUTH_LOCKOUT_WINDOW_MINUTES || '15', 10);
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.AUTH_LOCKOUT_DURATION_MINUTES || '15', 10);

type LockoutEntry = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const loginAttempts = new Map<string, LockoutEntry>();

const nowMs = () => Date.now();
const lockoutWindowMs = () => LOCKOUT_WINDOW_MINUTES * 60 * 1000;
const lockoutDurationMs = () => LOCKOUT_DURATION_MINUTES * 60 * 1000;

const getLockoutKey = (username: string) => username.trim().toLowerCase();

const isLockedOut = (entry: LockoutEntry | undefined) => {
  if (!entry?.lockedUntil) return false;
  return entry.lockedUntil > nowMs();
};

const recordFailedAttempt = (key: string) => {
  const current = loginAttempts.get(key);
  const now = nowMs();

  if (!current || now - current.firstAttemptAt > lockoutWindowMs()) {
    loginAttempts.set(key, { attempts: 1, firstAttemptAt: now });
    return loginAttempts.get(key)!;
  }

  current.attempts += 1;
  if (current.attempts >= LOCKOUT_MAX_ATTEMPTS) {
    current.lockedUntil = now + lockoutDurationMs();
  }

  return current;
};

const clearLockout = (key: string) => {
  loginAttempts.delete(key);
};

const setCsrfCookie = (reply: FastifyReply, maxAge?: number) => {
  const token = randomBytes(32).toString('hex');
  reply.setCookie('csrfToken', token, {
    path: '/',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: maxAge || 60 * 60 * 24 * 7, // Default 7 days
  });
  return token;
};

// Device fingerprinting utilities
const hashDeviceFingerprint = (fingerprint: string): string => {
  return createHash('sha256').update(fingerprint).digest('hex');
};

const generateRefreshToken = (): string => {
  return randomBytes(64).toString('hex');
};

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // Rate limiting for auth routes
  const authRateLimit = {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  };

  // POST /api/auth/register
  fastify.post(
    '/register',
    {
      schema: { body: registerBodySchema },
      ...authRateLimit,
    },
    async (request, reply) => {
      // Type assertion for the validated request body
      const { username, password } = request.body as {
        username: string;
        password: string;
      };

      try {
        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await fastify.prisma.user.create({
          data: {
            username: username,
            password: hashedPassword,
            settings: {}, // Default empty settings
          },
        });

        // Send back 201 Created and the new user (excluding password)
        // We select which fields to return.
        return reply.status(201).send({
          id: user.id,
          username: user.username,
        });

      } catch (error: unknown) {
        // Handle potential errors
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' // Unique constraint violation
        ) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'Username already exists.',
          });
        }

        // Generic server error
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  // POST /api/auth/login
  fastify.post(
    '/login',
    {
      schema: { body: loginBodySchema },
      ...authRateLimit,
    },
    async (request, reply) => {
      const { username, password, rememberMe = false, deviceFingerprint } = request.body as {
        username: string;
        password: string;
        rememberMe?: boolean;
        deviceFingerprint: string;
      };

      try {
        const lockoutKey = getLockoutKey(username);
        const existingLockout = loginAttempts.get(lockoutKey);
        if (isLockedOut(existingLockout)) {
          return reply.status(429).send({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Account temporarily locked. Please try again later.',
          });
        }

        // Find the user by their unique username
        const user = await fastify.prisma.user.findUnique({
          where: { username },

        });

        // Case 1: User not found
        if (!user) {
          const entry = recordFailedAttempt(lockoutKey);
          if (isLockedOut(entry)) {
            return reply.status(429).send({
              statusCode: 429,
              error: 'Too Many Requests',
              message: 'Account temporarily locked. Please try again later.',
            });
          }
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid username or password.',
          });
        }

        // Case 2: User found, compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Case 3: Password does not match
        if (!isPasswordValid) {
          const entry = recordFailedAttempt(lockoutKey);
          if (isLockedOut(entry)) {
            return reply.status(429).send({
              statusCode: 429,
              error: 'Too Many Requests',
              message: 'Account temporarily locked. Please try again later.',
            });
          }
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid username or password.',
          });
        }

        // Case 4: Success - Create short-lived access token and long-lived refresh token
        clearLockout(lockoutKey);

        // Generate short-lived access token (15 minutes)
        const deviceHash = hashDeviceFingerprint(deviceFingerprint);
        const accessToken = jwt.sign(
          {
            userId: user.id,
            username: user.username,
            deviceHash,
          },
          JWT_SECRET,
          { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        // Generate refresh token for database
        const refreshTokenValue = generateRefreshToken();
        const refreshTokenExpiry = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE(rememberMe) * 1000);

        // Store refresh token in database
        await fastify.prisma.refreshToken.create({
          data: {
            userId: user.id,
            token: refreshTokenValue,
            deviceHash,
            expiresAt: refreshTokenExpiry,
          },
        });

        // Set access token cookie (short-lived, 15 minutes)
        reply.setCookie('sessionId', accessToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: COOKIE_MAX_AGE,
          signed: true,
        });

        reply.setCookie('refreshToken', refreshTokenValue, {
          path: '/api/auth/refresh', // Only sent to refresh endpoint
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: REFRESH_COOKIE_MAX_AGE(rememberMe),
          signed: true,
        });

        // Set CSRF token (match access token expiration)
        setCsrfCookie(reply, COOKIE_MAX_AGE);
        // only send back non-sensitive fields
        const user_response = {
          id: user.id,
          username: user.username,
          settings: user.settings,
          expiresIn: ACCESS_TOKEN_EXPIRY,
        }
        return reply.status(200).send(user_response);

      } catch (error) {
        // Generic server error
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  // POST /api/auth/refresh
  fastify.post(
    '/refresh',
    {
      schema: { body: refreshBodySchema },
      ...authRateLimit,
    },
    async (request, reply) => {
      const { deviceFingerprint } = request.body as { deviceFingerprint: string };

      try {
        // Get refresh token from cookie
        const refreshTokenValue = request.unsignCookie(
          request.cookies.refreshToken || ''
        ).value;

        if (!refreshTokenValue) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'No refresh token provided',
          });
        }

        // Find refresh token in database
        const refreshToken = await fastify.prisma.refreshToken.findUnique({
          where: { token: refreshTokenValue },
          include: { user: true },
        });

        if (!refreshToken) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid refresh token',
          });
        }

        // Check expiration
        if (refreshToken.expiresAt < new Date()) {
          await fastify.prisma.refreshToken.delete({
            where: { id: refreshToken.id },
          });
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Refresh token expired',
          });
        }

        // Verify device fingerprint
        const deviceHash = hashDeviceFingerprint(deviceFingerprint);
        if (refreshToken.deviceHash !== deviceHash) {
          // Device mismatch - possible token theft!
          fastify.log.warn({
            userId: refreshToken.userId,
            expectedDevice: refreshToken.deviceHash,
            actualDevice: deviceHash,
          }, 'Device fingerprint mismatch - possible token theft');

          // Invalidate this refresh token
          await fastify.prisma.refreshToken.delete({
            where: { id: refreshToken.id },
          });

          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Device verification failed',
          });
        }

        // Generate new access token
        const accessToken = jwt.sign(
          {
            userId: refreshToken.user.id,
            username: refreshToken.user.username,
            deviceHash,
          },
          JWT_SECRET,
          { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        // Update last used timestamp
        await fastify.prisma.refreshToken.update({
          where: { id: refreshToken.id },
          data: { lastUsedAt: new Date() },
        });

        // Set new access token cookie
        reply.setCookie('sessionId', accessToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: COOKIE_MAX_AGE,
          signed: true,
        });

        // Regenerate CSRF token
        setCsrfCookie(reply, COOKIE_MAX_AGE);

        return {
          id: refreshToken.user.id,
          username: refreshToken.user.username,
          settings: refreshToken.user.settings,
          expiresIn: ACCESS_TOKEN_EXPIRY,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    try {
      // Get user ID from access token if available
      const token = request.unsignCookie(request.cookies.sessionId || '').value;
      let userId: string | null = null;

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          userId = decoded.userId;
        } catch (e) {
          // Token invalid, that's ok
        }
      }

      // Get refresh token
      const refreshTokenValue = request.unsignCookie(
        request.cookies.refreshToken || ''
      ).value;

      // Delete refresh token from database
      if (refreshTokenValue) {
        try {
          await fastify.prisma.refreshToken.delete({
            where: { token: refreshTokenValue },
          });
        } catch (e) {
          // Token not found, that's ok
        }
      }

      // Clear cookies
      reply.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      reply.clearCookie('refreshToken', {
        path: '/api/auth/refresh',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      reply.clearCookie('csrfToken', {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      return reply.status(200).send({ message: 'Logged out successfully.' });
    } catch (error) {
      // Generic server error
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during logout.',
      });
    }
  });

  // POST /api/auth/logout-all
  fastify.post(
    '/logout-all',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = request.user!;

        // Delete all refresh tokens for this user
        await fastify.prisma.refreshToken.deleteMany({
          where: { userId: user.id },
        });

        // Clear current cookies
        reply.clearCookie('sessionId', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
        reply.clearCookie('refreshToken', {
          path: '/api/auth/refresh',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
        reply.clearCookie('csrfToken', {
          path: '/',
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });

        return {
          message: 'Logged out from all devices successfully',
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  // GET /api/auth/me ---
  fastify.get('/me', async (request, reply) => {
    try {
      // Get the signed sessionId from the cookie
      const token = request.unsignCookie(request.cookies.sessionId || '').value;

      // Case 1: No session cookie or invalid signature
      if (!token) {
        request.log.debug('Auth check failed: No session token provided');
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Case 2: Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      } catch (err) {
        // Clear the bad cookie
        reply.clearCookie('sessionId', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or expired session token.',
        });
      }

      // Case 3: Find user by the ID from JWT
      const user = await fastify.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          settings: true,
        },
      });

      // Case 4: User not found
      if (!user) {
        reply.clearCookie('sessionId', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'User not found.',
        });
      }

      if (!request.cookies.csrfToken) {
        setCsrfCookie(reply);
      }

      // Case 5: Success
      return reply.status(200).send(user);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
      });
    }
  });
};

export default authRoutes;
