export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  username: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
