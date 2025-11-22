import prisma from '../../config/database';
import { AuthUtils } from '../../utils/authUtils';
import { AuthTokens, JWTPayload } from '../../types';
import { addDays } from '../../utils/dateUtils';
import { config } from '../../config';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: 'PATIENT' | 'PROFESSIONAL';
    // Professional-specific fields
    registrationNumber?: string;
    specialty?: string;
  }): Promise<{ user: any; tokens: AuthTokens }> {
    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phone: data.phone },
        ],
      },
    });

    if (existing) {
      if (existing.email === data.email) {
        throw new Error('Email already registered');
      }
      if (existing.phone === data.phone) {
        throw new Error('Phone number already registered');
      }
    }

    const passwordHash = await AuthUtils.hashPassword(data.password);

    // Create user within a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        },
      });

      // If professional, create professional profile
      if (data.role === 'PROFESSIONAL') {
        if (!data.registrationNumber || !data.specialty) {
          throw new Error('Registration number and specialty required for professionals');
        }

        await tx.professional.create({
          data: {
            userId: newUser.id,
            registrationNumber: data.registrationNumber,
            specialty: data.specialty,
          },
        });
      }

      return newUser;
    });

    const tokens = this.generateTokens(user);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), tokens };
  }

  async login(email: string, password: string): Promise<{ user: any; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { professional: true },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    const isValid = await AuthUtils.comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = AuthUtils.verifyRefreshToken(refreshToken);

    // Verify token exists in database
    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId: payload.userId,
        token: refreshToken,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new Error('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    const tokens = this.generateTokens(user);

    // Delete old token and store new one
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      // Logout from all devices
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if user exists
      return 'If the email exists, a reset code will be sent';
    }

    const otp = AuthUtils.generateOTP();
    const otpHash = AuthUtils.hashOTP(otp);

    await prisma.oTPCode.create({
      data: {
        userId: user.id,
        codeHash: otpHash,
        purpose: 'password_reset',
        expiresAt: addDays(new Date(), 0, 0, config.otp.expiryMinutes),
      },
    });

    // TODO: Send email with OTP
    // await emailService.sendPasswordResetEmail(user.email, otp);

    return otp; // In production, don't return this, just send via email
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('Invalid request');
    }

    const otpHash = AuthUtils.hashOTP(otp);

    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        userId: user.id,
        codeHash: otpHash,
        purpose: 'password_reset',
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!otpRecord) {
      throw new Error('Invalid or expired OTP');
    }

    const passwordHash = await AuthUtils.hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.oTPCode.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all refresh tokens
      prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);
  }

  async verifyEmail(userId: string, otp: string): Promise<void> {
    const otpHash = AuthUtils.hashOTP(otp);

    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        userId,
        codeHash: otpHash,
        purpose: 'email_verification',
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!otpRecord) {
      throw new Error('Invalid or expired OTP');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      }),
      prisma.oTPCode.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  private generateTokens(user: any): AuthTokens {
    const payload: JWTPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    return AuthUtils.generateTokens(payload);
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = addDays(new Date(), 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  private sanitizeUser(user: any): any {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
