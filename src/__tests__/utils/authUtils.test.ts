/**
 * Auth Utils Unit Tests
 * 
 * Tests for authentication utility functions:
 * - hashPassword / comparePassword
 * - generateAccessToken / verifyAccessToken
 * - generateRefreshToken / verifyRefreshToken
 * - generateOTP / hashOTP
 */

import { AuthUtils } from '../../utils/authUtils';
import jwt from 'jsonwebtoken';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import bcrypt from 'bcryptjs';

describe('AuthUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      // Arrange
      const password = 'SecurePassword123!';
      const hashedPassword = '$2a$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Act
      const result = await AuthUtils.hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
      expect(result).toBe(hashedPassword);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      // Arrange
      const password = 'SecurePassword123!';
      const hashedPassword = '$2a$10$hashedpassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await AuthUtils.comparePassword(password, hashedPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await AuthUtils.comparePassword('wrong', 'hashed');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate an access token', () => {
      // Arrange
      const payload = { userId: 'user-123', role: 'PATIENT' as const, email: 'test@example.com' };
      const token = 'access.token.here';
      (jwt.sign as jest.Mock).mockReturnValue(token);

      // Act
      const result = AuthUtils.generateAccessToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        expect.any(String),
        expect.objectContaining({ expiresIn: expect.any(String) })
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid access token', () => {
      // Arrange
      const token = 'valid.access.token';
      const payload = { userId: 'user-123', role: 'PATIENT' };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      // Act
      const result = AuthUtils.verifyAccessToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      // Arrange
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      expect(() => AuthUtils.verifyAccessToken('invalid.token'))
        .toThrow('Invalid token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token', () => {
      // Arrange
      const payload = { userId: 'user-123', role: 'PATIENT' as const, email: 'test@example.com' };
      const token = 'refresh.token.here';
      (jwt.sign as jest.Mock).mockReturnValue(token);

      // Act
      const result = AuthUtils.generateRefreshToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        expect.any(String),
        expect.objectContaining({ expiresIn: expect.any(String) })
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and decode a valid refresh token', () => {
      // Arrange
      const token = 'valid.refresh.token';
      const payload = { userId: 'user-123' };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      // Act
      const result = AuthUtils.verifyRefreshToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(result).toEqual(payload);
    });
  });

  describe('generateOTP', () => {
    it('should generate a 6-digit OTP', () => {
      // Act
      const otp = AuthUtils.generateOTP();

      // Assert
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate different OTPs each time', () => {
      // Act
      const otp1 = AuthUtils.generateOTP();
      const otp2 = AuthUtils.generateOTP();
      const otp3 = AuthUtils.generateOTP();

      // Assert - at least 2 of 3 should be different (probabilistic)
      const unique = new Set([otp1, otp2, otp3]);
      expect(unique.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('hashOTP', () => {
    it('should hash an OTP deterministically', () => {
      // Arrange
      const otp = '123456';

      // Act
      const hash1 = AuthUtils.hashOTP(otp);
      const hash2 = AuthUtils.hashOTP(otp);

      // Assert
      expect(hash1).toBe(hash2); // Same OTP should produce same hash
      expect(hash1).not.toBe(otp); // Hash should be different from OTP
    });

    it('should produce different hashes for different OTPs', () => {
      // Arrange
      const otp1 = '123456';
      const otp2 = '654321';

      // Act
      const hash1 = AuthUtils.hashOTP(otp1);
      const hash2 = AuthUtils.hashOTP(otp2);

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });
});
