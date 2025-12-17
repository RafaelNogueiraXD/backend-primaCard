import { Request, Response } from 'express';
import { ProcedureService } from './procedure.service';
import logger from '../../config/logger';
import prisma from '../../config/database';

const procedureService = new ProcedureService();

export class ProcedureController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, category, description, defaultDurationMinutes, pointsGeneral, pointsCategory } = req.body;

      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });

      if (!professional) {
        res.status(403).json({
          errors: [{ message: 'Not authorized - user is not a professional' }],
        });
        return;
      }

      if (!name || !category || !defaultDurationMinutes || pointsGeneral === undefined || pointsCategory === undefined) {
        res.status(400).json({
          errors: [{ message: 'name, category, defaultDurationMinutes, pointsGeneral, and pointsCategory are required' }],
        });
        return;
      }

      const procedure = await procedureService.create({
        professionalId: professional.id,
        name,
        category,
        description,
        defaultDurationMinutes,
        pointsGeneral,
        pointsCategory,
      });

      logger.info(`Procedure created: ${procedure.id}`);
      res.status(201).json({ data: procedure });
    } catch (error: any) {
      logger.error('Error creating procedure:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to create procedure' }],
      });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      let professionalId: string | undefined;

      if (role === 'PROFESSIONAL') {
        // Get professional ID from user ID
        const professional = await prisma.professional.findUnique({
          where: { userId },
        });

        if (professional) {
          professionalId = professional.id;
        }
      }

      // If professionalId is provided, list procedures for that professional
      // If not (e.g. patient), list all active procedures or handle as needed
      // For now, let's allow listing all active procedures if no professionalId is specific
      // But the service method expects a professionalId. 
      // Let's modify the service to make professionalId optional or handle listing all.
      
      // Actually, the requirement is likely for patients to see procedures to book.
      // If the frontend is calling /procedures without params, it might expect a list of all available procedures.
      
      const procedures = await procedureService.list(professionalId); 

      res.json({ data: procedures });
    } catch (error: any) {
      logger.error('Error listing procedures:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list procedures' }],
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });

      if (!professional) {
        res.status(403).json({
          errors: [{ message: 'Not authorized - user is not a professional' }],
        });
        return;
      }

      const procedure = await procedureService.getById(id, professional.id);

      res.json({ data: procedure });
    } catch (error: any) {
      logger.error('Error getting procedure:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 404;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Procedure not found' }],
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { name, category, description, defaultDurationMinutes, pointsGeneral, pointsCategory, isActive } = req.body;

      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });

      if (!professional) {
        res.status(403).json({
          errors: [{ message: 'Not authorized - user is not a professional' }],
        });
        return;
      }

      const procedure = await procedureService.update(id, professional.id, {
        name,
        category,
        description,
        defaultDurationMinutes,
        pointsGeneral,
        pointsCategory,
        isActive,
      });

      logger.info(`Procedure updated: ${id}`);
      res.json({ data: procedure });
    } catch (error: any) {
      logger.error('Error updating procedure:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to update procedure' }],
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });

      if (!professional) {
        res.status(403).json({
          errors: [{ message: 'Not authorized - user is not a professional' }],
        });
        return;
      }

      const procedure = await procedureService.delete(id, professional.id);

      logger.info(`Procedure deleted (soft): ${id}`);
      res.json({ data: procedure, message: 'Procedure deactivated successfully' });
    } catch (error: any) {
      logger.error('Error deleting procedure:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to delete procedure' }],
      });
    }
  }

  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });

      if (!professional) {
        res.status(403).json({
          errors: [{ message: 'Not authorized - user is not a professional' }],
        });
        return;
      }

      const statistics = await procedureService.getStatistics(professional.id);

      res.json({ data: statistics });
    } catch (error: any) {
      logger.error('Error getting procedure statistics:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get statistics' }],
      });
    }
  }
}
