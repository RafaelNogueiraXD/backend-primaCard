import { Request, Response, NextFunction } from 'express';
import { ProfessionalService } from './professional.service';
import { ResponseHandler } from '../../utils/responseHandler';

export class ProfessionalController {
  private professionalService: ProfessionalService;

  constructor() {
    this.professionalService = new ProfessionalService();
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { specialty, search, page, perPage } = req.query;
      
      const result = await this.professionalService.list({
        specialty: specialty as string,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });
      
      ResponseHandler.success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { professionalId } = req.params;
      const professional = await this.professionalService.getById(professionalId);
      ResponseHandler.success(res, professional);
    } catch (error) {
      next(error);
    }
  }

  async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { professionalId } = req.params;
      const { date } = req.query;
      
      if (!date) {
        ResponseHandler.error(res, 400, 'Date parameter is required');
        return;
      }

      const result = await this.professionalService.getAvailability(
        professionalId,
        new Date(date as string)
      );
      
      ResponseHandler.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getProcedures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { professionalId } = req.params;
      const procedures = await this.professionalService.getProcedures(professionalId);
      ResponseHandler.success(res, procedures);
    } catch (error) {
      next(error);
    }
  }

  async getReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { professionalId } = req.params;
      const { rating, page, perPage } = req.query;
      
      const result = await this.professionalService.getReviews(professionalId, {
        rating: rating ? parseInt(rating as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });
      
      ResponseHandler.success(res, result.data, {
        ...result.meta,
        averageRating: result.averageRating,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { registrationNumber, specialty, bio } = req.body;
      
      const professional = await this.professionalService.updateProfile(userId, {
        registrationNumber,
        specialty,
        bio,
      });
      
      ResponseHandler.success(res, professional);
    } catch (error) {
      next(error);
    }
  }

  async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const stats = await this.professionalService.getStatistics(userId);
      ResponseHandler.success(res, stats);
    } catch (error) {
      next(error);
    }
  }
}
