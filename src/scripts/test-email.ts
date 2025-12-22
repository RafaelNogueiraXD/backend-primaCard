/**
 * Test script for email functionality
 * Run with: npx tsx src/scripts/test-email.ts
 */

import emailService from '../utils/email.service';
import logger from '../config/logger';

async function testEmailService() {
  logger.info('🧪 Starting email service tests...\n');

  // Test 1: Verify connection
  logger.info('Test 1: Verifying email service connection...');
  const isConnected = await emailService.verifyConnection();
  if (isConnected) {
    logger.info('✅ Email service connection verified\n');
  } else {
    logger.error('❌ Email service connection failed\n');
    process.exit(1);
  }

  // Test 2: Send password reset email
  logger.info('Test 2: Sending password reset email...');
  const passwordResetSent = await emailService.sendPasswordResetEmail(
    'rafaelnogueira.aluno@unipampa.edu.br',
    '123456',
    'Rafael Nogueira'
  );
  if (passwordResetSent) {
    logger.info('✅ Password reset email sent successfully\n');
  } else {
    logger.error('❌ Failed to send password reset email\n');
  }

  // Test 3: Send points received email
  logger.info('Test 3: Sending points received email...');
  const pointsEmailSent = await emailService.sendPointsReceivedEmail(
    'rafaelnogueira.aluno@unipampa.edu.br',
    'Rafael Nogueira',
    50,
    'Consulta concluída',
    150
  );
  if (pointsEmailSent) {
    logger.info('✅ Points received email sent successfully\n');
  } else {
    logger.error('❌ Failed to send points received email\n');
  }

  // Test 4: Send new appointment to professional
  logger.info('Test 4: Sending new appointment notification to professional...');
  const appointmentToProfessionalSent = await emailService.sendNewAppointmentToProfessional(
    'rafaelnogueira.aluno@unipampa.edu.br',
    'Dr. João Silva',
    'Rafael Nogueira',
    'Limpeza Dental',
    new Date('2025-12-25T10:00:00')
  );
  if (appointmentToProfessionalSent) {
    logger.info('✅ New appointment email to professional sent successfully\n');
  } else {
    logger.error('❌ Failed to send new appointment email to professional\n');
  }

  // Test 5: Send appointment confirmed to patient
  logger.info('Test 5: Sending appointment confirmed email to patient...');
  const appointmentConfirmedSent = await emailService.sendAppointmentConfirmedToPatient(
    'rafaelnogueira.aluno@unipampa.edu.br',
    'Rafael Nogueira',
    'Dr. João Silva',
    'Limpeza Dental',
    new Date('2025-12-25T10:00:00')
  );
  if (appointmentConfirmedSent) {
    logger.info('✅ Appointment confirmed email sent successfully\n');
  } else {
    logger.error('❌ Failed to send appointment confirmed email\n');
  }

  // Test 6: Send appointment completed to patient
  logger.info('Test 6: Sending appointment completed email to patient...');
  const appointmentCompletedSent = await emailService.sendAppointmentCompletedToPatient(
    'rafaelnogueira.aluno@unipampa.edu.br',
    'Rafael Nogueira',
    'Dr. João Silva',
    'Limpeza Dental',
    50
  );
  if (appointmentCompletedSent) {
    logger.info('✅ Appointment completed email sent successfully\n');
  } else {
    logger.error('❌ Failed to send appointment completed email\n');
  }

  logger.info('🎉 All email tests completed!');
  process.exit(0);
}

testEmailService().catch((error) => {
  logger.error('❌ Email test script failed:', error);
  process.exit(1);
});
