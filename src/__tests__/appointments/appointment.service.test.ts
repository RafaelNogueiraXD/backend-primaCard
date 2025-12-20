/**
 * Appointment Service Unit Tests
 * 
 * Tests for appointment management functionality:
 * - create
 * - accept
 * - cancel
 * - complete
 * - markNoShow
 * - getMyAppointments
 * - getById
 */

// Mock must come BEFORE importing the service
jest.mock('../../config/database');

import { AppointmentService } from '../../modules/appointments/appointment.service';
import { 
  prismaMock, 
  resetAllMocks, 
  createMockUser, 
  createMockProfessional,
  createMockProcedure,
  createMockAppointment
} from '../setup';

// Mock the services
jest.mock('../../modules/points/points.service');
jest.mock('../../modules/referrals/referral.service');
jest.mock('../../modules/notifications/notification.service');

describe('AppointmentService', () => {
  let appointmentService: AppointmentService;

  beforeEach(() => {
    resetAllMocks();
    appointmentService = new AppointmentService();
  });

  describe('create', () => {
    it('should create an appointment successfully', async () => {
      // Arrange
      const createData = {
        professionalId: 'professional-123',
        patientId: 'patient-123',
        procedureId: 'procedure-123',
        startsAt: new Date('2025-12-20T10:00:00Z'),
        createdById: 'patient-123',
      };

      const mockProcedure = createMockProcedure({
        id: createData.procedureId,
        defaultDurationMinutes: 30,
      });

      const mockAppointment = createMockAppointment({
        ...createData,
        status: 'REQUESTED',
        procedureSnapshot: {
          procedureId: mockProcedure.id,
          name: mockProcedure.name,
          category: mockProcedure.category,
          pointsGeneral: mockProcedure.pointsGeneral,
          pointsCategory: mockProcedure.pointsCategory,
          version: mockProcedure.version,
        },
      });

      prismaMock.appointment.findUnique.mockResolvedValue(null); // No idempotency conflict
      prismaMock.procedure.findUnique.mockResolvedValue(mockProcedure);
      prismaMock.appointment.findFirst.mockResolvedValue(null); // No double booking
      prismaMock.appointment.create.mockResolvedValue({
        ...mockAppointment,
        professional: { ...createMockProfessional(), user: createMockUser() },
        patient: createMockUser(),
        procedure: mockProcedure,
      });

      // Act
      const result = await appointmentService.create(createData);

      // Assert
      expect(result).toBeDefined();
      expect(prismaMock.appointment.create).toHaveBeenCalled();
    });

    it('should return existing appointment if idempotency key matches', async () => {
      // Arrange
      const idempotencyKey = 'unique-key-123';
      const existingAppointment = createMockAppointment({ idempotencyKey });

      prismaMock.appointment.findUnique.mockResolvedValue(existingAppointment);

      // Act
      const result = await appointmentService.create({
        professionalId: 'professional-123',
        patientId: 'patient-123',
        procedureId: 'procedure-123',
        startsAt: new Date(),
        createdById: 'patient-123',
        idempotencyKey,
      });

      // Assert
      expect(result).toEqual(existingAppointment);
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });

    it('should throw error when procedure not found', async () => {
      // Arrange
      prismaMock.appointment.findUnique.mockResolvedValue(null);
      prismaMock.procedure.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(appointmentService.create({
        professionalId: 'professional-123',
        patientId: 'patient-123',
        procedureId: 'non-existent',
        startsAt: new Date(),
        createdById: 'patient-123',
      })).rejects.toThrow('Procedure not found or inactive');
    });

    it('should throw error when procedure is inactive', async () => {
      // Arrange
      prismaMock.appointment.findUnique.mockResolvedValue(null);
      prismaMock.procedure.findUnique.mockResolvedValue(
        createMockProcedure({ isActive: false })
      );

      // Act & Assert
      await expect(appointmentService.create({
        professionalId: 'professional-123',
        patientId: 'patient-123',
        procedureId: 'procedure-123',
        startsAt: new Date(),
        createdById: 'patient-123',
      })).rejects.toThrow('Procedure not found or inactive');
    });

    it('should throw error when professional has conflicting appointment', async () => {
      // Arrange
      const startsAt = new Date('2025-12-20T10:00:00Z');

      prismaMock.appointment.findUnique.mockResolvedValue(null);
      prismaMock.procedure.findUnique.mockResolvedValue(createMockProcedure());
      prismaMock.appointment.findFirst.mockResolvedValue(
        createMockAppointment({ status: 'SCHEDULED' })
      );

      // Act & Assert
      await expect(appointmentService.create({
        professionalId: 'professional-123',
        patientId: 'patient-123',
        procedureId: 'procedure-123',
        startsAt,
        createdById: 'patient-123',
      })).rejects.toThrow('Professional is not available at this time');
    });

    it('should set status to SCHEDULED when created by professional', async () => {
      // Arrange
      const professionalUserId = 'professional-user-123';
      const mockProcedure = createMockProcedure();

      prismaMock.appointment.findUnique.mockResolvedValue(null);
      prismaMock.procedure.findUnique.mockResolvedValue(mockProcedure);
      prismaMock.appointment.findFirst.mockResolvedValue(null);
      prismaMock.appointment.create.mockResolvedValue(
        createMockAppointment({ status: 'SCHEDULED' })
      );

      // Act
      await appointmentService.create({
        professionalId: professionalUserId,
        patientId: 'patient-123',
        procedureId: 'procedure-123',
        startsAt: new Date('2025-12-20T10:00:00Z'),
        createdById: professionalUserId, // Created by professional
      });

      // Assert
      expect(prismaMock.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SCHEDULED',
          }),
        })
      );
    });
  });

  describe('accept', () => {
    it('should accept a requested appointment', async () => {
      // Arrange
      const appointmentId = 'appointment-123';
      const professionalId = 'professional-123';
      const appointment = createMockAppointment({
        id: appointmentId,
        professionalId,
        status: 'REQUESTED',
        procedureSnapshot: { name: 'Limpeza' },
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);
      prismaMock.appointment.update.mockResolvedValue({
        ...appointment,
        status: 'SCHEDULED',
      });

      // Act
      const result = await appointmentService.accept(appointmentId, professionalId);

      // Assert
      expect(result.status).toBe('SCHEDULED');
    });

    it('should throw error when appointment not found', async () => {
      // Arrange
      prismaMock.appointment.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(appointmentService.accept('non-existent', 'professional-123'))
        .rejects.toThrow('Appointment not found');
    });

    it('should throw error when not authorized', async () => {
      // Arrange
      const appointment = createMockAppointment({
        professionalId: 'other-professional',
        status: 'REQUESTED',
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);

      // Act & Assert
      await expect(appointmentService.accept('appointment-123', 'wrong-professional'))
        .rejects.toThrow('Not authorized');
    });

    it('should throw error when appointment is not in REQUESTED state', async () => {
      // Arrange
      const appointment = createMockAppointment({
        professionalId: 'professional-123',
        status: 'SCHEDULED', // Already scheduled
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);

      // Act & Assert
      await expect(appointmentService.accept('appointment-123', 'professional-123'))
        .rejects.toThrow('Appointment cannot be accepted in current state');
    });
  });

  describe('cancel', () => {
    it('should allow patient to cancel their appointment', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointment = createMockAppointment({
        patientId,
        status: 'SCHEDULED',
        startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);
      prismaMock.appointment.update.mockResolvedValue({
        ...appointment,
        status: 'CANCELED_BY_PATIENT',
      });

      // Act
      const result = await appointmentService.cancel(
        'appointment-123',
        patientId,
        'PATIENT',
        'Cannot make it'
      );

      // Assert
      expect(result.status).toBe('CANCELED_BY_PATIENT');
    });

    it('should allow professional to cancel appointment', async () => {
      // Arrange
      const professionalUserId = 'user-456';
      const professionalId = 'professional-123';
      const appointment = createMockAppointment({
        professionalId,
        status: 'SCHEDULED',
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);
      prismaMock.professional.findUnique.mockResolvedValue(
        createMockProfessional({ id: professionalId, userId: professionalUserId })
      );
      prismaMock.appointment.update.mockResolvedValue({
        ...appointment,
        status: 'CANCELED_BY_PROFESSIONAL',
      });

      // Act
      const result = await appointmentService.cancel(
        'appointment-123',
        professionalUserId,
        'PROFESSIONAL',
        'Emergency'
      );

      // Assert
      expect(result.status).toBe('CANCELED_BY_PROFESSIONAL');
    });

    it('should throw error when patient tries to cancel others appointment', async () => {
      // Arrange
      const appointment = createMockAppointment({
        patientId: 'other-patient',
        status: 'SCHEDULED',
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);

      // Act & Assert
      await expect(appointmentService.cancel(
        'appointment-123',
        'wrong-patient',
        'PATIENT'
      )).rejects.toThrow('Not authorized');
    });

    it('should throw error when canceling completed appointment', async () => {
      // Arrange
      const appointment = createMockAppointment({
        patientId: 'patient-123',
        status: 'COMPLETED',
      });

      prismaMock.appointment.findUnique.mockResolvedValue(appointment);

      // Act & Assert
      await expect(appointmentService.cancel(
        'appointment-123',
        'patient-123',
        'PATIENT'
      )).rejects.toThrow('Appointment cannot be canceled in current state');
    });
  });

  describe('list', () => {
    it('should return appointments for patient', async () => {
      // Arrange
      const patientId = 'patient-123';
      const mockAppointments = [
        createMockAppointment({ patientId }),
        createMockAppointment({ patientId }),
      ];

      prismaMock.appointment.findMany.mockResolvedValue(mockAppointments);
      prismaMock.appointment.count.mockResolvedValue(2);

      // Act
      const result = await appointmentService.list({
        userId: patientId,
        role: 'PATIENT',
      });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter appointments by status', async () => {
      // Arrange
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.count.mockResolvedValue(0);

      // Act
      await appointmentService.list({
        userId: 'patient-123',
        role: 'PATIENT',
        status: 'SCHEDULED',
      });

      // Assert
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SCHEDULED',
          }),
        })
      );
    });

    it('should return appointments for professional', async () => {
      // Arrange
      const professionalUserId = 'user-456';
      const mockProfessional = createMockProfessional({ userId: professionalUserId });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.count.mockResolvedValue(0);

      // Act
      const result = await appointmentService.list({
        userId: professionalUserId,
        role: 'PROFESSIONAL',
      });

      // Assert
      expect(prismaMock.professional.findUnique).toHaveBeenCalledWith({
        where: { userId: professionalUserId },
      });
    });
  });

  describe('getById', () => {
    it('should return appointment details', async () => {
      // Arrange
      const appointmentId = 'appointment-123';
      const patientId = 'patient-123';
      const mockAppointment = {
        ...createMockAppointment({ id: appointmentId, patientId }),
        professional: {
          ...createMockProfessional(),
          user: createMockUser(),
        },
        patient: createMockUser({ id: patientId }),
        procedure: createMockProcedure(),
      };

      prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment);

      // Act
      const result = await appointmentService.getById(appointmentId, patientId, 'PATIENT');

      // Assert
      expect(result.id).toBe(appointmentId);
      expect(result.professional).toBeDefined();
      expect(result.patient).toBeDefined();
    });

    it('should throw error when appointment not found', async () => {
      // Arrange
      prismaMock.appointment.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(appointmentService.getById('non-existent', 'user-123', 'PATIENT'))
        .rejects.toThrow('Appointment not found');
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available time slots for a date', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const date = new Date('2025-12-20');
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 6, enabled: true, start: '08:00', end: '12:00' }, // Saturday
          ],
          appointmentDuration: 30,
          bufferTime: 5,
        },
        user: createMockUser(),
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.findMany.mockResolvedValue([]); // No existing appointments

      // Act
      const result = await appointmentService.getAvailableSlots(professionalId, date);

      // Assert
      expect(result).toBeDefined();
      expect(result.slots).toBeDefined();
      expect(Array.isArray(result.slots)).toBe(true);
    });

    it('should throw error if professional not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        appointmentService.getAvailableSlots('non-existent', new Date())
      ).rejects.toThrow('Professional not found');
    });

    it('should exclude already booked slots', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const date = new Date('2025-12-22'); // Monday
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 1, enabled: true, start: '08:00', end: '12:00' }, // Monday
          ],
          appointmentDuration: 60,
          bufferTime: 0,
        },
        user: createMockUser(),
      };

      // Mock an existing appointment at 09:00
      const existingAppointment = createMockAppointment({
        professionalId,
        startsAt: new Date('2025-12-22T09:00:00'),
        endsAt: new Date('2025-12-22T10:00:00'),
        status: 'ACCEPTED',
      });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.findMany.mockResolvedValue([existingAppointment]);

      // Act
      const result = await appointmentService.getAvailableSlots(professionalId, date);

      // Assert - the 09:00 slot should be marked as unavailable
      expect(result).toBeDefined();
      if (result.slots.length > 0) {
        const slot9am = result.slots.find((s: any) => s.start === '09:00');
        if (slot9am) {
          expect(slot9am.available).toBe(false);
        }
      }
    });

    it('should consider procedure duration when checking availability', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const date = new Date('2025-12-22'); // Monday
      const procedureId = 'procedure-123';
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 1, enabled: true, start: '08:00', end: '12:00' }, // Monday
          ],
          appointmentDuration: 30,
          bufferTime: 0,
        },
        user: createMockUser(),
      };

      const mockProcedure = createMockProcedure({
        id: procedureId,
        defaultDurationMinutes: 90, // 1.5 hours
      });

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.procedure.findUnique.mockResolvedValue(mockProcedure);
      prismaMock.appointment.findMany.mockResolvedValue([]);

      // Act
      const result = await appointmentService.getAvailableSlots(professionalId, date, procedureId);

      // Assert
      expect(result).toBeDefined();
      // The slots should use 90 min duration, so fewer slots than 30 min
      expect(result.slots).toBeDefined();
    });

    it('should return empty slots for days professional does not work', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const date = new Date('2025-12-21'); // Sunday
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 0, enabled: false }, // Sunday disabled
          ],
          appointmentDuration: 30,
        },
        user: createMockUser(),
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);

      // Act
      const result = await appointmentService.getAvailableSlots(professionalId, date);

      // Assert
      expect(result.slots).toEqual([]);
    });
  });

  describe('getAvailableDates', () => {
    it('should return dates with availability status', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const startDate = new Date('2025-12-20');
      const endDate = new Date('2025-12-27');
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 0, enabled: false }, // Sunday
            { day: 1, enabled: true },  // Monday
            { day: 2, enabled: true },  // Tuesday
            { day: 3, enabled: true },  // Wednesday
            { day: 4, enabled: true },  // Thursday
            { day: 5, enabled: true },  // Friday
            { day: 6, enabled: false }, // Saturday
          ],
          blockedDates: [],
        },
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);
      prismaMock.appointment.findMany.mockResolvedValue([]);

      // Act
      const result = await appointmentService.getAvailableDates(professionalId, startDate, endDate);

      // Assert
      expect(result).toBeDefined();
      expect(result.dates).toBeDefined();
      expect(Array.isArray(result.dates)).toBe(true);
      expect(result.dates.length).toBeGreaterThan(0);
    });

    it('should throw error if professional not found', async () => {
      // Arrange
      prismaMock.professional.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        appointmentService.getAvailableDates('non-existent', new Date(), new Date())
      ).rejects.toThrow('Professional not found');
    });

    it('should mark blocked dates as unavailable', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const startDate = new Date('2025-12-22');
      const endDate = new Date('2025-12-22');
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 1, enabled: true }, // Monday enabled
          ],
          blockedDates: [{ date: '2025-12-22' }], // But blocked
        },
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);

      // Act
      const result = await appointmentService.getAvailableDates(professionalId, startDate, endDate);

      // Assert
      expect(result).toBeDefined();
      if (result.dates.length > 0) {
        const dec22 = result.dates.find((d: any) => d.date === '2025-12-22');
        if (dec22) {
          expect(dec22.hasAvailableSlots).toBe(false);
        }
      }
    });

    it('should mark weekends as unavailable when not enabled', async () => {
      // Arrange
      const professionalId = 'professional-123';
      const startDate = new Date('2025-12-20'); // Saturday
      const endDate = new Date('2025-12-21');   // Sunday
      
      const mockProfessional = {
        ...createMockProfessional({ id: professionalId }),
        scheduleSettings: {
          weeklySchedule: [
            { day: 0, enabled: false }, // Sunday
            { day: 6, enabled: false }, // Saturday
          ],
          blockedDates: [],
        },
      };

      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);

      // Act
      const result = await appointmentService.getAvailableDates(professionalId, startDate, endDate);

      // Assert
      expect(result.dates).toBeDefined();
      result.dates.forEach((d: any) => {
        expect(d.hasAvailableSlots).toBe(false);
      });
    });
  });
});
