import { TeamService } from '@/app/server/services/TeamService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  team: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  department: {
    findUnique: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
  teamMember: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TeamService', () => {
  let service: TeamService;

  beforeEach(() => {
    service = new TeamService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create a new team', async () => {
        const input = {
          name: 'Frontend Team',
          description: 'Frontend development team',
          departmentId: 'dept1',
          leaderId: 'user1',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
          id: 'dept1',
          name: 'Engineering',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          role: 'MANAGER',
          departmentId: 'dept1',
        });

        const mockCreated = {
          id: 'team1',
          ...input,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          department: { id: 'dept1', name: 'Engineering' },
          leader: {
            id: 'user1',
            name: 'Manager',
            email: 'manager@example.com',
          },
        };

        (mockPrisma.team.create as jest.Mock).mockResolvedValue(mockCreated);

        const result = await service.create(input);

        expect(mockPrisma.team.create).toHaveBeenCalledWith({
          data: {
            name: input.name,
            description: input.description,
            departmentId: input.departmentId,
            leaderId: input.leaderId,
          },
          include: expect.any(Object),
        });

        expect(result!.name).toBe('Frontend Team');
      });

      it('should throw error when department not found', async () => {
        const input = {
          name: 'Team',
          departmentId: 'nonexistent',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.create(input)).rejects.toThrow(
          'Department not found'
        );
      });

      it('should throw error when leader not found', async () => {
        const input = {
          name: 'Team',
          departmentId: 'dept1',
          leaderId: 'nonexistent',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
          id: 'dept1',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
          null
        );

        await expect(service.create(input)).rejects.toThrow('Leader not found');
      });
    });

    describe('Read', () => {
      it('should get all teams', async () => {
        const mockTeams = [
          {
            id: 'team1',
            name: 'Frontend Team',
            isActive: true,
            department: { id: 'dept1', name: 'Engineering' },
            leader: {
              id: 'user1',
              name: 'Manager',
              email: 'manager@example.com',
            },
            members: [],
          },
        ];

        (mockPrisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

        const result = await service.getAll();

        expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
          where: { isActive: true },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(1);
        expect(result![0].name).toBe('Frontend Team');
      });

      it('should get team by ID', async () => {
        const mockTeam = {
          id: 'team1',
          name: 'Frontend Team',
          department: { id: 'dept1', name: 'Engineering' },
          leader: {
            id: 'user1',
            name: 'Manager',
            email: 'manager@example.com',
            role: 'MANAGER',
          },
          members: [],
        };

        (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue(mockTeam);

        const result = await service.getById('team1');

        expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({
          where: { id: 'team1' },
          include: expect.any(Object),
        });

        expect(result?.name).toBe('Frontend Team');
      });

      it('should get teams by department', async () => {
        const mockTeams = [
          {
            id: 'team1',
            name: 'Team 1',
            departmentId: 'dept1',
            leader: null,
            members: [],
          },
        ];

        (mockPrisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

        const result = await service.getByDepartment('dept1');

        expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: 'dept1',
            isActive: true,
          },
          include: expect.any(Object),
          orderBy: { name: 'asc' },
        });

        expect(result).toHaveLength(1);
      });

      it('should get teams by leader', async () => {
        const mockTeams = [
          {
            id: 'team1',
            name: 'Team 1',
            leaderId: 'user1',
            department: { id: 'dept1', name: 'Engineering' },
            members: [],
          },
        ];

        (mockPrisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

        const result = await service.getByLeader('user1');

        expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
          where: {
            leaderId: 'user1',
            isActive: true,
          },
          include: expect.any(Object),
        });

        expect(result).toHaveLength(1);
      });
    });

    describe('Update', () => {
      it('should update a team', async () => {
        const existingTeam = {
          id: 'team1',
          name: 'Old Name',
        };

        const updateData = {
          name: 'New Name',
        };

        (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue(
          existingTeam
        );

        const mockUpdated = {
          ...existingTeam,
          ...updateData,
          updatedAt: new Date(),
        };

        (mockPrisma.team.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await service.update('team1', updateData);

        expect(mockPrisma.team.update).toHaveBeenCalledWith({
          where: { id: 'team1' },
          data: updateData,
          include: expect.any(Object),
        });

        expect(result!.name).toBe('New Name');
      });

      it('should throw error when team not found', async () => {
        (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.update('nonexistent', { name: 'New' })
        ).rejects.toThrow('Team not found');
      });
    });

    describe('Delete', () => {
      it('should delete team (soft delete)', async () => {
        const mockDeleted = {
          id: 'team1',
          name: 'Team',
          isActive: false,
        };

        (mockPrisma.team.update as jest.Mock).mockResolvedValue(mockDeleted);

        const result = await service.delete('team1');

        expect(mockPrisma.team.update).toHaveBeenCalledWith({
          where: { id: 'team1' },
          data: { isActive: false },
        });

        expect(result!.isActive).toBe(false);
      });
    });
  });

  describe('Team Member Management', () => {
    it('should add member to team', async () => {
      (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue({
        id: 'team1',
        isActive: true,
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        isActive: true,
      });

      (mockPrisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        teamId: 'team1',
        userId: 'user1',
        joinedAt: new Date(),
        user: {
          id: 'user1',
          name: 'User',
          email: 'user@example.com',
          role: 'STAFF',
        },
      };

      (mockPrisma.teamMember.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.addMember('team1', 'user1');

      expect(result!.userId).toBe('user1');
    });

    it('should throw error when user already a member', async () => {
      (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue({
        id: 'team1',
        isActive: true,
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        isActive: true,
      });

      (mockPrisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
        teamId: 'team1',
        userId: 'user1',
      });

      await expect(service.addMember('team1', 'user1')).rejects.toThrow(
        'User is already a member of this team'
      );
    });

    it('should throw error when team is inactive', async () => {
      (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue({
        id: 'team1',
        isActive: false,
      });

      await expect(service.addMember('team1', 'user1')).rejects.toThrow(
        'Team not found or inactive'
      );
    });

    it('should throw error when user is inactive', async () => {
      (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue({
        id: 'team1',
        isActive: true,
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        isActive: false,
      });

      await expect(service.addMember('team1', 'user1')).rejects.toThrow(
        'User not found or inactive'
      );
    });

    it('should remove member from team', async () => {
      (mockPrisma.teamMember.delete as jest.Mock).mockResolvedValue({
        teamId: 'team1',
        userId: 'user1',
      });

      const result = await service.removeMember('team1', 'user1');

      expect(mockPrisma.teamMember.delete).toHaveBeenCalledWith({
        where: {
          teamId_userId: {
            teamId: 'team1',
            userId: 'user1',
          },
        },
      });

      expect(result!.userId).toBe('user1');
    });

    it('should get team members', async () => {
      const mockMembers = [
        {
          teamId: 'team1',
          userId: 'user1',
          joinedAt: new Date(),
          user: {
            id: 'user1',
            name: 'User 1',
            email: 'user1@example.com',
            role: 'STAFF',
            department: { id: 'dept1', name: 'Engineering' },
          },
        },
      ];

      (mockPrisma.teamMember.findMany as jest.Mock).mockResolvedValue(
        mockMembers
      );

      const result = await service.getMembers('team1');

      expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team1' },
        include: expect.any(Object),
      });

      expect(result).toHaveLength(1);
      expect(result![0].name).toBe('User 1');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in getAll', async () => {
      (mockPrisma.team.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getAll()).rejects.toThrow('getAll: Database error');
    });

    it('should handle errors in getById', async () => {
      (mockPrisma.team.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getById('team1')).rejects.toThrow(
        'getById: Database error'
      );
    });

    it('should handle errors in getByDepartment', async () => {
      (mockPrisma.team.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getByDepartment('dept1')).rejects.toThrow(
        'getByDepartment: Database error'
      );
    });

    it('should handle errors in getByLeader', async () => {
      (mockPrisma.team.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getByLeader('user1')).rejects.toThrow(
        'getByLeader: Database error'
      );
    });

    it('should handle errors in delete', async () => {
      (mockPrisma.team.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.delete('team1')).rejects.toThrow(
        'delete: Database error'
      );
    });

    it('should handle errors in removeMember', async () => {
      (mockPrisma.teamMember.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.removeMember('team1', 'user1')).rejects.toThrow(
        'removeMember: Database error'
      );
    });

    it('should handle errors in getMembers', async () => {
      (mockPrisma.teamMember.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getMembers('team1')).rejects.toThrow(
        'getMembers: Database error'
      );
    });
  });

  describe('Validation Edge Cases', () => {
    it('should throw error when leader is not in same department and not a manager', async () => {
      const input = {
        name: 'Team',
        departmentId: 'dept1',
        leaderId: 'user1',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        role: 'STAFF',
        departmentId: 'dept2', // Different department
      });

      await expect(service.create(input)).rejects.toThrow(
        'Leader must be in the same department or be a manager'
      );
    });

    it('should allow leader from different department if they are a MANAGER', async () => {
      const input = {
        name: 'Team',
        departmentId: 'dept1',
        leaderId: 'user1',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        role: 'MANAGER',
        departmentId: 'dept2', // Different department but is MANAGER
      });

      const mockCreated = {
        id: 'team1',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: { id: 'dept1', name: 'Engineering' },
        leader: {
          id: 'user1',
          name: 'Manager',
          email: 'manager@example.com',
        },
      };

      (mockPrisma.team.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await service.create(input);
      expect(result!.name).toBe('Team');
    });

    it('should allow leader from different department if they are HR_ADMIN', async () => {
      const input = {
        name: 'Team',
        departmentId: 'dept1',
        leaderId: 'user1',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        role: 'HR_ADMIN',
        departmentId: 'dept2', // Different department but is HR_ADMIN
      });

      const mockCreated = {
        id: 'team1',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: { id: 'dept1', name: 'Engineering' },
        leader: {
          id: 'user1',
          name: 'HR Admin',
          email: 'hradmin@example.com',
        },
      };

      (mockPrisma.team.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await service.create(input);
      expect(result!.name).toBe('Team');
    });

    it('should throw error when updating with invalid department', async () => {
      const existingTeam = {
        id: 'team1',
        name: 'Team',
      };

      const updateData = {
        departmentId: 'nonexistent',
      };

      (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue(existingTeam);

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('team1', updateData)).rejects.toThrow(
        'Department not found'
      );
    });

    it('should update team with valid department', async () => {
      const existingTeam = {
        id: 'team1',
        name: 'Team',
      };

      const updateData = {
        departmentId: 'dept2',
      };

      (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue(existingTeam);

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept2',
        name: 'New Department',
      });

      const mockUpdated = {
        ...existingTeam,
        ...updateData,
        updatedAt: new Date(),
        department: { id: 'dept2', name: 'New Department' },
      };

      (mockPrisma.team.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.update('team1', updateData);
      expect(result!.departmentId).toBe('dept2');
    });
  });
});
