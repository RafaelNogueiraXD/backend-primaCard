/**
 * Professional Schedule Settings Unit Tests
 * 
 * Tests for the schedule settings functionality in the Professional Service.
 * This covers getScheduleSettings and updateScheduleSettings methods.
 */

// Mock must come BEFORE importing the service
jest.mock('../../config/database');

import { ProfessionalService } from '../../modules/professionals/professional.service';
import { 
  prismaMock, 
  resetAllMocks, 
  createMockUser, 
  createMockProfessional,
  createMockScheduleSettings 
} from '../setup';

describe('ProfessionalService - Schedule Settings', () => {
  let professionalService: ProfessionalService;

  beforeEach(() => {
    resetAllMocks();
    professionalService = new ProfessionalService();
  });

  describe('getScheduleSettings', () => {
    it('should return schedule settings for a professional with existing settings', async () => {
      // Arrange
      const userId = 'user-123';
      const existingSettings = createMockScheduleSettings({
        appointmentDuration: 45,
        bufferTime: 10,
      });

      const mockUser = createMockUser({ id: userId, role: 'PROFESSIONAL' });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.professional.findUnique.mockResolvedValue({
        scheduleSettings: existingSettings,
      });

      // Act
      const result = await professionalService.getScheduleSettings(userId);

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(existingSettings);
      expect(result.appointmentDuration).toBe(45);
      expect(result.bufferTime).toBe(10);
    });

    it('should return default settings when professional has no scheduleSettings', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId, role: 'PROFESSIONAL' });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.professional.findUnique.mockResolvedValue({
        scheduleSettings: null,
      });

      // Act
      const result = await professionalService.getScheduleSettings(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.weeklySchedule).toHaveLength(7);
      expect(result.appointmentDuration).toBe(30);
      expect(result.bufferTime).toBe(5);
      expect(result.blockedDates).toEqual([]);
    });

    it('should return default settings for PROFESSIONAL user without professional record', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId, role: 'PROFESSIONAL' });
      const defaultSettings = createMockScheduleSettings();

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.professional.findUnique.mockResolvedValue(null);
      prismaMock.professional.create.mockResolvedValue({
        id: 'new-professional-123',
        userId,
        registrationNumber: `TEMP-${userId.substring(0, 8)}-${Date.now()}`,
        specialty: 'Não informado',
        scheduleSettings: defaultSettings,
      } as any);

      // Act
      const result = await professionalService.getScheduleSettings(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.weeklySchedule).toHaveLength(7);
      expect(result.appointmentDuration).toBe(30);
    });

    it('should throw error when user is not a professional', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId, role: 'PATIENT' });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(professionalService.getScheduleSettings(userId))
        .rejects.toThrow('User is not a professional');
    });

    it('should throw error when user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';

      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.getScheduleSettings(userId))
        .rejects.toThrow('User not found');
    });

    it('should return correct weekly schedule structure', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId, role: 'PROFESSIONAL' });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.professional.findUnique.mockResolvedValue({
        scheduleSettings: null,
      });

      // Act
      const result = await professionalService.getScheduleSettings(userId);

      // Assert
      expect(result.weeklySchedule[0].dayName).toBe('Domingo');
      expect(result.weeklySchedule[0].enabled).toBe(false);
      expect(result.weeklySchedule[1].dayName).toBe('Segunda');
      expect(result.weeklySchedule[1].enabled).toBe(true);
      expect(result.weeklySchedule[1].start).toBe('08:00');
      expect(result.weeklySchedule[1].end).toBe('17:00');
      expect(result.weeklySchedule[6].dayName).toBe('Sábado');
    });
  });

  describe('updateScheduleSettings', () => {
    it('should update schedule settings for existing professional', async () => {
      // Arrange
      const userId = 'user-123';
      const newSettings = createMockScheduleSettings({
        appointmentDuration: 60,
        bufferTime: 15,
      });

      const mockProfessional = createMockProfessional({ userId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.professional.update.mockResolvedValue({
        scheduleSettings: newSettings,
      });

      // Act
      const result = await professionalService.updateScheduleSettings(userId, newSettings);

      // Assert
      expect(prismaMock.professional.update).toHaveBeenCalledWith({
        where: { id: mockProfessional.id },
        data: { scheduleSettings: newSettings },
        select: { scheduleSettings: true },
      });
      expect(result).toEqual(newSettings);
    });

    it('should create professional record if missing for PROFESSIONAL user', async () => {
      // Arrange
      const userId = 'user-123';
      const newSettings = createMockScheduleSettings();

      prismaMock.professional.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(
        createMockUser({ id: userId, role: 'PROFESSIONAL' })
      );
      prismaMock.professional.create.mockResolvedValue({
        id: 'new-professional-123',
        scheduleSettings: newSettings,
      });

      // Act
      const result = await professionalService.updateScheduleSettings(userId, newSettings);

      // Assert
      expect(prismaMock.professional.create).toHaveBeenCalledWith({
        data: {
          userId,
          registrationNumber: expect.stringMatching(/^TEMP-.+-\d+$/),
          specialty: 'Não informado',
          scheduleSettings: newSettings,
        },
      });
      expect(result).toEqual(newSettings);
    });

    it('should throw error when trying to update settings for PATIENT user', async () => {
      // Arrange
      const userId = 'user-123';
      const newSettings = createMockScheduleSettings();

      prismaMock.professional.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(
        createMockUser({ id: userId, role: 'PATIENT' })
      );

      // Act & Assert
      await expect(professionalService.updateScheduleSettings(userId, newSettings))
        .rejects.toThrow('Professional not found');
    });

    it('should throw error when user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';
      const newSettings = createMockScheduleSettings();

      prismaMock.professional.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(professionalService.updateScheduleSettings(userId, newSettings))
        .rejects.toThrow('Professional not found');
    });

    it('should update weekly schedule correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const customSettings = createMockScheduleSettings({
        weeklySchedule: [
          { day: 0, dayName: 'Domingo', enabled: true, start: '09:00', end: '13:00', break: false, breakStart: '', breakEnd: '' },
          { day: 1, dayName: 'Segunda', enabled: true, start: '07:00', end: '19:00', break: true, breakStart: '12:00', breakEnd: '14:00' },
          { day: 2, dayName: 'Terça', enabled: false, start: '', end: '', break: false, breakStart: '', breakEnd: '' },
          { day: 3, dayName: 'Quarta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
          { day: 4, dayName: 'Quinta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
          { day: 5, dayName: 'Sexta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
          { day: 6, dayName: 'Sábado', enabled: true, start: '08:00', end: '12:00', break: false, breakStart: '', breakEnd: '' },
        ],
      });

      const mockProfessional = createMockProfessional({ userId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.professional.update.mockResolvedValue({
        scheduleSettings: customSettings,
      });

      // Act
      const result = await professionalService.updateScheduleSettings(userId, customSettings);

      // Assert
      expect(result.weeklySchedule[0].enabled).toBe(true); // Sunday enabled
      expect(result.weeklySchedule[0].start).toBe('09:00');
      expect(result.weeklySchedule[2].enabled).toBe(false); // Tuesday disabled
    });

    it('should update blocked dates correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const settingsWithBlockedDates = createMockScheduleSettings({
        blockedDates: [
          { id: 'blocked-1', date: '2025-12-25', reason: 'Natal' },
          { id: 'blocked-2', date: '2025-01-01', reason: 'Ano Novo' },
        ],
      });

      const mockProfessional = createMockProfessional({ userId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.professional.update.mockResolvedValue({
        scheduleSettings: settingsWithBlockedDates,
      });

      // Act
      const result = await professionalService.updateScheduleSettings(userId, settingsWithBlockedDates);

      // Assert
      expect(result.blockedDates).toHaveLength(2);
      expect(result.blockedDates[0].reason).toBe('Natal');
      expect(result.blockedDates[1].reason).toBe('Ano Novo');
    });

    it('should update appointment duration and buffer time', async () => {
      // Arrange
      const userId = 'user-123';
      const customSettings = createMockScheduleSettings({
        appointmentDuration: 90,
        bufferTime: 20,
      });

      const mockProfessional = createMockProfessional({ userId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.professional.update.mockResolvedValue({
        scheduleSettings: customSettings,
      });

      // Act
      const result = await professionalService.updateScheduleSettings(userId, customSettings);

      // Assert
      expect(result.appointmentDuration).toBe(90);
      expect(result.bufferTime).toBe(20);
    });
  });
});
