/**
 * User Controller Referral Code Unit Tests
 * 
 * Tests for referral code HTTP endpoints:
 * - GET /users/referral-code
 * - Response format validation
 * - Error handling
 */

import { Request, Response, NextFunction } from 'express';
import { UserController } from '../../modules/users/user.controller';
import { UserService } from '../../modules/users/user.service';

// Mock UserService
jest.mock('../../modules/users/user.service');

describe('UserController - Referral Code', () => {
  let userController: UserController;
  let mockRequest: any;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Create mock next
    mockNext = jest.fn();

    // Create controller instance
    userController = new UserController();

    // Get mocked service instance
    mockUserService = (userController as any).userService;
  });

  describe('getReferralCode', () => {
    it('should return referral code successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const referralCode = 'RAFNOG1234';

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockResolvedValue({ referralCode });

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockUserService.getReferralCode).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: { referralCode },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Database error');

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockRejectedValue(error);

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockUserService.getReferralCode).toHaveBeenCalledWith(userId);
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      const error = new Error('User not found');

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockRejectedValue(error);

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should extract userId from authenticated request', async () => {
      // Arrange
      const userId = 'authenticated-user-456';
      const referralCode = 'MARSILVA789';

      mockRequest = {
        user: { userId, role: 'PROFESSIONAL' },
      };

      mockUserService.getReferralCode.mockResolvedValue({ referralCode });

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockUserService.getReferralCode).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: { referralCode },
      });
    });

    it('should work for different user roles', async () => {
      // Arrange
      const testCases = [
        { userId: 'patient-1', role: 'PATIENT', code: 'CODE001' },
        { userId: 'professional-1', role: 'PROFESSIONAL', code: 'CODE002' },
        { userId: 'admin-1', role: 'ADMIN', code: 'CODE003' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        mockRequest = {
          user: { userId: testCase.userId, role: testCase.role },
        };

        mockUserService.getReferralCode.mockResolvedValue({ 
          referralCode: testCase.code 
        });

        // Act
        await userController.getReferralCode(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Assert
        expect(mockUserService.getReferralCode).toHaveBeenCalledWith(testCase.userId);
        expect(mockResponse.json).toHaveBeenCalledWith({
          data: { referralCode: testCase.code },
        });
      }
    });

    it('should return newly generated code on first call', async () => {
      // Arrange
      const userId = 'new-user-123';
      const generatedCode = 'NEWUSER1234';

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockResolvedValue({ 
        referralCode: generatedCode 
      });

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: { referralCode: generatedCode },
      });
    });

    it('should call service only once per request', async () => {
      // Arrange
      const userId = 'user-123';
      const referralCode = 'TEST1234';

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockResolvedValue({ referralCode });

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockUserService.getReferralCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Format', () => {
    it('should return response in correct format', async () => {
      // Arrange
      const userId = 'user-123';
      const referralCode = 'FORMAT1234';

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockResolvedValue({ referralCode });

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referralCode: expect.any(String),
          }),
        })
      );
    });

    it('should not include sensitive user information in response', async () => {
      // Arrange
      const userId = 'user-123';
      const referralCode = 'SECURE1234';

      mockRequest = {
        user: { userId, role: 'PATIENT', email: 'user@test.com' },
      };

      mockUserService.getReferralCode.mockResolvedValue({ referralCode });

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.data).not.toHaveProperty('passwordHash');
      expect(responseCall.data).not.toHaveProperty('email');
      expect(responseCall.data).not.toHaveProperty('phone');
    });
  });

  describe('Error Handling', () => {
    it('should pass database errors to error handler', async () => {
      // Arrange
      const userId = 'user-123';
      const dbError = new Error('Database connection failed');

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockRejectedValue(dbError);

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(dbError);
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass validation errors to error handler', async () => {
      // Arrange
      const userId = 'user-123';
      const validationError = new Error('Invalid user data');

      mockRequest = {
        user: { userId, role: 'PATIENT' },
      };

      mockUserService.getReferralCode.mockRejectedValue(validationError);

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    it('should call next with error when service throws', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Unexpected database error');
      mockRequest = { user: { userId, role: 'PATIENT' } };
      mockUserService.getReferralCode.mockRejectedValue(error);

      // Act
      await userController.getReferralCode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
