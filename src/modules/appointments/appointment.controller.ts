import { Request, Response } from 'express';
import { AppointmentService } from './appointment.service';
import logger from '../../config/logger';
import prisma from '../../config/database';

const appointmentService = new AppointmentService();

export class AppointmentController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { professionalId, procedureId, startsAt, idempotencyKey } = req.body;
      const userId = req.user!.userId;
      const role = req.user!.role;
      
      let patientId = userId;
      
      // If professional is creating appointment, they must specify patientId
      if (role === 'PROFESSIONAL') {
        if (!req.body.patientId) {
          res.status(400).json({
            errors: [{ message: 'patientId is required when creating appointment as professional' }],
          });
          return;
        }
        patientId = req.body.patientId;
        
        // Verify professional exists
        const professional = await prisma.professional.findUnique({
          where: { userId },
        });
        
        if (!professional) {
          res.status(403).json({
            errors: [{ message: 'Professional profile not found' }],
          });
          return;
        }
        
        // Ensure professional is booking for themselves
        if (professionalId !== professional.id) {
          res.status(403).json({
            errors: [{ message: 'You can only create appointments for yourself' }],
          });
          return;
        }
      }

      const createdById = userId;

      if (!professionalId || !procedureId || !startsAt) {
        res.status(400).json({
          errors: [{ message: 'professionalId, procedureId, and startsAt are required' }],
        });
        return;
      }

      const appointment = await appointmentService.create({
        professionalId,
        patientId,
        procedureId,
        startsAt: new Date(startsAt),
        createdById,
        idempotencyKey,
      });

      logger.info(`Appointment created: ${appointment.id}`);
      res.status(201).json({ data: appointment });
    } catch (error: any) {
      logger.error('Error creating appointment:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to create appointment' }],
      });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { status, from, to, page, perPage } = req.query;

      const result = await appointmentService.list({
        userId,
        role,
        status: status as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 20,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing appointments:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list appointments' }],
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role;

      const appointment = await appointmentService.getById(id, userId, role);

      res.json({ data: appointment });
    } catch (error: any) {
      logger.error('Error getting appointment:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 404;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Appointment not found' }],
      });
    }
  }

  async accept(req: Request, res: Response): Promise<void> {
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

      const appointment = await appointmentService.accept(id, professional.id);

      logger.info(`Appointment accepted: ${id}`);
      res.json({ data: appointment });
    } catch (error: any) {
      logger.error('Error accepting appointment:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to accept appointment' }],
      });
    }
  }

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { reason } = req.body;

      const appointment = await appointmentService.cancel(id, userId, role, reason);

      logger.info(`Appointment canceled: ${id} by ${role}`);
      res.json({ data: appointment });
    } catch (error: any) {
      logger.error('Error canceling appointment:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to cancel appointment' }],
      });
    }
  }

  async markArrival(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { arrivalMarkedAt } = req.body;

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

      const appointment = await appointmentService.markArrival(
        id,
        professional.id,
        arrivalMarkedAt ? new Date(arrivalMarkedAt) : undefined
      );

      logger.info(`Appointment arrival marked: ${id}`);
      res.json({ data: appointment });
    } catch (error: any) {
      logger.error('Error marking arrival:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to mark arrival' }],
      });
    }
  }

  async complete(req: Request, res: Response): Promise<void> {
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

      const appointment = await appointmentService.complete(id, professional.id);

      logger.info(`Appointment completed: ${id}`);
      res.json({ data: appointment });
    } catch (error: any) {
      logger.error('Error completing appointment:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to complete appointment' }],
      });
    }
  }

  async markNoShow(req: Request, res: Response): Promise<void> {
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

      const appointment = await appointmentService.markNoShow(id, professional.id);

      logger.info(`Appointment marked as no-show: ${id}`);
      res.json({ data: appointment });
    } catch (error: any) {
      logger.error('Error marking no-show:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to mark no-show' }],
      });
    }
  }
}
