import { BaseService } from './BaseService';
import { CreateTeamInput, UpdateTeamInput } from '../types';

/**
 * TeamService
 *
 * Handles all business logic related to teams including:
 * - Team CRUD operations
 * - Team member management
 * - Team filtering and queries
 */
export class TeamService extends BaseService {
  /**
   * Get all active teams
   * @returns Array of teams
   */
  async getAll() {
    try {
      return await this.prisma.team.findMany({
        where: {
          isActive: true,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          leader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getAll');
    }
  }

  /**
   * Get team by ID with full details
   * @param id - Team ID
   * @returns Team with members or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'Team ID');

      return await this.prisma.team.findUnique({
        where: { id },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          leader: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Get all teams in a department
   * @param departmentId - Department ID
   * @returns Array of teams
   */
  async getByDepartment(departmentId: string) {
    try {
      this.validateId(departmentId, 'Department ID');

      return await this.prisma.team.findMany({
        where: {
          departmentId,
          isActive: true,
        },
        include: {
          leader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getByDepartment');
    }
  }

  /**
   * Get teams led by a specific user
   * @param leaderId - Leader user ID
   * @returns Array of teams
   */
  async getByLeader(leaderId: string) {
    try {
      this.validateId(leaderId, 'Leader ID');

      return await this.prisma.team.findMany({
        where: {
          leaderId,
          isActive: true,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getByLeader');
    }
  }

  /**
   * Create a new team
   * @param data - Team creation data
   * @returns Created team
   */
  async create(data: CreateTeamInput) {
    try {
      // Validate department exists
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      // Validate leader exists if provided
      if (data.leaderId) {
        const leader = await this.prisma.userProfile.findUnique({
          where: { id: data.leaderId },
        });

        if (!leader) {
          throw new Error('Leader not found');
        }

        // Verify leader is in the same department or is a manager
        if (
          leader.departmentId !== data.departmentId &&
          leader.role !== 'MANAGER' &&
          leader.role !== 'HR_ADMIN'
        ) {
          throw new Error(
            'Leader must be in the same department or be a manager'
          );
        }
      }

      return await this.prisma.team.create({
        data: {
          name: data.name,
          description: data.description,
          departmentId: data.departmentId,
          leaderId: data.leaderId,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          leader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update a team
   * @param id - Team ID
   * @param data - Team update data
   * @returns Updated team
   */
  async update(id: string, data: UpdateTeamInput) {
    try {
      this.validateId(id, 'Team ID');

      // Check team exists
      const existing = await this.prisma.team.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Team not found');
      }

      // Validate department if changing
      if (data.departmentId) {
        const department = await this.prisma.department.findUnique({
          where: { id: data.departmentId },
        });

        if (!department) {
          throw new Error('Department not found');
        }
      }

      return await this.prisma.team.update({
        where: { id },
        data,
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          leader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete a team (soft delete)
   * @param id - Team ID
   * @returns Updated team
   */
  async delete(id: string) {
    try {
      this.validateId(id, 'Team ID');

      return await this.prisma.team.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Add a member to a team
   * @param teamId - Team ID
   * @param userId - User ID
   * @returns Created team member relationship
   */
  async addMember(teamId: string, userId: string) {
    try {
      this.validateId(teamId, 'Team ID');
      this.validateId(userId, 'User ID');

      // Verify team exists
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
      });

      if (!team || !team.isActive) {
        throw new Error('Team not found or inactive');
      }

      // Verify user exists
      const user = await this.prisma.userProfile.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Check if already a member
      const existingMember = await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      if (existingMember) {
        throw new Error('User is already a member of this team');
      }

      return await this.prisma.teamMember.create({
        data: {
          teamId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'addMember');
    }
  }

  /**
   * Remove a member from a team
   * @param teamId - Team ID
   * @param userId - User ID
   * @returns Deleted team member relationship
   */
  async removeMember(teamId: string, userId: string) {
    try {
      this.validateId(teamId, 'Team ID');
      this.validateId(userId, 'User ID');

      return await this.prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'removeMember');
    }
  }

  /**
   * Get all members of a team
   * @param teamId - Team ID
   * @returns Array of team members with user details
   */
  async getMembers(teamId: string) {
    try {
      this.validateId(teamId, 'Team ID');

      const members = await this.prisma.teamMember.findMany({
        where: { teamId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return members.map(m => ({
        ...m.user,
        joinedAt: m.joinedAt,
      }));
    } catch (error) {
      this.handleError(error, 'getMembers');
    }
  }
}
