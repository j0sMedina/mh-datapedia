export interface ElementWeakness {
  id: string;
  element: string;
  rating: number;
  isImmune: boolean;
}

export interface Hitzone {
  id: string;
  part: string;
  cut: number;
  blunt: number;
  bullet: number;
  fire: number;
  water: number;
  thunder: number;
  ice: number;
  dragon: number;
  stun: number;
}

export interface MonsterDrop {
  id: string;
  game: string;
  rank: string;
  method: string;
  part: string | null;
  itemName: string;
  quantity: number;
  rate: number;
}

export interface Strategy {
  id: string;
  title: string;
  content: string;
  difficulty: string;
  game: string;
  authorId: string;
  author: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export interface MonsterListItem {
  id: string;
  name: string;
  title: string;
  type: string;
  imageUrl: string | null;
  iconUrl: string | null;
  isBoss: boolean;
  habitats: string[];
  weaknesses: ElementWeakness[];
}

export interface MonsterDetail extends MonsterListItem {
  description: string;
  parentId: string | null;
  hitzones: Hitzone[];
  strategies: Strategy[];
  ailments: { id: string; ailment: string }[];
  drops: MonsterDrop[];
  subspecies: { id: string; name: string; type: string; iconUrl: string | null; imageUrl: string | null; title: string }[];
  parent: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
