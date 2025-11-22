import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { AuthTokens, JWTPayload } from '../types';

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  static generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  static generateTokens(payload: JWTPayload): AuthTokens {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  }

  static verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
  }

  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  static hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  static generateIdempotencyKey(): string {
    return crypto.randomUUID();
  }
}
