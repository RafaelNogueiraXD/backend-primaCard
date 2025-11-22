import prisma from '../../config/database';
import { addMinutes, differenceInMinutes, differenceInHours } from '../../utils/dateUtils';
import { config } from '../../config';
import { PointsService } from '../points/points.service';
import { ReferralService } from '../referrals/referral.service';

const pointsService = new PointsService();
const referralService = new ReferralService();

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

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'SCHEDULED' },
    });
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
        throw new Error('Professional not found');
      }
      where.professionalId = professional.id;
    }

    if (filters.status) {
      where.status = filters.status;
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
}
