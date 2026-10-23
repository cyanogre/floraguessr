export type Continent =
  | 'EUROPE' | 'AFRICA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA' | 'ASIA' | 'ANTARCTICA';

export type Iucn = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export interface Photo {
  url: string;
  /** Texto de atribución tal como lo da iNaturalist: «(c) Autor, algunos derechos reservados (CC BY)». */
  attribution: string;
  /** Código de licencia (cc-by, cc0…). null = sin verificar todavía. */
  license: string | null;
}

export interface Species {
  taxonId: number;
  sci: string;
  /** Grupo botánico legible (Coníferas, Helechos…). */
  group: string;
  /** Nombre común en el idioma de la interfaz, si existe. */
  name: string;
  photo: Photo | null;
  /** Visitas anuales en la Wikipedia en inglés. null = sin dato fiable. */
  views: number | null;
  observations: number;
  iucn: Iucn | null;
  wikiTitle?: string;
  gbifKey?: number;
  /** Silueta de herbario de reserva cuando no hay foto. */
  shape?: SpecimenShape;
  /** Nota propia (partida de muestra), en lugar del resumen de Wikipedia. */
  note?: string;
}

export type SpecimenShape =
  | 'conifer' | 'fern' | 'moss' | 'grass' | 'palm' | 'cactus' | 'orchid' | 'flower' | 'leaf' | 'succulent' | 'pitcher' | 'lily';

export interface Place {
  lat: number;
  lng: number;
  continent: Continent;
  country?: string;
}

/** Lo que se sabe de una carta en el lugar de la ronda (se calcula al montar el sobre). */
export interface Evidence {
  inat: number;
  gbif: number;
  native: boolean;
  /** Puntos de registros para pintarlos al revelar. */
  points: [number, number][];
}

export interface Round {
  place: Place;
  cards: Species[];
  /** taxonId → pruebas en el círculo. */
  evidence: Record<number, Evidence>;
  /** La carta que el juego considera «la respuesta» si el jugador se rinde. */
  answerId: number;
  /** Partida de muestra: presencia según conocimiento general, sin recuentos que enseñar. */
  sample?: { label: string };
}
