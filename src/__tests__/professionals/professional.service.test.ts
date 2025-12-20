/**
 * Professional Service Unit Tests
 * 
 * Tests for general Professional Service functionality:
 * - list
 * - getById
 * - getProcedures
 * - getReviews
 * - updateProfile
 * - getStatistics
 * - getDashboard
 * - getClients
 */

// Mock must come BEFORE importing the service
jest.mock('../../config/database');

import { ProfessionalService } from '../../modules/professionals/professional.service';
import { 
  prismaMock, 
  resetAllMocks, 
  createMockUser, 
  createMockProfessional,
  createMockProcedure,
  createMockReview,
  createMockAppointment
} from '../setup';

describe('ProfessionalService', () => {
  let professionalService: ProfessionalService;

  beforeEach(() => {
    resetAllMocks();
    professionalService = new ProfessionalService();
  });

  describe('list', () => {
    it('should list professionals with pagination', async () => {
      // Arrange
      const mockProfessionals = [
        {
          ...createMockProfessional({ id: 'prof-1' }),
          user: createMockUser({ id: 'user-1', firstName: 'Dr.', lastName: 'Silva' }),
          _count: { appointments: 10 },
        },
        {
          ...createMockProfessional({ id: 'prof-2' }),
          user: createMockUser({ id: 'user-2', firstName: 'Dr.', lastName: 'Santos' }),
          _count: { appointments: 5 },
        },
      ];

      prismaMock.professional.findMany.mockResolvedValue(mockProfessionals);
      prismaMock.professional.count.mockResolvedValue(2);
      prismaMock.review.findMany.mockResolvedValue([]);

      // Act
      const result = await professionalService.list({ page: 1, perPage: 10 });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter professionals by specialty', async () => {
      // Arrange
      prismaMock.professional.findMany.mockResolvedValue([]);
      prismaMock.professional.count.mockResolvedValue(0);

      // Act
      await professionalService.list({ specialty: 'Ortodontia' });

      // Assert
      expect(prismaMock.professional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { specialty: { contains: 'Ortodontia' } },
        })
      );
    });

    it('should filter professionals by search term', async () => {
      // Arrange
      prismaMock.professional.findMany.mockResolvedValue([]);
      prismaMock.professional.count.mockResolvedValue(0);

      // Act
      await professionalService.list({ search: 'Silva' });

      // Assert
      expect(prismaMock.professional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user: {
              OR: [
                { firstName: { contains: 'Silva' } },
                { lastName: { contains: 'Silva' } },
                { email: { contains: 'Silva' } },
              ],
            },
          },
        })
      );
    });

    it('should calculate average rating for each professional', async () => {
      // Arrange
      const mockProfessional = {
        ...createMockProfessional({ id: 'prof-1', userId: 'user-1' }),
        user: createMockUser(),
        _count: { appointments: 10 },
      };

      prismaMock.professional.findMany.mockResolvedValue([mockProfessional]);
      prismaMock.professional.count.mockResolvedValue(1);
      prismaMock.review.findMany.mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
      ]);

      // Act
      const result = await professionalService.list({});

      // Assert
      expect(result.data[0].averageRating).toBeCloseTo(4.7, 1);
      expect(result.data[0].totalReviews).toBe(3);
    });
  });

  describe('getById', () => {
    it('should return professional by ID', async () => {
      // Arrange
      const professionalId = 'prof-123';
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        user: createMockUser(),
        procedures: [createMockProcedure()],
        _count: { appointments: 5 },
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.review.findMany.mockResolvedValue([{ rating: 5 }]);

      // Act
      const result = await professionalService.getById(professionalId);

      // Assert
      expect(result.id).toBe(professionalId);
      expect(result.averageRating).toBe(5);
    });

    it('should throw error when professional not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.getById('non-existent'))
        .rejects.toThrow('Professional not found');
    });
  });

  describe('getProcedures', () => {
    it('should return procedures for a professional', async () => {
      // Arrange
      const professionalId = 'prof-123';
      const mockProcedures = [
        createMockProcedure({ id: 'proc-1', name: 'Limpeza' }),
        createMockProcedure({ id: 'proc-2', name: 'Clareamento' }),
      ];

      prismaMock.professional.findUnique.mockResolvedValue(createMockProfessional());
      prismaMock.procedure.findMany.mockResolvedValue(mockProcedures);

      // Act
      const result = await professionalService.getProcedures(professionalId);

      // Assert
      expect(result).toHaveLength(2);
      expect(prismaMock.procedure.findMany).toHaveBeenCalledWith({
        where: { professionalId },
        orderBy: { name: 'asc' },
      });
    });

    it('should throw error when professional not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.getProcedures('non-existent'))
        .rejects.toThrow('Professional not found');
    });
  });

  describe('getReviews', () => {
    it('should return reviews for a professional with pagination', async () => {
      // Arrange
      const professionalId = 'prof-123';
      const mockReviews = [
        { ...createMockReview(), author: createMockUser(), appointment: createMockAppointment() },
      ];

      prismaMock.professional.findUnique.mockResolvedValue({ userId: 'user-456' });
      prismaMock.review.findMany
        .mockResolvedValueOnce(mockReviews) // First call for paginated reviews
        .mockResolvedValueOnce([{ rating: 5 }, { rating: 4 }]); // Second call for all reviews
      prismaMock.review.count.mockResolvedValue(1);

      // Act
      const result = await professionalService.getReviews(professionalId, { page: 1, perPage: 10 });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.averageRating).toBeCloseTo(4.5, 1);
    });

    it('should filter reviews by rating', async () => {
      // Arrange
      const professionalId = 'prof-123';

      prismaMock.professional.findUnique.mockResolvedValue({ userId: 'user-456' });
      prismaMock.review.findMany.mockResolvedValue([]);
      prismaMock.review.count.mockResolvedValue(0);

      // Act
      await professionalService.getReviews(professionalId, { rating: 5 });

      // Assert
      expect(prismaMock.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetId: 'user-456', rating: 5 },
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('should update professional profile', async () => {
      // Arrange
      const userId = 'user-123';
      const updateData = {
        registrationNumber: 'CRO-SP-99999',
        specialty: 'Ortodontia',
        bio: 'Nova bio',
      };

      const mockProfessional = createMockProfessional({ userId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.professional.update.mockResolvedValue({
        ...mockProfessional,
        ...updateData,
        user: createMockUser(),
      });

      // Act
      const result = await professionalService.updateProfile(userId, updateData);

      // Assert
      expect(prismaMock.professional.update).toHaveBeenCalledWith({
        where: { id: mockProfessional.id },
        data: updateData,
        include: expect.any(Object),
      });
    });

    it('should throw error when professional profile not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.updateProfile('non-existent', {}))
        .rejects.toThrow('Professional profile not found');
    });
  });

  describe('getStatistics', () => {
    it('should return professional statistics', async () => {
      // Arrange
      const userId = 'user-123';
      const mockProfessional = createMockProfessional({ userId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(5) // canceled
        .mockResolvedValueOnce(3) // no-show
        .mockResolvedValueOnce(10); // upcoming
      prismaMock.review.findMany.mockResolvedValue([{ rating: 5 }, { rating: 4 }]);

      // Act
      const result = await professionalService.getStatistics(userId);

      // Assert
      expect(result.totalAppointments).toBe(100);
      expect(result.completedAppointments).toBe(80);
      expect(result.completionRate).toBe(80);
      expect(result.averageRating).toBeCloseTo(4.5, 1);
    });

    it('should throw error when professional not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.getStatistics('non-existent'))
        .rejects.toThrow('Professional profile not found');
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard data for professional', async () => {
      // Arrange
      const userId = 'user-123';
      const mockProfessional = {
        ...createMockProfessional({ userId }),
        user: createMockUser({ firstName: 'Dr.', lastName: 'Silva' }),
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.findMany
        .mockResolvedValueOnce([]) // today appointments
        .mockResolvedValueOnce([]) // active clients
        .mockResolvedValueOnce([]); // total points
      prismaMock.appointment.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(20); // month procedures

      // Act
      const result = await professionalService.getDashboard(userId);

      // Assert
      expect(result.stats.professionalName).toBe('Dr. Silva');
      expect(result.todayAppointments).toEqual([]);
    });

    it('should return default dashboard for PROFESSIONAL user without professional record', async () => {
      // Arrange
      const userId = 'user-123';

      prismaMock.professional.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(
        createMockUser({ id: userId, role: 'PROFESSIONAL', firstName: 'Dr.', lastName: 'Test' })
      );

      // Act
      const result = await professionalService.getDashboard(userId);

      // Assert
      expect(result.stats.professionalName).toBe('Dr. Test');
      expect(result.stats.activeClients).toBe(0);
      expect(result.todayAppointments).toEqual([]);
    });

    it('should throw error when user is not a professional', async () => {
      // Arrange
      const userId = 'user-123';

      prismaMock.professional.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(
        createMockUser({ id: userId, role: 'PATIENT' })
      );

      // Act & Assert
      await expect(professionalService.getDashboard(userId))
        .rejects.toThrow('Professional not found');
    });
  });

  describe('getClients', () => {
    it('should return list of clients for professional', async () => {
      // Arrange
      const userId = 'user-123';
      const mockProfessional = createMockProfessional({ userId });
      const mockAppointments = [
        {
          patient: createMockUser({ id: 'patient-1', firstName: 'João', lastName: 'Santos' }),
        },
        {
          patient: createMockUser({ id: 'patient-2', firstName: 'Maria', lastName: 'Oliveira' }),
        },
      ];

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.findMany.mockResolvedValue(mockAppointments);

      // Act
      const result = await professionalService.getClients(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('João Santos');
      expect(result[1].name).toBe('Maria Oliveira');
    });

    it('should throw error when professional not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.getClients('non-existent'))
        .rejects.toThrow('Professional not found');
    });
  });
});
