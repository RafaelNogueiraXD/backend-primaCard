import prisma from '../config/database';
import { AuthUtils } from '../utils/authUtils';
import { AuthService } from '../modules/auth/auth.service';

const authService = new AuthService();

async function testChangePassword() {
  const testEmail = 'rafaelnogueira.aluno@unipampa.edu.br';

  console.log('\n🧪 Testing Change Password Feature\n');
  console.log('='.repeat(50));

  try {
    // 1. Find user
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user.id}\n`);

    // 2. Set a known current password for testing
    const knownPassword = 'TestPassword123';
    const knownPasswordHash = await AuthUtils.hashPassword(knownPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: knownPasswordHash },
    });

    console.log(`✅ Set current password: ${knownPassword}\n`);

    // 3. Test login with current password
    console.log('🔐 Testing login with current password...');
    const loginResult = await authService.login(testEmail, knownPassword);
    console.log('✅ Login successful!\n');

    // 4. Test change password
    const newPassword = 'NewPassword456';
    console.log('🔄 Attempting to change password...');
    console.log(`   Current Password: ${knownPassword}`);
    console.log(`   New Password: ${newPassword}\n`);

    const changeResult = await authService.changePassword(
      user.id,
      knownPassword,
      newPassword
    );

    console.log(`✅ Password changed successfully!`);
    console.log(`   Message: ${changeResult.message}\n`);

    // 5. Test login with new password
    console.log('🔐 Testing login with new password...');
    const newLoginResult = await authService.login(testEmail, newPassword);
    console.log('✅ Login successful with new password!\n');

    // 6. Test login with old password (should fail)
    console.log('🚫 Testing login with old password (should fail)...');
    try {
      await authService.login(testEmail, knownPassword);
      console.log('❌ ERROR: Login should have failed with old password!\n');
    } catch (error: any) {
      console.log(`✅ Correctly rejected: ${error.message}\n`);
    }

    // 7. Test validation errors
    console.log('🧪 Testing validation errors...\n');

    // 7a. Wrong current password
    console.log('   Testing wrong current password...');
    try {
      await authService.changePassword(user.id, 'WrongPassword', 'AnotherPassword123');
      console.log('   ❌ Should have thrown error for wrong current password');
    } catch (error: any) {
      console.log(`   ✅ ${error.message}`);
    }

    // 7b. Short new password
    console.log('   Testing short new password...');
    try {
      await authService.changePassword(user.id, newPassword, '123');
      console.log('   ❌ Should have thrown error for short password');
    } catch (error: any) {
      console.log(`   ✅ ${error.message}`);
    }

    // 7c. Same password
    console.log('   Testing same password...');
    try {
      await authService.changePassword(user.id, newPassword, newPassword);
      console.log('   ❌ Should have thrown error for same password');
    } catch (error: any) {
      console.log(`   ✅ ${error.message}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(50) + '\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testChangePassword();
