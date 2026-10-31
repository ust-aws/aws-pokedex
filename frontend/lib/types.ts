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

export const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export interface Pokemon {
  id: string;
  name: string;
  types: PokemonType[];
  description: string | null;
  imageKey: string | null;
  createdBy: string;
  creator?: { username: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresignResponse {
  url: string;
  fields: Record<string, string>;
  key: string;
}
