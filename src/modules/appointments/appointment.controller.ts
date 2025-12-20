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
      
      // If professional is creating appointment
      if (role === 'PROFESSIONAL') {
        // Check if they are booking for another patient
        if (req.body.patientId && req.body.patientId !== userId) {
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
          
          // Ensure professional is booking for themselves as provider
          if (professionalId !== professional.id) {
            res.status(403).json({
              errors: [{ message: 'You can only create appointments for yourself as provider' }],
            });
            return;
          }
        } else {
          // Booking for self (acting as patient)
          patientId = userId;
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
      const { status, from, to, page, perPage, asPatient } = req.query;

      // If asPatient is true, force role to PATIENT to fetch appointments where user is the patient
      const effectiveRole = asPatient === 'true' ? 'PATIENT' : role;

      const result = await appointmentService.list({
        userId,
        role: effectiveRole,
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

  async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { professionalId } = req.params;
      const { date, procedureId } = req.query;

      if (!date) {
        res.status(400).json({
          errors: [{ message: 'Date is required (YYYY-MM-DD format)' }],
        });
        return;
      }

      const dateObj = new Date(date as string);
      if (isNaN(dateObj.getTime())) {
        res.status(400).json({
          errors: [{ message: 'Invalid date format. Use YYYY-MM-DD' }],
        });
        return;
      }

      const slots = await appointmentService.getAvailableSlots(
        professionalId,
        dateObj,
        procedureId as string | undefined
      );

      res.json({ data: slots });
    } catch (error: any) {
      logger.error('Error getting available slots:', error);
      res.status(error.message === 'Professional not found' ? 404 : 500).json({
        errors: [{ message: error.message || 'Failed to get available slots' }],
      });
    }
  }

  async getAvailableDates(req: Request, res: Response): Promise<void> {
    try {
      const { professionalId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          errors: [{ message: 'startDate and endDate are required (YYYY-MM-DD format)' }],
        });
        return;
      }

      const startDateObj = new Date(startDate as string);
      const endDateObj = new Date(endDate as string);

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        res.status(400).json({
          errors: [{ message: 'Invalid date format. Use YYYY-MM-DD' }],
        });
        return;
      }

      const dates = await appointmentService.getAvailableDates(
        professionalId,
        startDateObj,
        endDateObj
      );

      res.json({ data: dates });
    } catch (error: any) {
      logger.error('Error getting available dates:', error);
      res.status(error.message === 'Professional not found' ? 404 : 500).json({
        errors: [{ message: error.message || 'Failed to get available dates' }],
      });
    }
  }
}
