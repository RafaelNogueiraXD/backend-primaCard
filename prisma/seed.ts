import { PrismaClient } from '@prisma/client';
import { AuthUtils } from '../src/utils/authUtils';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create admin user
  const adminPassword = await AuthUtils.hashPassword('Admin123!@#');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@primacard.com' },
    update: {},
    create: {
      email: 'admin@primacard.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Sistema',
      role: 'ADMIN',
      emailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create a professional (dentist)
  const professionalPassword = await AuthUtils.hashPassword('Dentista123!');
  const professionalUser = await prisma.user.upsert({
    where: { email: 'dra.silva@primacard.com' },
    update: {},
    create: {
      email: 'dra.silva@primacard.com',
      phone: '+5511999999999',
      passwordHash: professionalPassword,
      firstName: 'Maria',
      lastName: 'Silva',
      role: 'PROFESSIONAL',
      emailVerified: true,
      isActive: true,
    },
  });

  const professional = await prisma.professional.upsert({
    where: { userId: professionalUser.id },
    update: {},
    create: {
      userId: professionalUser.id,
      registrationNumber: 'CRO-SP-12345',
      specialty: 'Odontologia Geral',
      bio: 'Especialista em odontologia com 10 anos de experiência',
      address: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      scheduleSettings: {
        workingHours: {
          monday: { start: '08:00', end: '18:00' },
          tuesday: { start: '08:00', end: '18:00' },
          wednesday: { start: '08:00', end: '18:00' },
          thursday: { start: '08:00', end: '18:00' },
          friday: { start: '08:00', end: '17:00' },
        },
        lunchBreak: { start: '12:00', end: '13:00' },
        slotDuration: 30,
      },
    },
  });
  console.log('✅ Professional created:', professionalUser.email);

  // Create procedures
  const procedures = [
    {
      name: 'Limpeza Dental',
      category: 'limpeza',
      description: 'Limpeza profissional completa com remoção de tártaro',
      defaultDurationMinutes: 60,
      pointsGeneral: 10,
      pointsCategory: 15,
    },
    {
      name: 'Clareamento Dental',
      category: 'clareamento',
      description: 'Clareamento dental profissional a laser',
      defaultDurationMinutes: 90,
      pointsGeneral: 20,
      pointsCategory: 30,
    },
    {
      name: 'Consulta de Avaliação',
      category: 'avaliacao',
      description: 'Consulta inicial para avaliação e diagnóstico',
      defaultDurationMinutes: 30,
      pointsGeneral: 5,
      pointsCategory: 10,
    },
    {
      name: 'Restauração',
      category: 'restauracao',
      description: 'Restauração dental em resina ou porcelana',
      defaultDurationMinutes: 60,
      pointsGeneral: 15,
      pointsCategory: 20,
    },
  ];

  for (const proc of procedures) {
    await prisma.procedure.upsert({
      where: {
        professionalId_name: {
          professionalId: professional.id,
          name: proc.name,
        },
      },
      update: {},
      create: {
        professionalId: professional.id,
        ...proc,
      },
    });
  }
  console.log(`✅ Created ${procedures.length} procedures`);

  // Create rewards
  const rewards = [
    {
      name: 'Desconto 10% em Clareamento',
      description: 'Ganhe 10% de desconto no próximo clareamento dental',
      costPoints: 50,
      allowedBuckets: ['general', 'limpeza', 'avaliacao'],
      excludedBuckets: ['clareamento'],
      terms: 'Válido por 90 dias. Não cumulativo com outras promoções.',
    },
    {
      name: 'Limpeza Gratuita',
      description: 'Uma sessão de limpeza dental totalmente gratuita',
      costPoints: 100,
      allowedBuckets: ['general', 'clareamento', 'restauracao'],
      excludedBuckets: ['limpeza'],
      terms: 'Válido por 60 dias. Agendamento sujeito a disponibilidade.',
    },
    {
      name: 'Kit Dental Completo',
      description: 'Kit com escova, pasta e fio dental profissional',
      costPoints: 30,
      allowedBuckets: ['general'],
      excludedBuckets: [],
      terms: 'Retirar no consultório. Válido por 30 dias.',
      stockQuantity: 20,
    },
    {
      name: 'Consulta de Emergência Prioritária',
      description: 'Atendimento prioritário em casos de emergência',
      costPoints: 40,
      allowedBuckets: ['general'],
      excludedBuckets: [],
      terms: 'Válido por 180 dias. Sujeito a disponibilidade.',
    },
  ];

  for (const reward of rewards) {
    await prisma.reward.create({
      data: {
        professionalId: professional.id,
        ...reward,
        stockRemaining: reward.stockQuantity,
      },
    });
  }
  console.log(`✅ Created ${rewards.length} rewards`);

  // Create sample patients
  const patients = [
    {
      email: 'joao.santos@email.com',
      firstName: 'João',
      lastName: 'Santos',
      phone: '+5511988888888',
    },
    {
      email: 'maria.oliveira@email.com',
      firstName: 'Maria',
      lastName: 'Oliveira',
      phone: '+5511977777777',
    },
    {
      email: 'pedro.costa@email.com',
      firstName: 'Pedro',
      lastName: 'Costa',
      phone: '+5511966666666',
    },
  ];

  const patientPassword = await AuthUtils.hashPassword('Paciente123!');

  for (const patient of patients) {
    await prisma.user.upsert({
      where: { email: patient.email },
      update: {},
      create: {
        ...patient,
        passwordHash: patientPassword,
        role: 'PATIENT',
        emailVerified: true,
        isActive: true,
      },
    });
  }
  console.log(`✅ Created ${patients.length} sample patients`);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📝 Test credentials:');
  console.log('');
  console.log('Admin:');
  console.log('  Email: admin@primacard.com');
  console.log('  Password: Admin123!@#');
  console.log('');
  console.log('Professional (Dentist):');
  console.log('  Email: dra.silva@primacard.com');
  console.log('  Password: Dentista123!');
  console.log('');
  console.log('Patient:');
  console.log('  Email: joao.santos@email.com');
  console.log('  Password: Paciente123!');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
