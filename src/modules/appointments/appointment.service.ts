import prisma from '../../config/database';
import { addMinutes, differenceInMinutes, differenceInHours } from '../../utils/dateUtils';
import { config } from '../../config';
import { PointsService } from '../points/points.service';
import { ReferralService } from '../referrals/referral.service';
import { NotificationService } from '../notifications/notification.service';
import emailService from '../../utils/email.service';
import logger from '../../config/logger';

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
        procedureSnapshot: JSON.stringify(snapshot),
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

    // Send email notification to professional about new appointment
    try {
      const professionalUser = appointment.professional.user;
      const patientUser = appointment.patient;
      
      emailService.sendNewAppointmentToProfessional(
        professionalUser.email,
        `${professionalUser.firstName} ${professionalUser.lastName}`,
        `${patientUser.firstName} ${patientUser.lastName}`,
        appointment.procedure.name,
        appointment.startsAt
      ).catch((error) => {
        logger.error(`Failed to send new appointment email to professional ${professionalUser.email}:`, error);
      });

      logger.info(`New appointment notification sent to professional ${professionalUser.email}`);
    } catch (error) {
      // Don't throw error - email failure shouldn't break appointment creation
      logger.error('Error sending new appointment notification email:', error);
    }

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
      include: {
        professional: { include: { user: true } },
        patient: true,
        procedure: true,
      },
    });

    // Notify patient via in-app notification
    try {
      const snapshot = typeof appointment.procedureSnapshot === 'string' 
        ? JSON.parse(appointment.procedureSnapshot) 
        : appointment.procedureSnapshot as any;
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

    // Send email notification to patient
    try {
      const professionalUser = updated.professional.user;
      const patientUser = updated.patient;
      
      emailService.sendAppointmentConfirmedToPatient(
        patientUser.email,
        `${patientUser.firstName} ${patientUser.lastName}`,
        `${professionalUser.firstName} ${professionalUser.lastName}`,
        updated.procedure.name,
        updated.startsAt
      ).catch((error) => {
        logger.error(`Failed to send appointment confirmed email to patient ${patientUser.email}:`, error);
      });

      logger.info(`Appointment confirmed notification sent to patient ${patientUser.email}`);
    } catch (error) {
      // Don't throw error - email failure shouldn't break appointment acceptance
      logger.error('Error sending appointment confirmed notification email:', error);
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
      include: { 
        procedure: true,
        professional: { include: { user: true } },
        patient: true,
      },
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

    // Parse procedureSnapshot from JSON string (SQLite stores as string)
    let snapshot: any = {};
    try {
      snapshot = typeof appointment.procedureSnapshot === 'string'
        ? JSON.parse(appointment.procedureSnapshot)
        : appointment.procedureSnapshot || {};
    } catch (e) {
      console.error('Error parsing procedureSnapshot:', e);
      snapshot = {};
    }
    
    const pointsEarned = snapshot?.pointsGeneral || 0;
    
    await pointsService.grantProcedurePoints(
      appointmentId,
      appointment.patientId,
      snapshot,
      appointment.punctualityFlag ?? undefined
    );

    // Check and complete referral if this is user's first appointment
    await referralService.checkAndCompleteReferral(appointment.patientId);

    // Send email notification to patient about completed appointment
    try {
      const professionalUser = appointment.professional.user;
      const patientUser = appointment.patient;
      
      emailService.sendAppointmentCompletedToPatient(
        patientUser.email,
        `${patientUser.firstName} ${patientUser.lastName}`,
        `${professionalUser.firstName} ${professionalUser.lastName}`,
        appointment.procedure.name,
        pointsEarned
      ).catch((error) => {
        logger.error(`Failed to send appointment completed email to patient ${patientUser.email}:`, error);
      });

      logger.info(`Appointment completed notification sent to patient ${patientUser.email}`);
    } catch (error) {
      // Don't throw error - email failure shouldn't break appointment completion
      logger.error('Error sending appointment completed notification email:', error);
    }

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
   * Integrates professional schedule settings with appointment filtering
   */
  async getAvailableSlots(
    professionalId: string,
    date: Date,
    procedureId?: string
  ): Promise<{ slots: Array<{ start: string; end: string; available: boolean }> }> {
    // Get the professional with schedule settings
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    // Parse schedule settings from JSON string (SQLite stores as string)
    const defaultSettings = {
      weeklySchedule: [
        { day: 0, dayName: 'Domingo', enabled: false, start: '08:00', end: '17:00', break: false, breakStart: '12:00', breakEnd: '13:00' },
        { day: 1, dayName: 'Segunda', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 2, dayName: 'Terça', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 3, dayName: 'Quarta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 4, dayName: 'Quinta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 5, dayName: 'Sexta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
        { day: 6, dayName: 'Sábado', enabled: false, start: '08:00', end: '12:00', break: false, breakStart: '12:00', breakEnd: '13:00' },
      ],
      appointmentDuration: 30,
      bufferTime: 5,
      blockedDates: [],
    };

    // Get schedule settings - parse from JSON string if needed
    let scheduleSettings: any = defaultSettings;
    if (professional.scheduleSettings) {
      try {
        scheduleSettings = typeof professional.scheduleSettings === 'string'
          ? JSON.parse(professional.scheduleSettings)
          : professional.scheduleSettings;
      } catch (e) {
        console.error('Error parsing scheduleSettings:', e);
        scheduleSettings = defaultSettings;
      }
    }

    // STEP 1: Check if day of week is enabled
    const dayOfWeek = date.getDay();
    
    console.log('\n🔍 BACKEND - Verificando disponibilidade');
    console.log('Data recebida:', date.toString());
    console.log('Data ISO:', date.toISOString());
    console.log('Dia da semana (getDay()):', dayOfWeek);
    console.log('Nome do dia:', ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek]);
    
    console.log('\nWeekly Schedule no backend:');
    scheduleSettings.weeklySchedule?.forEach((d: any) => {
      console.log(`  Day ${d.day} (${d.dayName}): enabled=${d.enabled}`);
    });
    
    const daySchedule = scheduleSettings.weeklySchedule?.find((d: any) => d.day === dayOfWeek);
    console.log('\n🎯 Procurando configuração para dia:', dayOfWeek);
    console.log('Configuração encontrada:', daySchedule);
    console.log('Está habilitado?', daySchedule?.enabled);

    if (!daySchedule || !daySchedule.enabled) {
      console.log('❌ DIA NÃO HABILITADO - Retornando 0 slots\n');
      return { slots: [] };
    }
    
    console.log('✅ Dia habilitado, continuando...\n');

    // STEP 2: Check if date is blocked
    const dateString = date.toISOString().split('T')[0];
    const blockedDates = scheduleSettings.blockedDates || [];
    const isDateBlocked = blockedDates.some((b: any) => {
      const blockedDate = typeof b === 'string' ? b : b.date;
      return blockedDate === dateString;
    });
    
    if (isDateBlocked) {
      return { slots: [] };
    }

    // STEP 3: Get slot duration (procedure-specific or professional default)
    let slotDuration = scheduleSettings.appointmentDuration || 30;
    
    if (procedureId) {
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });
      if (procedure && procedure.defaultDurationMinutes) {
        slotDuration = procedure.defaultDurationMinutes;
      }
    }

    const bufferTime = scheduleSettings.bufferTime || 5;
    
    // Interval between slots is always 30 minutes (standard scheduling interval)
    // The slotDuration is used to check if procedure fits, not for incrementing time
    const slotInterval = 30;

    // STEP 4: Parse work hours from schedule
    const [startHour, startMin] = daySchedule.start.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end.split(':').map(Number);

    // STEP 5: Get existing appointments for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        startsAt: { gte: startOfDay, lte: endOfDay },
        status: { 
          notIn: ['CANCELED_BY_PATIENT', 'CANCELED_BY_PROFESSIONAL', 'NO_SHOW_PATIENT', 'NO_SHOW_PROFESSIONAL'] 
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    // STEP 6: Parse break times if applicable
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

    // STEP 7: Generate time slots based on professional configuration
    const slots: Array<{ start: string; end: string; available: boolean }> = [];
    
    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMin, 0, 0);
    
    const workEndTime = new Date(date);
    workEndTime.setHours(endHour, endMin, 0, 0);

    const now = new Date();
    
    console.log(`\n=== GERANDO SLOTS (BACKEND) ===`);
    console.log(`Expediente: ${startHour}:${startMin.toString().padStart(2, '0')} - ${endHour}:${endMin.toString().padStart(2, '0')}`);
    console.log(`Duração procedimento: ${slotDuration} minutos`);
    console.log(`Intervalo entre slots: ${slotInterval} minutos`);
    console.log(`Break: ${daySchedule.breakStart} - ${daySchedule.breakEnd}`);

    while (currentTime < workEndTime) {
      const slotStart = new Date(currentTime);
      const slotEnd = addMinutes(slotStart, slotDuration);
      
      const startString = `${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`;
      const endString = `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`;
      
      // Skip if slot ends after work hours
      if (slotEnd > workEndTime) {
        console.log(`❌ Slot ${startString} pulado: termina ${endString} após expediente ${endHour}:${endMin.toString().padStart(2, '0')}`);
        console.log(`   Total de slots gerados: ${slots.length}`);
        break;
      }
      // FILTER 1: Check if slot is in the past
      const isPast = slotStart < now;

      // FILTER 2: Check if slot overlaps with break time
      let isDuringBreak = false;
      if (breakStart && breakEnd) {
        // Slot overlaps with break if it starts before break ends AND ends after break starts
        isDuringBreak = (slotStart < breakEnd && slotEnd > breakStart);
      }

      // FILTER 3: Check if slot conflicts with existing appointments (including buffer)
      let hasConflict = false;
      for (const appt of existingAppointments) {
        const apptStart = new Date(appt.startsAt);
        const apptEnd = new Date(appt.endsAt);
        
        // Consider buffer time around appointments
        const apptStartWithBuffer = addMinutes(apptStart, -bufferTime);
        const apptEndWithBuffer = addMinutes(apptEnd, bufferTime);
        
        // Check overlap: slot overlaps if it starts before appointment ends AND ends after appointment starts
        if (slotStart < apptEndWithBuffer && slotEnd > apptStartWithBuffer) {
          hasConflict = true;
          break;
        }
      }

      // Slot is available only if it passes all filters
      slots.push({
        start: startString,
        end: endString,
        available: !isPast && !isDuringBreak && !hasConflict,
      });
      
      // Log detalhado para debug
      if (startString >= '14:00' && startString <= '17:00') {
        console.log(`Slot ${startString}: isPast=${isPast}, isDuringBreak=${isDuringBreak}, hasConflict=${hasConflict}, available=${!isPast && !isDuringBreak && !hasConflict}`);
      }

      // Move to next slot by standard interval (30 minutes)
      // This ensures slots are always at regular intervals (8:00, 8:30, 9:00, etc.)
      currentTime = addMinutes(currentTime, slotInterval);
    }
    
    console.log(`\n✅ Total de slots retornados: ${slots.length}`);
    console.log(`Primeiro: ${slots[0]?.start}, Último: ${slots[slots.length-1]?.start}\n`);

    return { slots };
  }

  /**
   * Get available dates for a professional in a date range
   * Considers professional schedule settings and blocked dates
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

    // Parse schedule settings from JSON string (SQLite stores as string)
    const defaultSettings = {
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

    let scheduleSettings: any = defaultSettings;
    if (professional.scheduleSettings) {
      try {
        scheduleSettings = typeof professional.scheduleSettings === 'string'
          ? JSON.parse(professional.scheduleSettings)
          : professional.scheduleSettings;
      } catch (e) {
        console.error('Error parsing scheduleSettings:', e);
        scheduleSettings = defaultSettings;
      }
    }

    // Build set of blocked dates for fast lookup
    const blockedDates = new Set(
      (scheduleSettings.blockedDates || []).map((b: any) => typeof b === 'string' ? b : b.date)
    );
    
    const dates: Array<{ date: string; hasAvailableSlots: boolean }> = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const daySchedule = scheduleSettings.weeklySchedule?.find((d: any) => d.day === dayOfWeek);

      // Check if day is enabled in weekly schedule
      const isEnabled = daySchedule?.enabled || false;
      
      // Check if date is specifically blocked
      const isBlocked = blockedDates.has(dateString);
      
      // Check if date is in the past
      const currentDateOnly = new Date(current);
      currentDateOnly.setHours(0, 0, 0, 0);
      const isPast = currentDateOnly < today;

      dates.push({
        date: dateString,
        hasAvailableSlots: isEnabled && !isBlocked && !isPast,
      });

      current.setDate(current.getDate() + 1);
    }

    return { dates };
  }
}
