/**
 * Auth Service Unit Tests
 * 
 * Tests for authentication functionality:
 * - register
 * - login
 * - refresh
 * - logout
 * - password reset
 */

// Mock must come BEFORE importing the service
jest.mock('../../config/database');

import { AuthService } from '../../modules/auth/auth.service';
import { AuthUtils } from '../../utils/authUtils';
import { 
  prismaMock, 
  resetAllMocks, 
  createMockUser, 
  createMockProfessional 
} from '../setup';

// Mock AuthUtils
jest.mock('../../utils/authUtils', () => ({
  AuthUtils: {
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    generateTokens: jest.fn(),
    verifyRefreshToken: jest.fn(),
    generateOTP: jest.fn(),
    hashOTP: jest.fn(),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    resetAllMocks();
    authService = new AuthService();
    
    // Default mock implementations
    (AuthUtils.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
    (AuthUtils.comparePassword as jest.Mock).mockResolvedValue(true);
    (AuthUtils.generateAccessToken as jest.Mock).mockReturnValue('access_token');
    (AuthUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh_token');
    (AuthUtils.generateTokens as jest.Mock).mockReturnValue({
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
    });
  });

  describe('register', () => {
    it('should register a new patient successfully', async () => {
      // Arrange
      const registerData = {
        email: 'newuser@test.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '+5511999999999',
        role: 'PATIENT' as const,
      };

      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              ...createMockUser(),
              email: registerData.email,
              firstName: registerData.firstName,
              lastName: registerData.lastName,
            }),
          },
          professional: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(AuthUtils.hashPassword).toHaveBeenCalledWith(registerData.password);
    });

    it('should register a new professional with registration number', async () => {
      // Arrange
      const registerData = {
        email: 'dentist@test.com',
        password: 'SecurePassword123!',
        firstName: 'Dr.',
        lastName: 'Silva',
        phone: '+5511888888888',
        role: 'PROFESSIONAL' as const,
        registrationNumber: 'CRO-SP-12345',
        specialty: 'Odontologia Geral',
      };

      prismaMock.user.findFirst.mockResolvedValue(null);
      
      const mockCreatedUser = createMockUser({
        email: registerData.email,
        role: 'PROFESSIONAL',
      });

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockCreatedUser),
          },
          professional: {
            create: jest.fn().mockResolvedValue(createMockProfessional()),
          },
        };
        return callback(tx);
      });
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      const existingUser = createMockUser({ email: 'existing@test.com' });
      prismaMock.user.findFirst.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register({
        email: 'existing@test.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        phone: '+5511777777777',
        role: 'PATIENT',
      })).rejects.toThrow('Email already registered');
    });

    it('should throw error when phone already exists', async () => {
      // Arrange
      const existingUser = createMockUser({ 
        email: 'different@test.com',
        phone: '+5511999999999' 
      });
      prismaMock.user.findFirst.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register({
        email: 'new@test.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        phone: '+5511999999999',
        role: 'PATIENT',
      })).rejects.toThrow('Phone number already registered');
    });

    it('should throw error when professional is missing registration number', async () => {
      // Arrange
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(createMockUser({ role: 'PROFESSIONAL' })),
          },
          professional: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      // Act & Assert
      await expect(authService.register({
        email: 'dentist@test.com',
        password: 'password',
        firstName: 'Dr.',
        lastName: 'Test',
        phone: '+5511666666666',
        role: 'PROFESSIONAL',
        // Missing registrationNumber and specialty
      })).rejects.toThrow('Registration number and specialty required');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const email = 'user@test.com';
      const password = 'CorrectPassword123!';
      const mockUser = createMockUser({ email });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (AuthUtils.comparePassword as jest.Mock).mockResolvedValue(true);
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(AuthUtils.comparePassword).toHaveBeenCalledWith(password, mockUser.passwordHash);
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login('nonexistent@test.com', 'password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      // Arrange
      const inactiveUser = createMockUser({ isActive: false });
      prismaMock.user.findUnique.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(authService.login('inactive@test.com', 'password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      // Arrange
      const mockUser = createMockUser();
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (AuthUtils.comparePassword as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login('user@test.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const refreshToken = 'valid_refresh_token';
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId });

      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ userId });
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.refreshToken.delete.mockResolvedValue({});
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await authService.refresh(refreshToken);

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ userId: 'user-123' });
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refresh('invalid_token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error when user is inactive', async () => {
      // Arrange
      const refreshToken = 'valid_refresh_token';
      const userId = 'user-123';

      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ userId });
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prismaMock.user.findUnique.mockResolvedValue(createMockUser({ isActive: false }));

      // Act & Assert
      await expect(authService.refresh(refreshToken))
        .rejects.toThrow('User not found or inactive');
    });
  });

  describe('logout', () => {
    it('should logout from specific device when refreshToken provided', async () => {
      // Arrange
      const userId = 'user-123';
      const refreshToken = 'specific_token';

      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      await authService.logout(userId, refreshToken);

      // Assert
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId, token: refreshToken },
      });
    });

    it('should logout from all devices when no refreshToken provided', async () => {
      // Arrange
      const userId = 'user-123';

      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      // Act
      await authService.logout(userId);

      // Assert
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate OTP for existing user', async () => {
      // Arrange
      const email = 'user@test.com';
      const mockUser = createMockUser({ email });
      const otp = '123456';

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (AuthUtils.generateOTP as jest.Mock).mockReturnValue(otp);
      (AuthUtils.hashOTP as jest.Mock).mockReturnValue('hashed_otp');
      prismaMock.oTPCode.create.mockResolvedValue({});

      // Act
      const result = await authService.requestPasswordReset(email);

      // Assert
      expect(result).toBe(otp);
      expect(prismaMock.oTPCode.create).toHaveBeenCalled();
    });

    it('should return generic message for non-existent user (security)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await authService.requestPasswordReset('nonexistent@test.com');

      // Assert
      expect(result).toBe('If the email exists, a reset code will be sent');
      expect(prismaMock.oTPCode.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid OTP', async () => {
      // Arrange
      const email = 'user@test.com';
      const otp = '123456';
      const newPassword = 'NewSecurePassword123!';
      const mockUser = createMockUser({ email });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (AuthUtils.hashOTP as jest.Mock).mockReturnValue('hashed_otp');
      prismaMock.oTPCode.findFirst.mockResolvedValue({
        id: 'otp-123',
        userId: mockUser.id,
        codeHash: 'hashed_otp',
        purpose: 'password_reset',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      (AuthUtils.hashPassword as jest.Mock).mockResolvedValue('new_hashed_password');
      prismaMock.$transaction.mockResolvedValue([{}, {}]);

      // Act
      await authService.resetPassword(email, otp, newPassword);

      // Assert
      expect(AuthUtils.hashPassword).toHaveBeenCalledWith(newPassword);
    });

    it('should throw error for invalid OTP', async () => {
      // Arrange
      const email = 'user@test.com';
      const mockUser = createMockUser({ email });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      (AuthUtils.hashOTP as jest.Mock).mockReturnValue('hashed_otp');
      prismaMock.oTPCode.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.resetPassword(email, 'invalid', 'newpassword'))
        .rejects.toThrow('Invalid or expired OTP');
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.resetPassword('nonexistent@test.com', '123456', 'newpassword'))
        .rejects.toThrow('Invalid request');
    });
  });
});
