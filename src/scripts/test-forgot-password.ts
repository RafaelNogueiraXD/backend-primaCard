/**
 * Test script for forgot password flow
 * Run with: npx tsx src/scripts/test-forgot-password.ts <email>
 */

import { AuthService } from '../modules/auth/auth.service';
import { AuthUtils } from '../utils/authUtils';
import prisma from '../config/database';
import logger from '../config/logger';

const authService = new AuthService();

async function testForgotPassword() {
  const email = process.argv[2] || 'rafaelnogueira.aluno@unipampa.edu.br';
  
  logger.info(`\n🧪 Testing forgot password flow for: ${email}\n`);

  try {
    // Step 1: Find user
    logger.info('Step 1: Finding user...');
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
      }
    });

    if (!user) {
      logger.error(`❌ User not found with email: ${email}`);
      logger.info('\n💡 Create a user first or use an existing email.');
      process.exit(1);
    }

    logger.info(`✅ User found: ${user.firstName} ${user.lastName}`);
    logger.info(`   Current password hash: ${user.passwordHash.substring(0, 30)}...`);

    // Step 2: Generate temporary password
    logger.info('\nStep 2: Generating temporary password...');
    const temporaryPassword = Math.floor(100000 + Math.random() * 900000).toString();
    logger.info(`✅ Generated password: ${temporaryPassword}`);

    // Step 3: Hash the password
    logger.info('\nStep 3: Hashing password...');
    const passwordHash = await AuthUtils.hashPassword(temporaryPassword);
    logger.info(`✅ Password hash: ${passwordHash.substring(0, 30)}...`);

    // Step 4: Update user password
    logger.info('\nStep 4: Updating user password in database...');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    logger.info('✅ Password updated successfully');

    // Step 5: Verify by comparing
    logger.info('\nStep 5: Verifying password...');
    const isValid = await AuthUtils.comparePassword(temporaryPassword, passwordHash);
    logger.info(`✅ Password verification: ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);

    // Step 6: Try to login with the temporary password
    logger.info('\nStep 6: Testing login with temporary password...');
    try {
      const loginResult = await authService.login(email, temporaryPassword);
      logger.info('✅ Login successful!');
      logger.info(`   User ID: ${loginResult.user.id}`);
      logger.info(`   Access Token: ${loginResult.tokens.accessToken.substring(0, 30)}...`);
    } catch (loginError: any) {
      logger.error(`❌ Login failed: ${loginError.message}`);
      
      // Additional debugging
      logger.info('\n🔍 Debugging information:');
      const userAfterUpdate = await prisma.user.findUnique({
        where: { email },
        select: { passwordHash: true }
      });
      
      logger.info(`   DB password hash: ${userAfterUpdate?.passwordHash.substring(0, 30)}...`);
      logger.info(`   Generated hash:   ${passwordHash.substring(0, 30)}...`);
      logger.info(`   Hashes match: ${userAfterUpdate?.passwordHash === passwordHash}`);
      
      // Try comparing again
      const compareResult = await AuthUtils.comparePassword(temporaryPassword, userAfterUpdate!.passwordHash);
      logger.info(`   Direct comparison: ${compareResult}`);
    }

    logger.info('\n✅ Test completed successfully!');
    logger.info(`\n📧 You can now login with:`);
    logger.info(`   Email: ${email}`);
    logger.info(`   Password: ${temporaryPassword}`);
    
  } catch (error: any) {
    logger.error('\n❌ Test failed:', error);
    logger.error(error.stack);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testForgotPassword();
