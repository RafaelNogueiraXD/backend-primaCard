import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

export class SurveyService {
  /**
   * Create a new survey
   */
  async create(data: {
    title: string;
    description?: string;
    targetAudience: 'ALL' | 'PATIENTS' | 'PROFESSIONALS';
    questions: Array<{
      id: string;
      type: 'text' | 'rating' | 'multipleChoice' | 'yesNo';
      question: string;
      required: boolean;
      options?: string[]; // For multiple choice
    }>;
    createdById: string;
    targetUserId?: string;
  }): Promise<any> {
    // Validate questions
    if (!data.questions || data.questions.length === 0) {
      throw new Error('Survey must have at least one question');
    }

    if (data.targetUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: data.targetUserId },
        select: { id: true, role: true },
      });

      if (!targetUser) {
        throw new Error('Target user not found');
      }

      if (targetUser.role !== 'PATIENT') {
        throw new Error('Target user must be a patient');
      }
    }

    const survey = await prisma.survey.create({
      data: {
        title: data.title,
        description: data.description,
        targetAudience: data.targetAudience,
        questions: JSON.stringify(data.questions),
        createdById: data.createdById,
        targetUserId: data.targetUserId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return survey;
  }

  /**
   * Get survey by ID
   */
  async getById(surveyId: string): Promise<any> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        responses: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    if (!survey) {
      throw new Error('Survey not found');
    }

    return {
      ...survey,
      responseCount: survey.responses.length,
    };
  }

  /**
   * List surveys with filters
   */
  async list(filters: {
    isActive?: boolean;
    targetAudience?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.SurveyWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.targetAudience) {
      where.targetAudience = filters.targetAudience;
    }

    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          responses: {
            select: {
              id: true,
            },
          },
        },
      }),
      prisma.survey.count({ where }),
    ]);

    const surveysWithCount = surveys.map((survey) => ({
      ...survey,
      responseCount: survey.responses.length,
    }));

    return {
      data: surveysWithCount,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update survey
   */
  async update(
    surveyId: string,
    data: {
      title?: string;
      description?: string;
      isActive?: boolean;
      targetAudience?: string;
      questions?: Array<any>;
      targetUserId?: string | null;
    }
  ): Promise<any> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new Error('Survey not found');
    }

    if (data.targetUserId !== undefined) {
      if (data.targetUserId) {
        const targetUser = await prisma.user.findUnique({
          where: { id: data.targetUserId },
          select: { id: true, role: true },
        });

        if (!targetUser) {
          throw new Error('Target user not found');
        }

        if (targetUser.role !== 'PATIENT') {
          throw new Error('Target user must be a patient');
        }
      }
    }

    const updated = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive,
        targetAudience: data.targetAudience,
        questions: data.questions ? JSON.stringify(data.questions) : undefined,
        targetUserId: data.targetUserId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete survey
   */
  async delete(surveyId: string): Promise<void> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new Error('Survey not found');
    }

    await prisma.survey.delete({
      where: { id: surveyId },
    });
  }

  /**
   * Submit survey response
   */
  async submitResponse(data: {
    surveyId: string;
    respondentId: string;
    answers: Array<{
      questionId: string;
      answer: any;
    }>;
  }): Promise<any> {
    // Check if survey exists and is active
    const survey = await prisma.survey.findUnique({
      where: { id: data.surveyId },
    });

    if (!survey) {
      throw new Error('Survey not found');
    }

    if (!survey.isActive) {
      throw new Error('Survey is not active');
    }

    // Check if user already responded
    const existingResponse = await prisma.surveyResponse.findUnique({
      where: {
        surveyId_respondentId: {
          surveyId: data.surveyId,
          respondentId: data.respondentId,
        },
      },
    });

    if (existingResponse) {
      throw new Error('You have already responded to this survey');
    }

    // Validate answers match questions
    const questions = JSON.parse(survey.questions as string) as any[];
    const requiredQuestions = questions.filter((q) => q.required);

    for (const requiredQ of requiredQuestions) {
      const answer = data.answers.find((a) => a.questionId === requiredQ.id);
      if (!answer || answer.answer === null || answer.answer === undefined || answer.answer === '') {
        throw new Error(`Question "${requiredQ.question}" is required`);
      }
    }

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: data.surveyId,
        respondentId: data.respondentId,
        answers: JSON.stringify(data.answers),
      },
      include: {
        survey: {
          select: {
            id: true,
            title: true,
            createdById: true,
          },
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Award points to patient who responded to specialist's survey
    // Only if respondent is a patient and survey was created by a professional
    if (response.respondent.role === 'PATIENT') {
      const surveyCreator = await prisma.user.findUnique({
        where: { id: response.survey.createdById },
        select: { role: true },
      });

      if (surveyCreator && surveyCreator.role === 'PROFESSIONAL') {
        // Award 5 points for completing survey
        await prisma.pointTransaction.create({
          data: {
            userId: data.respondentId,
            bucket: 'general',
            delta: 5,
            cause: 'SURVEY_RESPONSE',
            referenceType: 'Survey',
            referenceId: data.surveyId,
            metadata: JSON.stringify({
              surveyId: data.surveyId,
              surveyTitle: response.survey.title,
              questionsAnswered: data.answers.length,
            }),
          },
        });
      }
    }

    return response;
  }

  /**
   * Get survey responses
   */
  async getResponses(
    surveyId: string,
    filters: {
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: { surveyId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          respondent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.surveyResponse.count({ where: { surveyId } }),
    ]);

    return {
      data: responses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get surveys available for a user
   */
  async getAvailableSurveys(userId: string, userRole: string): Promise<any[]> {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return [];
    }

    // Determine target audience filter
    const targetAudiences = ['ALL'];
    if (user.role === 'PATIENT') {
      targetAudiences.push('PATIENTS');
    } else if (user.role === 'PROFESSIONAL') {
      targetAudiences.push('PROFESSIONALS');
    }

    // Get active surveys that the user hasn't responded to yet
    const surveys = await prisma.survey.findMany({
      where: {
        isActive: true,
        targetAudience: { in: targetAudiences },
        OR: [
          { targetUserId: null },
          { targetUserId: userId },
        ],
        responses: {
          none: {
            respondentId: userId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return surveys;
  }

  /**
   * Get user's responses
   */
  async getUserResponses(userId: string): Promise<any[]> {
    const responses = await prisma.surveyResponse.findMany({
      where: { respondentId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        survey: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    return responses;
  }
}
