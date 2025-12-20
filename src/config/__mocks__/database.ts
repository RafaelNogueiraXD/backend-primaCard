/**
 * Mock for Prisma database connection
 * Jest will automatically use this file when '../config/database' is imported
 */

// Create a deep mock factory for Prisma models
const createModelMock = (): Record<string, jest.Mock> => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

// Create individual model mocks
const userMock = createModelMock();
const professionalMock = createModelMock();
const appointmentMock = createModelMock();
const procedureMock = createModelMock();
const reviewMock = createModelMock();
const rewardMock = createModelMock();
const redemptionMock = createModelMock();
const pointTransactionMock = createModelMock();
const notificationMock = createModelMock();
const referralMock = createModelMock();
const oTPCodeMock = createModelMock();
const refreshTokenMock = createModelMock();
const auditLogMock = createModelMock();

// Create the mock prisma client
const mockPrismaClient: Record<string, any> = {
  user: userMock,
  professional: professionalMock,
  appointment: appointmentMock,
  procedure: procedureMock,
  review: reviewMock,
  reward: rewardMock,
  redemption: redemptionMock,
  pointTransaction: pointTransactionMock,
  notification: notificationMock,
  referral: referralMock,
  oTPCode: oTPCodeMock,
  refreshToken: refreshTokenMock,
  auditLog: auditLogMock,
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Setup $transaction separately to avoid circular reference
mockPrismaClient.$transaction.mockImplementation((callback: (tx: Record<string, any>) => Promise<any>): Promise<any> => {
  const txContext: Record<string, Record<string, jest.Mock>> = {
    user: userMock,
    professional: professionalMock,
    appointment: appointmentMock,
    procedure: procedureMock,
    review: reviewMock,
    oTPCode: oTPCodeMock,
    refreshToken: refreshTokenMock,
    notification: notificationMock,
  };
  return Promise.resolve(callback(txContext));
});

export default mockPrismaClient;
