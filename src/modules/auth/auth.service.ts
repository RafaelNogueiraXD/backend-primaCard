import prisma from '../../config/database';
import { AuthUtils } from '../../utils/authUtils';
import { AuthTokens, JWTPayload } from '../../types';
import { addDays } from '../../utils/dateUtils';
import { config } from '../../config';
import emailService from '../../utils/email.service';
import logger from '../../config/logger';

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
    // Referral code
    referralCode?: string;
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

    // Validate referral code if provided
    let referrer = null;
    if (data.referralCode) {
      // Use raw query as workaround for TS not recognizing the referralCode field
      const result: any[] = await prisma.$queryRaw`
        SELECT id, firstName, lastName FROM users WHERE referralCode = ${data.referralCode} LIMIT 1
      `;
      
      if (result.length === 0) {
        throw new Error('Invalid referral code');
      }
      
      referrer = result[0];
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

      // Create referral record if referral code was used
      if (referrer) {
        await tx.referral.create({
          data: {
            referrerId: referrer.id,
            referredId: newUser.id,
            referredEmail: newUser.email,
            referredPhone: newUser.phone,
            status: 'PENDING', // User has registered, pending first completed appointment
          },
        });

        // NOTE: Points are NOT awarded immediately upon registration
        // Points will be awarded when the referred user completes their first appointment
        // This prevents abuse/spam of the referral system
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

  /**
   * Generate a temporary password (6-digit numeric)
   */
  private generateTemporaryPassword(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Change password - User must provide current password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive. Please contact support.');
    }

    // Verify current password
    const isValidPassword = await AuthUtils.comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash new password
    const newPasswordHash = await AuthUtils.hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    logger.info(`Password changed successfully for user ${user.email}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Forgot password - Generate temporary password and send via email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security, don't reveal if email exists
      logger.info(`Forgot password attempt for non-existent email: ${email}`);
      return { message: 'If the email exists, a temporary password has been sent.' };
    }

    if (!user.isActive) {
      throw new Error('Account is inactive. Please contact support.');
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    
    logger.info(`🔐 Generated temporary password for ${user.email}: ${temporaryPassword}`);
    logger.info(`   Password length: ${temporaryPassword.length}`);
    logger.info(`   Password type: ${typeof temporaryPassword}`);
    
    const passwordHash = await AuthUtils.hashPassword(temporaryPassword);
    
    logger.info(`   Hash generated: ${passwordHash.substring(0, 30)}...`);

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Send email with temporary password
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      temporaryPassword,
      `${user.firstName} ${user.lastName}`
    );

    if (!emailSent) {
      logger.error(`Failed to send password reset email to ${user.email}`);
      // Don't throw error to avoid revealing if email exists
    } else {
      logger.info(`Password reset email sent successfully to ${user.email}`);
    }

    return { message: 'If the email exists, a temporary password has been sent.' };
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

  async getMe(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { professional: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (data.phone && data.phone !== user.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing) throw new Error('Phone number already in use');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
      include: { professional: true },
    });

    return this.sanitizeUser(updatedUser);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

