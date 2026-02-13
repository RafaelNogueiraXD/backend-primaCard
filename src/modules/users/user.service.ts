import prisma from '../../config/database';
import { AuthUtils } from '../../utils/authUtils';

export class UserService {
  async getProfile(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        professional: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<any> {
    // Check if phone is being updated and if it's already in use
    if (data.phone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone: data.phone,
          NOT: { id: userId },
        },
      });

      if (existingPhone) {
        throw new Error('Phone number already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      include: {
        professional: true,
      },
    });

    return this.sanitizeUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await AuthUtils.comparePassword(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await AuthUtils.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  async getPointsBalance(userId: string): Promise<Record<string, number>> {
    const transactions = await prisma.pointTransaction.findMany({
      where: { userId },
      select: { bucket: true, delta: true },
    });

    const balance: Record<string, number> = {};

    for (const tx of transactions) {
      if (!balance[tx.bucket]) {
        balance[tx.bucket] = 0;
      }
      balance[tx.bucket] += tx.delta;
    }

    return balance;
  }

  async getPointsHistory(
    userId: string,
    filters: {
      bucket?: string;
      cause?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = { userId };

    if (filters.bucket) where.bucket = filters.bucket;
    if (filters.cause) where.cause = filters.cause;

    const [data, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pointTransaction.count({ where }),
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

  async getMyAppointments(
    userId: string,
    filters: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const where: any = {};

    if (user.role === 'PATIENT') {
      where.patientId = userId;
    } else if (user.role === 'PROFESSIONAL') {
      where.professionalId = userId;
    }

    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.scheduledFor = {};
      if (filters.startDate) where.scheduledFor.gte = filters.startDate;
      if (filters.endDate) where.scheduledFor.lte = filters.endDate;
    }

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          professional: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
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

  async getMyRedemptions(
    userId: string,
    filters: {
      status?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = { userId };

    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          reward: true,
        },
      }),
      prisma.redemption.count({ where }),
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

  async getNotifications(
    userId: string,
    filters: {
      isRead?: boolean;
      type?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = { userId };

    if (filters.isRead !== undefined) where.isRead = filters.isRead;
    if (filters.type) where.type = filters.type;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
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

  async markNotificationAsRead(userId: string, notificationId: string): Promise<any> {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllNotificationsAsRead(userId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  async getReferralCode(userId: string): Promise<{ referralCode: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, referralCode: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Se já tem código, retorna
    if (user.referralCode) {
      return { referralCode: user.referralCode };
    }

    // Gera novo código único
    const referralCode = await this.generateUniqueReferralCode(user);

    // Salva no banco
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    });

    return { referralCode };
  }

  // ============= ADMIN METHODS =============

  async listAllUsers(filters: {
    role?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async listPatients(filters: {
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 50;
    const skip = (page - 1) * perPage;

    const where: any = {
      role: 'PATIENT',
    };

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getUserDetails(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        professional: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  async adminUpdateUser(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      registrationNumber?: string;
      specialty?: string;
      bio?: string;
      isActive?: boolean;
    }
  ): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { professional: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is being updated and if it's already in use
    if (data.email && data.email !== user.email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: userId },
        },
      });

      if (existingEmail) {
        throw new Error('Email already in use');
      }
    }

    // Check if phone is being updated and if it's already in use
    if (data.phone && data.phone !== user.phone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone: data.phone,
          NOT: { id: userId },
        },
      });

      if (existingPhone) {
        throw new Error('Phone number already in use');
      }
    }

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        isActive: data.isActive,
      },
      include: {
        professional: true,
      },
    });

    // If user is a professional and has professional-specific data to update
    if (user.professional && (data.registrationNumber || data.specialty || data.bio !== undefined)) {
      await prisma.professional.update({
        where: { userId },
        data: {
          registrationNumber: data.registrationNumber,
          specialty: data.specialty,
          bio: data.bio,
        },
      });

      // Reload to get updated professional data
      const reloadedUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { professional: true },
      });

      return this.sanitizeUser(reloadedUser);
    }

    return this.sanitizeUser(updatedUser);
  }

  private async generateUniqueReferralCode(user: { firstName: string; lastName: string; id: string }): Promise<string> {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Gera código baseado no nome + números aleatórios
      const namePart = (user.firstName.substring(0, 3) + user.lastName.substring(0, 3))
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
      
      const randomPart = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
      const code = `${namePart}${randomPart}`;

      // Verifica se já existe
      const existing = await prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        return code;
      }
    }

    // Fallback: usa parte do UUID + timestamp
    const fallbackCode = user.id.substring(0, 4).toUpperCase() + Date.now().toString().slice(-4);
    return fallbackCode;
  }

  private sanitizeUser(user: any): any {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
