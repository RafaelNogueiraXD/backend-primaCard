import prisma from '../../config/database';
import { addMinutes, differenceInMinutes, differenceInHours } from '../../utils/dateUtils';
import { config } from '../../config';
import { PointsService } from '../points/points.service';
import { ReferralService } from '../referrals/referral.service';
import { NotificationService } from '../notifications/notification.service';

const pointsService = new PointsService();
const referralService = new ReferralService();
const notificationService = new NotificationService();

export class AppointmentService {
  async create(data: {
    professionalId: string;
    patientId: string;
    procedureId: string;
    startsAt: Date;
    createdById: string;
    idempotencyKey?: string;
  }): Promise<any> {
    // Check idempotency
    if (data.idempotencyKey) {
      const existing = await prisma.appointment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) return existing;
    }

    // Get procedure
    const procedure = await prisma.procedure.findUnique({
      where: { id: data.procedureId },
    });

    if (!procedure || !procedure.isActive) {
      throw new Error('Procedure not found or inactive');
    }

    const endsAt = addMinutes(data.startsAt, procedure.defaultDurationMinutes);

    // Check for double booking - professional
    // Ensure dates are valid Date objects
    if (isNaN(data.startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new Error('Invalid date provided');
    }

    const professionalConflict = await prisma.appointment.findFirst({
      where: {
        professionalId: data.professionalId,
        status: { notIn: ['CANCELED_BY_PATIENT', 'CANCELED_BY_PROFESSIONAL', 'NO_SHOW_PATIENT'] },
        OR: [
          { AND: [{ startsAt: { lte: data.startsAt } }, { endsAt: { gt: data.startsAt } }] },
          { AND: [{ startsAt: { lt: endsAt } }, { endsAt: { gte: endsAt } }] },
          { AND: [{ startsAt: { gte: data.startsAt } }, { endsAt: { lte: endsAt } }] },
        ],
      },
    });

    if (professionalConflict) {
      throw new Error('Professional is not available at this time');
    }

    // Check for double booking - patient
    const patientConflict = await prisma.appointment.findFirst({
      where: {
        patientId: data.patientId,
        status: { notIn: ['CANCELED_BY_PATIENT', 'CANCELED_BY_PROFESSIONAL', 'NO_SHOW_PATIENT'] },
        OR: [
          { AND: [{ startsAt: { lte: data.startsAt } }, { endsAt: { gt: data.startsAt } }] },
          { AND: [{ startsAt: { lt: endsAt } }, { endsAt: { gte: endsAt } }] },
          { AND: [{ startsAt: { gte: data.startsAt } }, { endsAt: { lte: endsAt } }] },
        ],
      },
    });

    if (patientConflict) {
      throw new Error('Patient already has an appointment at this time');
    }

    // Create snapshot
    const snapshot = {
      procedureId: procedure.id,
      name: procedure.name,
      category: procedure.category,
      pointsGeneral: procedure.pointsGeneral,
      pointsCategory: procedure.pointsCategory,
      version: procedure.version,
    };

    // Determine initial status
    const status = data.createdById === data.professionalId ? 'SCHEDULED' : 'REQUESTED';

    const appointment = await prisma.appointment.create({
      data: {
        professionalId: data.professionalId,
        patientId: data.patientId,
        procedureId: data.procedureId,
        startsAt: data.startsAt,
        endsAt,
        procedureSnapshot: snapshot,
        status,
        createdById: data.createdById,
        idempotencyKey: data.idempotencyKey,
      },
      include: {
        professional: { include: { user: true } },
        patient: true,
        procedure: true,
      },
    });

    return appointment;
  }

