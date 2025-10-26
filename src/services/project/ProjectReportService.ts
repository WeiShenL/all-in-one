/**
 * ProjectReportService - Domain Service for Project Report Export
 *
 * Business Requirements:
 * - Only HR/Admin users (isHrAdmin flag OR HR_ADMIN role) can export reports
 * - Fetch project data: tasks, collaborators
 *
 * Architecture:
 * - Service Layer: Orchestrates authorization and delegates to repository
 * - Uses IProjectRepository for data access (repository pattern)
 * - Uses PrismaClient only for authorization check (follows codebase pattern)
 * - Returns structured data for PDF/XLSX export
 */

import { PrismaClient } from '@prisma/client';
import { IProjectRepository } from '../../repositories/IProjectRepository';

/**
 * Project Report Data Structure
 * Returned by getProjectReportData for export utilities
 */
export interface ProjectReportData {
  project: {
    id: string;
    name: string;
    description: string | null;
    priority: number;
    status: string;
    departmentName: string;
    creatorName: string;
    creatorEmail: string;
    createdAt: Date;
    updatedAt: Date;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: number;
    dueDate: Date;
    createdAt: Date;
    ownerName: string;
    ownerEmail: string;
    assignees: string[]; // Array of assignee names
  }>;
  collaborators: Array<{
    name: string;
    email: string;
    departmentName: string;
    addedAt: Date;
  }>;
}

export class ProjectReportService {
  /**
   *
   * @param projectRepository - Repository for project data access
   * @param prisma - PrismaClient for authorization check (follows codebase pattern)
   */
  constructor(
    private projectRepository: IProjectRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * Get project report data for export
   *
   * Service Orchestration Flow:
   * 1. Authorization validation (HR/Admin check via Prisma)
   * 2. Delegate data fetching to repository
   *
   * @param projectId - Project ID to fetch report for
   * @param userId - User requesting the report (for authorization)
   * @returns ProjectReportData for PDF/XLSX export
   * @throws Error if user not authorized or project not found
   */
  async getProjectReportData(
    projectId: string,
    userId: string
  ): Promise<ProjectReportData> {
    // ============================================
    // STEP 1: Authorization Check
    // ============================================
    const user = await this.prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is HR/Admin: either HR_ADMIN role OR isHrAdmin flag
    const isAuthorized = user.role === 'HR_ADMIN' || user.isHrAdmin === true;

    if (!isAuthorized) {
      throw new Error('Unauthorized: Only HR/Admin users can export reports');
    }

    // ============================================
    // STEP 2: Delegate Data Fetching to Repository
    // ============================================
    // Repository handles all database queries and data transformation
    // Service focuses on orchestration and authorization
    return this.projectRepository.getProjectReportData(projectId);
  }
}
