import type { TierId } from '../game/rarity';
import type { Continent } from '../game/types';

/** Textos de la interfaz. En la fase 5 se añade en.ts con las mismas claves. */
export const es = {
  appName: 'FloraGuessr',
  eyebrow: 'Cuaderno de campo',
  lede: 'Te dejamos en un punto real del mapa. Entre seis fichas de herbario, elige una planta que viva a menos de 75 km.',
  plateCaption: 'Lám. I · Helecho de Barnsley, dibujado punto a punto con cuatro reglas',
  modeLegend: 'Cómo quieres jugar',
  modes: {
    mundial: ['Mundial', 'Lugares y plantas de cualquier rincón. Las fichas salen de lo que se ha visto allí y en la región.'],
    equilibrado: ['Equilibrado', 'Un sobre con plantas de grupos distintos, de los musgos a las orquídeas, y el lugar de una de ellas.'],
  },
  difficultyLegend: 'Señuelos',
  difficulty: {
    facil: ['Lejanos', 'De hasta 2.500 km'],
    normal: ['De la región', 'De hasta 1.200 km'],
    dificil: ['Vecinos', 'De hasta 500 km'],
  },
  play: 'Salir al campo',
  music: 'Música',
  credits: 'Fuentes y créditos',
  best: (n: string) => `Mejor cuaderno: ${n} puntos`,
  demoNote: 'Partida de muestra, sin conexión: siete lugares preparados con plantas reales. La versión completa consulta los registros en vivo.',

  hud: {
    menu: 'Portada',
    round: (n: number, of: number) => `Pliego ${n} de ${of}`,
    points: 'puntos',
    hint: 'Pista',
    hintTitle: 'Tacha dos fichas que no viven aquí. La ronda valdrá un 30 % menos.',
    surrender: 'Rendirse',
    reroll: 'Otro sobre',
    rerollTitle: (n: number) => `Cambia de lugar y de fichas. Te quedan ${n}.`,
    musicOn: 'Silenciar la música',
    musicOff: 'Activar la música',
    layer: 'Cambiar entre lámina y satélite',
  },

  slip: {
    loading: ['Buscando un rincón con plantas registradas…', 'Eligiendo plantas de la región…', 'Comprobando quién vive dentro del círculo…'],
    choose: '¿Qué planta vive a menos de 75 km de la chincheta?',
    chooseSub: 'Puede haber más de una. Toca una ficha para elegirla.',
    confirmSub: 'Tócala otra vez o pulsa el botón para confirmar.',
    hinted: 'Dos fichas tachadas: esas no viven aquí.',
  },
  confirm: (name: string) => `Elegir ${name}`,

  verdict: { yes: 'Vive aquí', no: 'No consta aquí', answer: 'La respuesta' },
  tiers: { comun: 'Común', pocoComun: 'Poco común', rara: 'Rara', epica: 'Épica', legendaria: 'Legendaria' } satisfies Record<TierId, string>,

  sheet: {
    mine: 'Tu elección',
    answer: 'Una respuesta válida',
    surrendered: 'Te has rendido',
    herbarium: 'Herbario FloraGuessr',
    group: 'Grupo',
    locality: 'Localidad',
    radius: 'Radio',
    records: 'Registros en el círculo',
    recordsValue: (inat: number, gbif: number) => `${inat} observaciones · ${gbif} registros de colecciones`,
    origin: 'Origen',
    native: 'Nativa',
    introduced: 'Sin confirmar como nativa',
    absent: 'Sin registros fiables',
    iucn: 'Lista Roja UICN',
    views: 'Visitas en Wikipedia',
    viewsValue: (n: string) => `${n} al año`,
    noViews: 'Sin dato',
    alsoHere: 'También vivían aquí:',
    points: (n: string) => `+${n} puntos`,
    zero: '0 puntos',
    next: 'Siguiente pliego',
    finish: 'Cerrar el cuaderno',
    showMap: 'Ver el mapa',
    showSheet: 'Ver la ficha',
    photo: 'Foto',
    noPhoto: 'Sin foto con licencia abierta: dibujo del pliego',
    sampleDrawing: 'Dibujo del pliego. La partida de muestra no carga fotos.',
    text: 'Texto',
    sampleNote: 'Nota del cuaderno',
    sampleRecords: 'Presencia según su área de distribución conocida (partida de muestra)',
    loadingText: 'Buscando la descripción…',
    wikipedia: 'Wikipedia',
    inaturalist: 'iNaturalist',
  },
  factor: { base: 'base', rarity: (t: string) => t.toLowerCase(), native: 'nativa', hint: 'pista' },

  end: {
    title: 'Cuaderno completo',
    sub: (n: number) => `${n} pliegos recolectados`,
    record: 'Nuevo récord',
    col: { n: 'Pliego', place: 'Lugar', pick: 'Tu elección', result: 'Resultado', pts: 'Puntos' },
    surrendered: 'Rendición',
    again: 'Otra salida al campo',
    menu: 'Volver a la portada',
  },

  error: {
    network: ['Los registros no contestan', 'No hemos podido consultar las observaciones de plantas. Comprueba tu conexión y vuelve a intentarlo.'],
    noPlace: ['Esta vez el mapa se ha quedado en blanco', 'No hemos encontrado un lugar con plantas suficientes para montar el sobre. Prueba otra vez.'],
    retry: 'Volver a intentarlo',
    menu: 'Ir a la portada',
  },

  exit: {
    title: '¿Volver a la portada?',
    body: 'Perderás los pliegos de esta salida al campo.',
    stay: 'Seguir jugando',
    leave: 'Volver a la portada',
  },

  creditsBody: [
    ['Observaciones y fotos', 'iNaturalist y su comunidad. Cada foto conserva su autoría y licencia, indicadas en la ficha.'],
    ['Registros de colecciones', 'GBIF.org, red mundial de datos de biodiversidad.'],
    ['Rareza y descripciones', 'Wikipedia: visitas anuales al artículo en inglés y resumen del artículo (CC BY-SA 4.0).'],
    ['Mapa', 'Leaflet (licencia BSD). Costas de Natural Earth (dominio público). Imágenes de satélite: Esri, Vantor, Earthstar Geographics y la comunidad de usuarios GIS.'],
    ['Tipografías', 'IM Fell English (Igino Marini), Alegreya (Huerta Tipográfica) y Courier Prime (Quote-Unquote Apps), con licencia OFL.'],
  ] as [string, string][],
  close: 'Cerrar',

  continents: {
    EUROPE: 'Europa', AFRICA: 'África', NORTH_AMERICA: 'Norteamérica', SOUTH_AMERICA: 'Sudamérica',
    OCEANIA: 'Oceanía', ASIA: 'Asia', ANTARCTICA: 'Antártida',
  } satisfies Record<Continent, string>,
};

export type Strings = typeof es;
export const t: Strings = es;