  async accept(appointmentId: string, professionalId: string): Promise<any> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    if (appointment.status !== 'REQUESTED') {
      throw new Error('Appointment cannot be accepted in current state');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'SCHEDULED' },
    });

    // Notify patient
    try {
      const snapshot = appointment.procedureSnapshot as any;
      await notificationService.create({
        userId: appointment.patientId,
        type: 'APPOINTMENT_ACCEPTED',
        title: 'Consulta Confirmada',
        message: `Sua consulta para ${snapshot?.name || 'procedimento'} foi confirmada pelo especialista.`,
        data: { appointmentId }
      });
    } catch (error) {
      console.error('Failed to create notification for appointment acceptance:', error);
    }

    return updated;
  }

  async cancel(
    appointmentId: string,
    userId: string,
    role: string,
    reason?: string
  ): Promise<any> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Check authorization
    if (role === 'PATIENT' && appointment.patientId !== userId) {
      throw new Error('Not authorized');
    } else if (role === 'PROFESSIONAL') {
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });
      if (!professional || appointment.professionalId !== professional.id) {
        throw new Error('Not authorized');
      }
    }

    if (!['REQUESTED', 'SCHEDULED'].includes(appointment.status)) {
      throw new Error('Appointment cannot be canceled in current state');
    }

    const hoursUntilAppointment = differenceInHours(appointment.startsAt, new Date());
    const isLateCancellation = hoursUntilAppointment < config.cancellation.penaltyHours;

    const newStatus =
      role === 'PATIENT' ? 'CANCELED_BY_PATIENT' : 'CANCELED_BY_PROFESSIONAL';

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: newStatus,
        canceledById: userId,
        canceledReason: reason,
        canceledAt: new Date(),
      },
    });

    // Apply penalty if late cancellation by patient
    if (role === 'PATIENT' && isLateCancellation) {
      await pointsService.createTransaction({
        userId: appointment.patientId,
        bucket: 'general',
        delta: -config.cancellation.lateCancelPenaltyPoints,
        cause: 'LATE_CANCEL_PENALTY',
        referenceType: 'appointment',
        referenceId: appointmentId,
      });
    }

    return updated;
  }

  async markArrival(
    appointmentId: string,
    professionalId: string,
    arrivalMarkedAt?: Date
  ): Promise<any> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    if (appointment.status !== 'SCHEDULED') {
      throw new Error('Cannot mark arrival for this appointment');
    }

    const arrival = arrivalMarkedAt || new Date();
    const minutesDiff = differenceInMinutes(arrival, appointment.startsAt);

    let punctualityFlag: 'EXACT' | 'WITHIN_TOLERANCE' | 'LATE' | 'NO_SHOW';

    if (minutesDiff === 0) {
      punctualityFlag = 'EXACT';
    } else if (minutesDiff > 0 && minutesDiff <= config.punctuality.toleranceMinutes) {
      punctualityFlag = 'WITHIN_TOLERANCE';
    } else if (minutesDiff > config.punctuality.toleranceMinutes) {
      punctualityFlag = 'LATE';
    } else {
      punctualityFlag = 'LATE'; // Early arrival treated as on time
    }

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        arrivalMarkedAt: arrival,
        punctualityFlag,
      },
    });
  }

  async complete(appointmentId: string, professionalId: string): Promise<any> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { procedure: true },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    if (appointment.status !== 'SCHEDULED') {
      throw new Error('Cannot complete this appointment');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        pointsGrantedAt: new Date(),
      },
    });

    // Grant points to patient
    await pointsService.grantProcedurePoints(
      appointmentId,
      appointment.patientId,
      appointment.procedureSnapshot,
      appointment.punctualityFlag ?? undefined
    );

    // Check and complete referral if this is user's first appointment
    await referralService.checkAndCompleteReferral(appointment.patientId);

    return updated;
  }

  async markNoShow(appointmentId: string, professionalId: string): Promise<any> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'NO_SHOW_PATIENT',
        punctualityFlag: 'NO_SHOW',
      },
    });

    // Apply no-show penalty
    await pointsService.createTransaction({
      userId: appointment.patientId,
      bucket: 'general',
      delta: -config.cancellation.lateCancelPenaltyPoints * 2, // Double penalty for no-show
      cause: 'NO_SHOW_PENALTY',
      referenceType: 'appointment',
      referenceId: appointmentId,
    });

    return updated;
  }

  async getById(appointmentId: string, userId: string, role: string): Promise<any> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        professional: { include: { user: true } },
        patient: true,
        reviews: true,
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Check authorization
    if (appointment.patientId === userId) {
      return appointment;
    }
    
    if (role === 'PROFESSIONAL') {
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });
      if (professional && appointment.professionalId === professional.id) {
        return appointment;
      }
    }

    throw new Error('Not authorized');
  }

  async list(filters: {
    userId: string;
    role: string;
    status?: string;
    from?: Date;
    to?: Date;
    page?: number;
    perPage?: number;
  }): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = {};

    if (filters.role === 'PATIENT') {
      where.patientId = filters.userId;
    } else if (filters.role === 'PROFESSIONAL') {
      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId: filters.userId },
      });
      if (!professional) {
        // If user is not a professional, return empty list instead of throwing error
        // This can happen if a user has PROFESSIONAL role but no professional profile yet
        return {
          data: [],
          meta: {
            page,
            perPage,
            total: 0,
            totalPages: 0,
          },
        };
      }
      where.professionalId = professional.id;
    }

    if (filters.status) {
      if (filters.status.includes(',')) {
        where.status = { in: filters.status.split(',') };
      } else {
        where.status = filters.status;
      }
    }

    if (filters.from || filters.to) {
      where.startsAt = {};
      if (filters.from) where.startsAt.gte = filters.from;
      if (filters.to) where.startsAt.lte = filters.to;
    }

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { startsAt: 'desc' },
        include: {
          professional: { include: { user: true } },
          patient: true,
          procedure: true,
          reviews: true,
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get available time slots for a professional on a specific date
   */
  async getAvailableSlots(
    professionalId: string,
    date: Date,
    procedureId?: string
  ): Promise<{ slots: Array<{ start: string; end: string; available: boolean }> }> {
    // Get the professional
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    // Get schedule settings
    const scheduleSettings = professional.scheduleSettings as any || {
      weeklySchedule: [
        { day: 0, enabled: false },
        { day: 1, enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 2, enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 3, enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 4, enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 5, enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 6, enabled: false },
      ],
      appointmentDuration: 30,
      bufferTime: 5,
    };

    // Get procedure duration or use default
    let slotDuration = scheduleSettings.appointmentDuration || 30;
    
    if (procedureId) {
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });
      if (procedure) {
        slotDuration = procedure.defaultDurationMinutes;
      }
    }

    const bufferTime = scheduleSettings.bufferTime || 5;

    // Get the day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = date.getDay();
    const daySchedule = scheduleSettings.weeklySchedule?.find((d: any) => d.day === dayOfWeek);

    // If day is not enabled, return empty
    if (!daySchedule || !daySchedule.enabled) {
      return { slots: [] };
    }

    // Check if date is blocked
    const dateString = date.toISOString().split('T')[0];
    const blockedDates = scheduleSettings.blockedDates || [];
    const isBlocked = blockedDates.some((b: any) => b.date === dateString);
    
    if (isBlocked) {
      return { slots: [] };
    }

    // Parse work hours
    const [startHour, startMin] = daySchedule.start.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end.split(':').map(Number);

    // Get all existing appointments for this professional on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        startsAt: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELED_BY_PATIENT', 'CANCELED_BY_PROFESSIONAL', 'NO_SHOW_PATIENT', 'NO_SHOW_PROFESSIONAL'] },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Generate all possible slots
    const slots: Array<{ start: string; end: string; available: boolean }> = [];
    
    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMin, 0, 0);
    
    const workEndTime = new Date(date);
    workEndTime.setHours(endHour, endMin, 0, 0);

    // Parse break times if applicable
    let breakStart: Date | null = null;
    let breakEnd: Date | null = null;
    
    if (daySchedule.break && daySchedule.breakStart && daySchedule.breakEnd) {
      const [breakStartHour, breakStartMin] = daySchedule.breakStart.split(':').map(Number);
      const [breakEndHour, breakEndMin] = daySchedule.breakEnd.split(':').map(Number);
      
      breakStart = new Date(date);
      breakStart.setHours(breakStartHour, breakStartMin, 0, 0);
      
      breakEnd = new Date(date);
      breakEnd.setHours(breakEndHour, breakEndMin, 0, 0);
    }

    while (currentTime < workEndTime) {
      const slotStart = new Date(currentTime);
      const slotEnd = addMinutes(slotStart, slotDuration);
      
      // Check if slot ends after work hours
      if (slotEnd > workEndTime) {
        break;
      }

      const startString = `${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`;
      const endString = `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`;

      // Check if slot is during break
      let isDuringBreak = false;
      if (breakStart && breakEnd) {
        isDuringBreak = (slotStart < breakEnd && slotEnd > breakStart);
      }

      // Check if slot conflicts with existing appointments
      let hasConflict = false;
      for (const appt of existingAppointments) {
        const apptStart = new Date(appt.startsAt);
        const apptEnd = new Date(appt.endsAt);
        
        // Add buffer time consideration
        const apptStartWithBuffer = addMinutes(apptStart, -bufferTime);
        const apptEndWithBuffer = addMinutes(apptEnd, bufferTime);
        
        if (slotStart < apptEndWithBuffer && slotEnd > apptStartWithBuffer) {
          hasConflict = true;
          break;
        }
      }

      // Check if slot is in the past
      const now = new Date();
      const isPast = slotStart < now;

      slots.push({
        start: startString,
        end: endString,
        available: !isDuringBreak && !hasConflict && !isPast,
      });

      // Move to next slot (slot duration + buffer)
      currentTime = addMinutes(currentTime, slotDuration + bufferTime);
    }

    return { slots };
  }

  /**
   * Get available dates for a professional in a date range
   */
  async getAvailableDates(
    professionalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ dates: Array<{ date: string; hasAvailableSlots: boolean }> }> {
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    const scheduleSettings = professional.scheduleSettings as any || {
      weeklySchedule: [
        { day: 0, enabled: false },
        { day: 1, enabled: true },
        { day: 2, enabled: true },
        { day: 3, enabled: true },
        { day: 4, enabled: true },
        { day: 5, enabled: true },
        { day: 6, enabled: false },
      ],
      blockedDates: [],
    };

    const blockedDates = new Set((scheduleSettings.blockedDates || []).map((b: any) => b.date));
    const dates: Array<{ date: string; hasAvailableSlots: boolean }> = [];

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const daySchedule = scheduleSettings.weeklySchedule?.find((d: any) => d.day === dayOfWeek);

      const isEnabled = daySchedule?.enabled || false;
      const isBlocked = blockedDates.has(dateString);
      const isPast = current < new Date(new Date().toISOString().split('T')[0]);

      dates.push({
        date: dateString,
        hasAvailableSlots: isEnabled && !isBlocked && !isPast,
      });

      current.setDate(current.getDate() + 1);
    }

    return { dates };
  }
}
