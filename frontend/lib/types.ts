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
  classification: string;
  description: string;
  image: string;
  ownerId: string;
};

export type FilterMode = "ALL" | "TYPES" | "CLASSIFICATION";
export type PokemonInput = Omit<Pokemon, "id" | "ownerId">;
export const normalizeUser = (name: string) => name.trim().toLowerCase();
