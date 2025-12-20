/**
 * Jest Test Setup
 * 
 * This file provides utility functions and mock data for backend tests.
 * Each test file must call jest.mock('../../config/database') BEFORE any imports.
 */

// Get the mocked prisma instance that Jest is using
// This must be called AFTER jest.mock() has been called in the test file
export const getPrismaMock = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../config/database').default;
};

// For backwards compatibility, export prismaMock directly
// Note: This will only work if jest.mock() has been called before this is imported
export const prismaMock = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../config/database').default;
  } catch {
    return {};
  }
})();

// Helper function to reset all mocks between tests
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetAllMocks();
};

// Helper function to create mock user data
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  phone: '+5511999999999',
  passwordHash: '$2a$10$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  role: 'PATIENT' as const,
  referralCode: null,
  emailVerified: true,
  phoneVerified: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper function to create mock professional data
export const createMockProfessional = (overrides: Partial<any> = {}) => ({
  id: 'professional-123',
  userId: 'user-456',
  registrationNumber: 'CRO-SP-12345',
  specialty: 'Odontologia Geral',
  bio: 'Especialista em odontologia',
  address: 'Rua das Flores, 123',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01234-567',
  averageRating: 4.5,
  totalReviews: 10,
  scheduleSettings: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper function to create mock schedule settings
export const createMockScheduleSettings = (overrides: Partial<any> = {}) => ({
  weeklySchedule: [
    { day: 0, dayName: 'Domingo', enabled: false, start: '', end: '', break: false, breakStart: '', breakEnd: '' },
    { day: 1, dayName: 'Segunda', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
    { day: 2, dayName: 'Terça', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
    { day: 3, dayName: 'Quarta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
    { day: 4, dayName: 'Quinta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
    { day: 5, dayName: 'Sexta', enabled: true, start: '08:00', end: '17:00', break: true, breakStart: '12:00', breakEnd: '13:00' },
    { day: 6, dayName: 'Sábado', enabled: false, start: '08:00', end: '12:00', break: false, breakStart: '', breakEnd: '' },
  ],
  appointmentDuration: 30,
  bufferTime: 5,
  blockedDates: [],
  ...overrides,
});

// Helper function to create mock appointment data
export const createMockAppointment = (overrides: Partial<any> = {}) => ({
  id: 'appointment-123',
  patientId: 'user-123',
  professionalId: 'professional-123',
  procedureId: 'procedure-123',
  startsAt: new Date(),
  endsAt: new Date(Date.now() + 30 * 60 * 1000),
  status: 'SCHEDULED' as const,
  notes: null,
  procedureSnapshot: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper function to create mock procedure data
export const createMockProcedure = (overrides: Partial<any> = {}) => ({
  id: 'procedure-123',
  professionalId: 'professional-123',
  name: 'Limpeza Dental',
  category: 'limpeza',
  description: 'Limpeza profissional completa',
  defaultDurationMinutes: 60,
  pointsGeneral: 10,
  pointsCategory: 15,
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper function to create mock review data
export const createMockReview = (overrides: Partial<any> = {}) => ({
  id: 'review-123',
  appointmentId: 'appointment-123',
  authorId: 'user-123',
  targetId: 'user-456',
  rating: 5,
  comment: 'Excelente atendimento!',
  createdAt: new Date(),
  ...overrides,
});

// Helper function to create mock notification data
export const createMockNotification = (overrides: Partial<any> = {}) => ({
  id: 'notification-123',
  userId: 'user-123',
  type: 'APPOINTMENT_REMINDER' as const,
  title: 'Lembrete de Consulta',
  message: 'Você tem uma consulta amanhã às 10:00',
  isRead: false,
  data: null,
  createdAt: new Date(),
  ...overrides,
});

// Export default
export default {
  prismaMock,
  resetAllMocks,
  createMockUser,
  createMockProfessional,
  createMockScheduleSettings,
  createMockAppointment,
  createMockProcedure,
  createMockReview,
  createMockNotification,
};
