import { Request, Response } from 'express';
import { SurveyService } from './survey.service';
import logger from '../../config/logger';

const surveyService = new SurveyService();

export class SurveyController {
  /**
   * Create a new survey
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;
      const { title, description, targetAudience, questions, targetUserId } = req.body;

      if (!title || !questions) {
        res.status(400).json({
          errors: [{ message: 'title and questions are required' }],
        });
        return;
      }

      const survey = await surveyService.create({
        title,
        description,
        targetAudience: targetAudience || 'ALL',
        questions,
        createdById: userId,
        targetUserId: targetUserId || undefined,
      });

      logger.info(`Survey created: ${survey.id}`);
      res.status(201).json({ data: survey });
    } catch (error: any) {
      logger.error('Error creating survey:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to create survey' }],
      });
    }
  }

  /**
   * Get survey by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const survey = await surveyService.getById(id);

      res.json({ data: survey });
    } catch (error: any) {
      logger.error('Error getting survey:', error);
      const status = error.message.includes('not found') ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to get survey' }],
      });
    }
  }

  /**
   * List surveys
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { isActive, targetAudience, page, limit } = req.query;

      const filters: any = {};
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (targetAudience) filters.targetAudience = targetAudience as string;
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await surveyService.list(filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing surveys:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list surveys' }],
      });
    }
  }

  /**
   * Update survey
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, isActive, targetAudience, questions, targetUserId } = req.body;

      const updated = await surveyService.update(id, {
        title,
        description,
        isActive,
        targetAudience,
        questions,
        targetUserId,
      });

      logger.info(`Survey updated: ${id}`);
      res.json({ data: updated });
    } catch (error: any) {
      logger.error('Error updating survey:', error);
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to update survey' }],
      });
    }
  }

  /**
   * Delete survey
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await surveyService.delete(id);

      logger.info(`Survey deleted: ${id}`);
      res.status(204).send();
    } catch (error: any) {
      logger.error('Error deleting survey:', error);
      const status = error.message.includes('not found') ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to delete survey' }],
      });
    }
  }

  /**
   * Submit survey response
   */
  async submitResponse(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;
      const { surveyId } = req.params;
      const { answers } = req.body;

      if (!answers || !Array.isArray(answers)) {
        res.status(400).json({
          errors: [{ message: 'answers array is required' }],
        });
        return;
      }

      const response = await surveyService.submitResponse({
        surveyId,
        respondentId: userId,
        answers,
      });

      logger.info(`Survey response submitted: ${response.id}`);
      res.status(201).json({ data: response });
    } catch (error: any) {
      logger.error('Error submitting survey response:', error);
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to submit response' }],
      });
    }
  }

  /**
   * Get survey responses
   */
  async getResponses(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      const filters: any = {};
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await surveyService.getResponses(id, filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting survey responses:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get responses' }],
      });
    }
  }

  /**
   * Get available surveys for current user
   */
  async getAvailable(req: Request, res: Response): Promise<void> {
    try {
      const { userId, role } = req.user as any;

      const surveys = await surveyService.getAvailableSurveys(userId, role);

      res.json({ data: surveys });
    } catch (error: any) {
      logger.error('Error getting available surveys:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get available surveys' }],
      });
    }
  }

  /**
   * Get user's survey responses
   */
  async getMyResponses(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;

      const responses = await surveyService.getUserResponses(userId);

      res.json({ data: responses });
    } catch (error: any) {
      logger.error('Error getting user responses:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get responses' }],
      });
    }
  }
}
