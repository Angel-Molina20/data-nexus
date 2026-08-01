export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
  permissions: string[];
  must_change_password: boolean;
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  status: string;
  is_superuser: boolean;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  roles: string[];
  created_at: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  resource_type: string;
}
