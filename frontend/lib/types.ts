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

export type Pokemon = {
  id: string;
  name: string;
  types: string[];
  description: string | null;
  imageKey: string | null;
  createdBy: string;
  creatorUsername?: string;
};

export type FilterMode = "ALL" | "TYPES";
export type PokemonInput = Pick<Pokemon, "name" | "types" | "description" | "imageKey">;
