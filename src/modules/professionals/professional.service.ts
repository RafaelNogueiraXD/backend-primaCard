import prisma from '../../config/database';

export class ProfessionalService {
  async list(filters: {
    specialty?: string;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = {};

    if (filters.specialty) {
      where.specialty = { contains: filters.specialty };
    }

    if (filters.search) {
      where.user = {
        OR: [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { email: { contains: filters.search } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        skip,
        take: perPage,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              appointments: true,
            },
          },
        },
      }),
      prisma.professional.count({ where }),
    ]);

    // Calculate average rating for each professional
    const dataWithRatings = await Promise.all(
      data.map(async (professional) => {
        const reviews = await prisma.review.findMany({
          where: { targetId: professional.userId },
          select: { rating: true },
        });

        const averageRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        return {
          ...professional,
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews: reviews.length,
        };
      })
    );

    return {
      data: dataWithRatings,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getById(professionalId: string): Promise<any> {
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
        procedures: true,
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    // Calculate average rating
    const reviews = await prisma.review.findMany({
      where: { targetId: professional.userId },
      select: { rating: true },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      ...professional,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
    };
  }

  async getAvailability(
    professionalId: string,
    date: Date
  ): Promise<{ availableSlots: string[] }> {
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        startsAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['CANCELED_BY_PATIENT', 'CANCELED_BY_PROFESSIONAL', 'NO_SHOW_PATIENT'],
        },
      },
      select: {
        startsAt: true,
        endsAt: true,
      },
    });

    const slots: string[] = [];
    const workDayStart = new Date(date);
    workDayStart.setHours(8, 0, 0, 0);

    const workDayEnd = new Date(date);
    workDayEnd.setHours(18, 0, 0, 0);

    let currentSlot = new Date(workDayStart);

    while (currentSlot < workDayEnd) {
      const slotTime = currentSlot.toISOString();
      
      const isBooked = appointments.some((apt) => {
        const aptStart = new Date(apt.startsAt);
        const aptEnd = new Date(apt.endsAt);
        return currentSlot >= aptStart && currentSlot < aptEnd;
      });

      if (!isBooked) {
        slots.push(slotTime);
      }

      currentSlot = new Date(currentSlot.getTime() + 30 * 60000);
    }

    return { availableSlots: slots };
  }

  async getProcedures(professionalId: string): Promise<any[]> {
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    return prisma.procedure.findMany({
      where: { professionalId },
      orderBy: { name: 'asc' },
    });
  }

  async getReviews(
    professionalId: string,
    filters: {
      rating?: number;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any; averageRating: number }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: { userId: true },
    });

    if (!professional) {
      throw new Error('Professional not found');
    }

    const where: any = { targetId: professional.userId };

    if (filters.rating) {
      where.rating = filters.rating;
    }

    const [data, total, allReviews] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          appointment: {
            select: {
              id: true,
              startsAt: true,
              procedureSnapshot: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
      prisma.review.findMany({
        where: { targetId: professional.userId },
        select: { rating: true },
      }),
    ]);

    const averageRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
      averageRating: Math.round(averageRating * 10) / 10,
    };
  }

  async updateProfile(
    userId: string,
    data: {
      registrationNumber?: string;
      specialty?: string;
      bio?: string;
    }
  ): Promise<any> {
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new Error('Professional profile not found');
    }

    const updated = await prisma.professional.update({
      where: { id: professional.id },
      data: {
        registrationNumber: data.registrationNumber,
        specialty: data.specialty,
        bio: data.bio,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    return updated;
  }

  async getStatistics(userId: string): Promise<any> {
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new Error('Professional profile not found');
    }

    const [
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      reviews,
      upcomingAppointments,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { professionalId: professional.id },
      }),
      prisma.appointment.count({
        where: {
          professionalId: professional.id,
          status: 'COMPLETED',
        },
      }),
      prisma.appointment.count({
        where: {
          professionalId: professional.id,
          status: 'CANCELED_BY_PROFESSIONAL',
        },
      }),
      prisma.appointment.count({
        where: {
          professionalId: professional.id,
          status: 'NO_SHOW_PATIENT',
        },
      }),
      prisma.review.findMany({
        where: { targetId: userId },
        select: { rating: true },
      }),
      prisma.appointment.count({
        where: {
          professionalId: professional.id,
          startsAt: { gte: new Date() },
          status: { in: ['REQUESTED', 'SCHEDULED'] },
        },
      }),
    ]);

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      upcomingAppointments,
      totalReviews: reviews.length,
      averageRating: Math.round(averageRating * 10) / 10,
      completionRate:
        totalAppointments > 0
          ? Math.round((completedAppointments / totalAppointments) * 100)
          : 0,
    };
  }
}
