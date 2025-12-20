/**
 * User Service Referral Code Unit Tests
 * 
 * Tests for referral code functionality:
 * - getReferralCode
 * - generateUniqueReferralCode
 * - Code uniqueness validation
 * - Code format validation
 */

// Mock must come BEFORE importing the service
jest.mock('../../config/database');

import { UserService } from '../../modules/users/user.service';
import { 
  prismaMock, 
  resetAllMocks, 
  createMockUser 
} from '../setup';

describe('UserService - Referral Code', () => {
  let userService: UserService;

  beforeEach(() => {
    resetAllMocks();
    userService = new UserService();
  });

  describe('getReferralCode', () => {
    it('should return existing referral code if user already has one', async () => {
      // Arrange
      const userId = 'user-123';
      const existingCode = 'RAFNOG1234';
      const mockUser = createMockUser({
        id: userId,
        referralCode: existingCode,
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result).toEqual({ referralCode: existingCode });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, referralCode: true, firstName: true, lastName: true },
      });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('should generate and save new referral code if user does not have one', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Rafael',
        lastName: 'Nogueira',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      
      // Mock para garantir que o código gerado não existe
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'RAFNOG1234',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(result.referralCode).toMatch(/^[A-Z]{6}\d{4}$/); // 6 letras + 4 números
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { referralCode: expect.any(String) },
      });
    });

    it('should throw error if user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getReferralCode(userId)).rejects.toThrow('User not found');
    });

    it('should generate code with correct format from user name', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Maria',
        lastName: 'Silva',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null); // código não existe

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'MARSIL5678',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toMatch(/^MAR[A-Z]{3}\d{4}$/); // Começa com MAR
    });

    it('should handle names with special characters', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'João',
        lastName: 'D\'Angelo',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'JOADAN1234',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      // O código deve ter pelo menos 8 caracteres (letras + 4 dígitos)
      expect(result.referralCode.length).toBeGreaterThanOrEqual(8);
      expect(result.referralCode).toMatch(/^[A-Z]+\d{4}$/);
      expect(result.referralCode).not.toContain('\'');
      expect(result.referralCode).not.toContain(' ');
    });

    it('should handle short names by padding or using fallback', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Li',
        lastName: 'Wu',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'LIWU001234', // ou formato fallback
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(result.referralCode.length).toBeGreaterThanOrEqual(8);
    });

    it('should retry if generated code already exists', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Rafael',
        lastName: 'Nogueira',
        referralCode: null,
      });

      // Primeira busca: usuário sem código
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      
      // Primeira tentativa: código já existe
      prismaMock.user.findUnique.mockResolvedValueOnce({ 
        id: 'other-user', 
        referralCode: 'RAFNOG1111' 
      } as any);
      
      // Segunda tentativa: código disponível
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'RAFNOG2222',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(3); // 1 para user, 2 para validar código
    });

    it('should use fallback code after max retry attempts', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Common',
        lastName: 'Name',
        referralCode: null,
      });

      // Primeira busca: usuário sem código
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      
      // Todas as tentativas: código já existe (simula colisão)
      for (let i = 0; i < 10; i++) {
        prismaMock.user.findUnique.mockResolvedValueOnce({ 
          id: `other-user-${i}`, 
          referralCode: `COMNAM${1000 + i}` 
        } as any);
      }

      // Fallback deve ser aceito
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'USER1234', // formato fallback
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(result.referralCode).toMatch(/^[A-Z0-9]{8,}$/);
    });
  });

  describe('Code Format Validation', () => {
    it('generated code should be uppercase', async () => {
      // Arrange
      const userId = 'user-123';
      const generatedCode = 'TESTUS5678';
      const mockUserBefore = createMockUser({
        id: userId,
        firstName: 'test',
        lastName: 'user',
        referralCode: null,
      });
      
      const mockUserAfter = {
        ...mockUserBefore,
        referralCode: generatedCode,
      };

      // Primeiro findUnique retorna o usuário sem código
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUserBefore);
      // Segundo findUnique (para verificar unicidade) retorna null
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      // Update retorna o usuário com o código
      prismaMock.user.update.mockResolvedValue(mockUserAfter);

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(result.referralCode).toBe(result.referralCode.toUpperCase());
    });

    it('generated code should not contain spaces', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Test User',
        lastName: 'With Spaces',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockImplementation((args: any) => {
        const code = args.data.referralCode as string;
        expect(code).not.toContain(' ');
        return Promise.resolve({ ...mockUser, referralCode: code });
      });

      // Act
      await userService.getReferralCode(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it('generated code should not contain special characters', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'José',
        lastName: 'O\'Brien',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockImplementation((args: any) => {
        const code = args.data.referralCode as string;
        expect(code).toMatch(/^[A-Z0-9]+$/);
        return Promise.resolve({ ...mockUser, referralCode: code });
      });

      // Act
      await userService.getReferralCode(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalled();
    });
  });

  describe('Idempotency', () => {
    it('should return same code on multiple calls', async () => {
      // Arrange
      const userId = 'user-123';
      const existingCode = 'TESTUS1234';
      const mockUserWithCode = createMockUser({
        id: userId,
        firstName: 'Test',
        lastName: 'User',
        referralCode: existingCode,
      });

      // Mock sempre retorna o usuário com código existente
      prismaMock.user.findUnique.mockResolvedValue(mockUserWithCode);

      // Act
      const result1 = await userService.getReferralCode(userId);
      const result2 = await userService.getReferralCode(userId);
      const result3 = await userService.getReferralCode(userId);

      // Assert
      expect(result1.referralCode).toBe(existingCode);
      expect(result2.referralCode).toBe(existingCode);
      expect(result3.referralCode).toBe(existingCode);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty firstName', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: '',
        lastName: 'LastName',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'LAS1234',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      // Código tem pelo menos os 4 dígitos
      expect(result.referralCode).toMatch(/\d{4}$/);
    });

    it('should handle numeric characters in name', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'User123',
        lastName: 'Test456',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'USETES1234',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(result.referralCode).toMatch(/^[A-Z]+\d+$/);
    });

    it('should handle very long names', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({
        id: userId,
        firstName: 'Alexandrina',
        lastName: 'Constantinopolis',
        referralCode: null,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        referralCode: 'ALECON1234',
      });

      // Act
      const result = await userService.getReferralCode(userId);

      // Assert
      expect(result.referralCode).toBeDefined();
      expect(result.referralCode.length).toBeLessThanOrEqual(20); // Tamanho razoável
    });
  });
});
