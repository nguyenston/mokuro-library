import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin'; // Import fastify-plugin
import { AuthUser } from '../types/fastify'; // Import our new type
import { APIAccessStrategyFactory } from '../lib/strategies/APIAccessStrategyFactory';
import { userAuthCache } from '../lib/caches/userAuthCache';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']); // Used for CSRF check only

// Define the core authentication logic
const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Get the signed sessionId from the cookie
    const token = request.unsignCookie(request.cookies.sessionId || '').value;

    if (!token) {
      request.log.debug('Auth failed: No session token provided');
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        username: string;
        deviceHash?: string;
      };
    } catch (err) {
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

    // Verify device fingerprint - REQUIRED for ALL authenticated requests
    // This ensures that even GET requests (images, files, data) are validated
    // to prevent stolen session cookies from being used on different devices
    if (decoded.deviceHash) {
      const deviceFingerprint = request.headers['x-device-fingerprint'] as string;

      if (!deviceFingerprint) {
        request.log.debug({
          userId: decoded.userId,
          method: request.method,
          url: request.url,
        }, 'Device fingerprint missing in authenticated request');

        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Device fingerprint required for all authenticated requests',
        });
      }

      const deviceHash = createHash('sha256')
        .update(deviceFingerprint)
        .digest('hex');

      if (deviceHash !== decoded.deviceHash) {
        request.log.warn({
          userId: decoded.userId,
          expectedDevice: decoded.deviceHash,
          actualDevice: deviceHash,
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        }, 'Device fingerprint mismatch - possible session theft detected');

        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Device verification failed - session may have been compromised',
        });
      }
    } else {
      // No device hash in token - this should not happen with properly issued tokens
      // Log warning but allow for backward compatibility with old tokens
      request.log.warn({
        userId: decoded.userId,
        method: request.method,
        url: request.url,
      }, 'JWT token missing deviceHash - legacy token detected');
    }


    // Find user by the ID from JWT
    let user = userAuthCache.get(decoded.userId);

    if (!user) {
      // 3. Fallback to Database
      user = await request.server.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, settings: true },
      }) as AuthUser;
    }

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

    userAuthCache.set(decoded.userId, user);

    // --- SUCCESS ---
    // Attach the user to the request object
    request.user = user as AuthUser; // We know this matches our AuthUser type
    request.accessStrategy = APIAccessStrategyFactory.getStrategy(
      request.server,
      user.id
    );

    // CSRF protection for state-changing requests
    if (!SAFE_METHODS.has(request.method)) {
      const csrfHeader = request.headers['x-csrf-token'];
      const csrfCookie = request.cookies.csrfToken;
      if (!csrfCookie || csrfHeader !== csrfCookie) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Invalid or missing CSRF token.',
        });
      }
    }
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Authentication process failed.',
    });
  }
};

// Create the plugin
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorate the fastify instance with the authenticate function
  fastify.decorate('authenticate', authenticate);
};

// Export the plugin using 'fastify-plugin'
// This ensures that our decorations (like 'authenticate')
// are available to all routes and plugins.
export default fp(authPlugin);
