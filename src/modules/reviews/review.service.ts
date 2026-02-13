import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

export class ReviewService {
  /**
   * Create a new review
   */
  async create(data: {
    appointmentId: string;
    authorId: string;
    targetId: string;
    rating: number;
    comment?: string;
    tags?: string[];
    // Feedback fields matching schema
    wasLate?: boolean;
    lateMinutes?: number;
    wouldRecommend?: boolean;
    serviceQuality?: number;
    communication?: number;
    cleanliness?: number;
    punctualityRating?: number;
    patientCooperation?: number;
    followedInstructions?: boolean;
    waitingTime?: number;
    explanationClarity?: number;
    painManagement?: number;
  }): Promise<any> {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate optional ratings (1-5 scale)
    const ratingFields = [
      { name: 'serviceQuality', value: data.serviceQuality },
      { name: 'communication', value: data.communication },
      { name: 'cleanliness', value: data.cleanliness },
      { name: 'punctualityRating', value: data.punctualityRating },
      { name: 'patientCooperation', value: data.patientCooperation },
      { name: 'explanationClarity', value: data.explanationClarity },
      { name: 'painManagement', value: data.painManagement },
    ];
    
    for (const field of ratingFields) {
      if (field.value !== undefined && (field.value < 1 || field.value > 5)) {
        throw new Error(`${field.name} must be between 1 and 5`);
      }
    }

    // Check if appointment exists and is completed
    const appointment = await prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: { professional: true },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status !== 'COMPLETED' && appointment.status !== 'AUTO_COMPLETED') {
      throw new Error('Can only review completed appointments');
    }

    // Get the professional's userId for comparison (since authorId comes from JWT as userId)
    const professionalUserId = appointment.professional.userId;

    // Verify author is part of the appointment
    // The authorId is the userId from the JWT token
    // For patients: patientId matches userId directly
    // For professionals: we need to check professional.userId
    if (
      appointment.patientId !== data.authorId &&
      professionalUserId !== data.authorId
    ) {
      throw new Error('You are not authorized to review this appointment');
    }

    // Verify target is the other party
    // If the author is the patient, target should be the professional's userId
    // If the author is the professional, target should be the patient's userId
    let expectedTargetId: string;
    if (appointment.patientId === data.authorId) {
      // Patient is reviewing professional - target should be professional's userId
      expectedTargetId = professionalUserId;
    } else {
      // Professional is reviewing patient - target should be patient's userId
      expectedTargetId = appointment.patientId;
    }

