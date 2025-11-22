import prisma from '../../config/database';

export class ProcedureService {
  async create(data: {
    professionalId: string;
    name: string;
    category: string;
    description?: string;
    defaultDurationMinutes: number;
    pointsGeneral: number;
    pointsCategory: number;
  }): Promise<any> {
    // Check for duplicate name for this professional
    const existing = await prisma.procedure.findFirst({
      where: {
        professionalId: data.professionalId,
        name: data.name,
      },
    });

    if (existing) {
      throw new Error('Procedure with this name already exists');
    }

    return prisma.procedure.create({
      data,
    });
  }

  async list(professionalId: string): Promise<any[]> {
    return prisma.procedure.findMany({
      where: {
        professionalId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getById(id: string, professionalId: string): Promise<any> {
    const procedure = await prisma.procedure.findUnique({
      where: { id },
    });

    if (!procedure) {
      throw new Error('Procedure not found');
    }

    if (procedure.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    return procedure;
  }

  async update(
    id: string,
    professionalId: string,
    data: {
      name?: string;
      category?: string;
      description?: string;
      defaultDurationMinutes?: number;
      pointsGeneral?: number;
      pointsCategory?: number;
      isActive?: boolean;
    }
  ): Promise<any> {
    const procedure = await prisma.procedure.findUnique({
      where: { id },
    });

    if (!procedure) {
      throw new Error('Procedure not found');
    }

    if (procedure.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    // If updating name, check for duplicates
    if (data.name && data.name !== procedure.name) {
      const existing = await prisma.procedure.findFirst({
        where: {
          professionalId,
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new Error('Procedure with this name already exists');
      }
    }

    // Increment version if points changed
    const shouldIncrementVersion =
      data.pointsGeneral !== undefined ||
      data.pointsCategory !== undefined;

    return prisma.procedure.update({
      where: { id },
      data: {
        ...data,
        version: shouldIncrementVersion ? procedure.version + 1 : procedure.version,
      },
    });
  }

  async delete(id: string, professionalId: string): Promise<any> {
    const procedure = await prisma.procedure.findUnique({
      where: { id },
      include: {
        appointments: {
          where: {
            status: {
              in: ['REQUESTED', 'SCHEDULED'],
            },
          },
        },
      },
    });

    if (!procedure) {
      throw new Error('Procedure not found');
    }

    if (procedure.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    // Prevent deletion if there are active appointments
    if (procedure.appointments.length > 0) {
      throw new Error('Cannot delete procedure with active appointments. Deactivate it instead.');
    }

    // Soft delete by marking as inactive
    return prisma.procedure.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getStatistics(professionalId: string): Promise<any> {
    const [totalProcedures, activeProcedures, totalAppointments] = await Promise.all([
      prisma.procedure.count({
        where: { professionalId },
      }),
      prisma.procedure.count({
        where: { professionalId, isActive: true },
      }),
      prisma.appointment.count({
        where: {
          professionalId,
          status: 'COMPLETED',
        },
      }),
    ]);

    // Get most used procedures
    const procedureUsage = await prisma.appointment.groupBy({
      by: ['procedureId'],
      where: {
        professionalId,
        status: 'COMPLETED',
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    const mostUsedProcedures = await Promise.all(
      procedureUsage.map(async (usage) => {
        const procedure = await prisma.procedure.findUnique({
          where: { id: usage.procedureId },
          select: {
            id: true,
            name: true,
            category: true,
          },
        });
        return {
          ...procedure,
          usageCount: usage._count.id,
        };
      })
    );

    return {
      totalProcedures,
      activeProcedures,
      inactiveProcedures: totalProcedures - activeProcedures,
      totalAppointments,
      mostUsedProcedures,
    };
  }
}
