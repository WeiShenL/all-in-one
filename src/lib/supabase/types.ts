import { User } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      UserProfile: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
          departmentId: string;
          isHrAdmin: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role?: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
          departmentId: string;
          isHrAdmin?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
          departmentId?: string;
          isHrAdmin?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      UserRole: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
      TaskPriority: 'LOW' | 'MEDIUM' | 'HIGH';
      TaskStatus: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    };
  };
};

// Auth types
export type UserProfile = Database['public']['Tables']['UserProfile']['Row'];
export type UserRole = Database['public']['Enums']['UserRole'];
export type TaskPriority = Database['public']['Enums']['TaskPriority'];
export type TaskStatus = Database['public']['Enums']['TaskStatus'];

// Extended user type that includes profile
export interface AuthUser extends User {
  user_profile?: UserProfile;
}