    if (expectedTargetId !== data.targetId) {
      throw new Error('Invalid target for review');
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        appointmentId_authorId: {
          appointmentId: data.appointmentId,
          authorId: data.authorId,
        },
      },
    });

    if (existingReview) {
      throw new Error('Review already exists for this appointment');
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        appointmentId: data.appointmentId,
        authorId: data.authorId,
        targetId: data.targetId,
        rating: data.rating,
        comment: data.comment,
        tags: JSON.stringify(data.tags || []),
        // Feedback fields
        wasLate: data.wasLate,
        lateMinutes: data.lateMinutes,
        wouldRecommend: data.wouldRecommend,
        serviceQuality: data.serviceQuality,
        communication: data.communication,
        cleanliness: data.cleanliness,
        punctualityRating: data.punctualityRating,
        patientCooperation: data.patientCooperation,
        followedInstructions: data.followedInstructions,
        waitingTime: data.waitingTime,
        explanationClarity: data.explanationClarity,
        painManagement: data.painManagement,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        appointment: {
          select: {
            id: true,
            startsAt: true,
            status: true,
          },
        },
      },
    });

    // Award points to patient based on feedback from professional
    // If the author is the professional (reviewing the patient), award points to the patient
    if (professionalUserId === data.authorId) {
      // Calculate points based on rating: 5★=10pts, 4★=8pts, 3★=6pts, 2★=3pts, 1★=1pt
      let pointsToAward = 0;
      switch (data.rating) {
        case 5:
          pointsToAward = 10;
          break;
        case 4:
          pointsToAward = 8;
          break;
        case 3:
          pointsToAward = 6;
          break;
        case 2:
          pointsToAward = 3;
          break;
        case 1:
          pointsToAward = 1;
          break;
        default:
          pointsToAward = 0;
      }

      if (pointsToAward > 0) {
        // Create points transaction for the patient using general bucket
        await prisma.pointTransaction.create({
          data: {
            userId: appointment.patientId,
            bucket: 'general',
            delta: pointsToAward,
            cause: 'REVIEW_RATING',
            referenceType: 'review',
            referenceId: review.id,
            metadata: JSON.stringify({
              rating: data.rating,
              reviewId: review.id,
              appointmentId: appointment.id,
              description: `Pontos recebidos por avaliação de ${data.rating} estrelas`,
            }),
          },
        });
      }
    }

    return review;
  }

  /**
   * Get reviews for a user (as target - reviews they received)
   */
  async getReviewsForUser(
    targetId: string,
    filters?: {
      minRating?: number;
      maxRating?: number;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      targetId,
      isModerated: false, // Only show non-moderated (approved) reviews
    };

    if (filters?.minRating || filters?.maxRating) {
      where.rating = {};
      if (filters?.minRating) {
        where.rating.gte = filters.minRating;
      }
      if (filters?.maxRating) {
        where.rating.lte = filters.maxRating;
      }
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          appointment: {
            select: {
              id: true,
              startsAt: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get reviews by a user (as author - reviews they wrote)
   */
  async getReviewsByUser(
    authorId: string,
    filters?: {
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { authorId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          appointment: {
            select: {
              id: true,
              startsAt: true,
            },
          },
        },
      }),
      prisma.review.count({ where: { authorId } }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific review by ID
   */
  async getById(id: string): Promise<any> {
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        appointment: {
          select: {
            id: true,
            startsAt: true,
            status: true,
          },
        },
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    return review;
  }

  /**
   * Update a review (only by author, within time limit)
   */
  async update(
    id: string,
    authorId: string,
    data: {
      rating?: number;
      comment?: string;
      tags?: string[];
    }
  ): Promise<any> {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.authorId !== authorId) {
      throw new Error('Not authorized to update this review');
    }

    // Check if review was created within last 7 days
    const daysSinceCreation =
      (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation > 7) {
      throw new Error('Reviews can only be edited within 7 days of creation');
    }

    if (data.rating && (data.rating < 1 || data.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(data.rating && { rating: data.rating }),
        ...(data.comment !== undefined && { comment: data.comment }),
        ...(data.tags && { tags: JSON.stringify(data.tags) }),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete a review (only by author or admin)
   */
  async delete(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (!isAdmin && review.authorId !== userId) {
      throw new Error('Not authorized to delete this review');
    }

    await prisma.review.delete({
      where: { id },
    });
  }

  /**
   * Get review statistics for a user
   */
  async getStatistics(targetId: string): Promise<any> {
    const reviews = await prisma.review.findMany({
      where: {
        targetId,
        isModerated: false,
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };
    }

    const totalReviews = reviews.length;
    const sumRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = sumRatings / totalReviews;

    const ratingDistribution = reviews.reduce(
      (dist, r) => {
        dist[r.rating]++;
        return dist;
      },
      { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>
    );

    return {
      totalReviews,
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingDistribution,
    };
  }

  /**
   * Moderate a review (admin only)
   */
  async moderate(
    id: string,
    data: {
      isModerated: boolean;
      moderationNote?: string;
    }
  ): Promise<any> {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        isModerated: data.isModerated,
        moderationNote: data.moderationNote,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Get all reviews (admin only)
   */
  async listAll(filters?: {
    isModerated?: boolean;
    minRating?: number;
    maxRating?: number;
    targetId?: string;
    authorId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};

    if (filters?.isModerated !== undefined) {
      where.isModerated = filters.isModerated;
    }

    if (filters?.targetId) {
      where.targetId = filters.targetId;
    }

    if (filters?.authorId) {
      where.authorId = filters.authorId;
    }

    if (filters?.minRating || filters?.maxRating) {
      where.rating = {};
      if (filters.minRating) {
        where.rating.gte = filters.minRating;
      }
      if (filters.maxRating) {
        where.rating.lte = filters.maxRating;
      }
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          appointment: {
            select: {
              id: true,
              startsAt: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
