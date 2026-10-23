/**
 * Genera src/data/demo.json: la partida de muestra que se juega sin conexión (vista previa publicada).
 * Las especies salen de public/data/equilibrado.json (ids, visitas y observaciones reales). La
 * presencia en cada lugar es conocimiento botánico general, no una consulta: por eso la partida
 * se presenta como «de muestra» y no enseña recuentos.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const db = JSON.parse(readFileSync('public/data/equilibrado.json', 'utf8'));
const by = new Map(db.species.map((s) => [s.sci, s]));

const notes = {
  'Prunus spinosa': 'Arbusto espinoso de setos y lindes de Europa. Florece antes de sacar las hojas, y sus frutos, las endrinas, maceradas en anís dan el pacharán.',
  'Drosera rotundifolia': 'Carnívora diminuta de turberas y brezales encharcados. Atrapa insectos con pelos glandulares rematados por una gota pegajosa.',
  'Sassafras albidum': 'Árbol del este de Norteamérica con hojas de tres formas en una misma rama: enteras, con un lóbulo como un mitón o con tres.',
  'Metrosideros excelsa': 'El pōhutukawa, árbol de los acantilados del norte de Nueva Zelanda. Se cubre de flores rojas en diciembre y allí lo llaman árbol de Navidad.',
  'Welwitschia mirabilis': 'Planta del desierto del Namib con solo dos hojas, que crecen durante toda su vida y el viento deshilacha. Hay ejemplares de más de mil años.',
  'Rubus ursinus': 'Zarzamora silvestre de la costa oeste de Norteamérica, de California a la Columbia Británica.',
  'Kalmia latifolia': 'Arbusto de los Apalaches con flores en forma de cuenco. Los estambres van tensados en pliegues y, cuando se posa un insecto, le disparan el polen.',
  'Prunus lusitanica': 'El loro o laurel de Portugal, arbusto de barrancos húmedos de la península ibérica y la Macaronesia, superviviente de la laurisilva terciaria.',
  'Leucospermum cordifolium': 'Protea del fynbos del suroeste de Sudáfrica. Sus inflorescencias parecen acericos llenos de alfileres naranjas.',
  'Araucaria cunninghamii': 'Conífera de las selvas del este de Australia y Nueva Guinea. Supera los 50 metros y su madera se ha explotado mucho.',
  'Juniperus sabina': 'Sabina rastrera de las montañas de Europa y Asia; se extiende pegada al suelo en laderas pedregosas. Es tóxica.',
  'Nymphaea alba': 'Nenúfar de lagos y aguas lentas de Europa, el norte de África y Oriente Próximo.',
  'Betula pubescens': 'Abedul de Europa del norte que llega más lejos que ningún otro árbol de hoja ancha del continente, hasta Islandia y el sur de Groenlandia.',
  'Livistona chinensis': 'Palmera de abanico del sur de Japón, Taiwán y el sur de China. Las puntas de sus hojas cuelgan como flecos.',
  'Sarracenia purpurea': 'Carnívora de turberas de Norteamérica. Sus hojas en forma de jarro acumulan agua de lluvia donde se ahogan los insectos.',
  'Soliva sessilis': 'Hierba diminuta de Sudamérica que se ha hecho común en céspedes de medio mundo. En Nueva Zelanda la llaman onehunga weed, por un barrio de Auckland; sus frutos espinosos se clavan en los pies descalzos.',
  'Pinus aristata': 'Pino de las cumbres de las Rocosas, entre 2.700 y 3.700 metros. Es pariente cercano de Pinus longaeva, el árbol más viejo que se conoce.',
  'Carya ovata': 'Nogal americano de los bosques del este de Norteamérica, con la corteza desprendida en tiras largas. Sus nueces son comestibles.',
  'Ephedra viridis': 'Arbusto de tallos verdes y casi sin hojas de los desiertos del oeste de Estados Unidos.',
  'Quercus palustris': 'Roble de suelos encharcados del este de Estados Unidos, muy plantado en calles por su otoño rojo.',
  'Pinus flexilis': 'Pino de las Rocosas con ramas tan flexibles que se pueden anudar. Aguanta en crestas batidas por el viento.',
  'Caragana arborescens': 'Arbusto leguminoso de Siberia, Mongolia y el norte de China, plantado como cortavientos en praderas frías.',
  'Nepenthes khasiana': 'Planta jarro de las colinas Khasi, en el noreste de la India. Es la única Nepenthes nativa del país y está en peligro.',
  'Pinus banksiana': 'Pino de los bosques boreales de Canadá. Muchas de sus piñas solo se abren con el calor de un incendio.',
  'Quercus acutissima': 'Roble del este de Asia (China, Corea y Japón) con hojas que recuerdan a las del castaño.',
  'Ephedra sinica': 'Arbusto de las estepas del norte de China y Mongolia, fuente histórica de la efedrina.',
  'Cinnamomum verum': 'El canelo de Sri Lanka. La canela es la corteza interior de sus ramas, que se enrolla al secarse.',
};

/** [lugar, país, continente, lat, lng, válidas (sci, nativa), señuelos] */
const rounds = [
  ['Picos de Europa', 'España', 'EUROPE', 43.2, -4.85, [['Prunus spinosa', true], ['Drosera rotundifolia', true]], ['Sassafras albidum', 'Metrosideros excelsa', 'Welwitschia mirabilis', 'Rubus ursinus']],
  ['Montañas Humeantes', 'Estados Unidos', 'NORTH_AMERICA', 35.61, -83.49, [['Kalmia latifolia', true], ['Sassafras albidum', true]], ['Prunus lusitanica', 'Leucospermum cordifolium', 'Araucaria cunninghamii', 'Juniperus sabina']],
  ['Desierto del Namib', 'Namibia', 'AFRICA', -22.55, 15.05, [['Welwitschia mirabilis', true]], ['Kalmia latifolia', 'Nymphaea alba', 'Betula pubescens', 'Livistona chinensis', 'Sarracenia purpurea']],
  ['Auckland', 'Nueva Zelanda', 'OCEANIA', -36.85, 174.76, [['Metrosideros excelsa', true], ['Soliva sessilis', false]], ['Pinus aristata', 'Carya ovata', 'Ephedra viridis', 'Juniperus sabina']],
  ['Kogelberg', 'Sudáfrica', 'AFRICA', -34.33, 18.95, [['Leucospermum cordifolium', true]], ['Quercus palustris', 'Rubus ursinus', 'Pinus flexilis', 'Caragana arborescens', 'Nepenthes khasiana']],
  ['Montañas Rocosas', 'Estados Unidos', 'NORTH_AMERICA', 39.25, -106.2, [['Pinus aristata', true], ['Pinus flexilis', true]], ['Juniperus sabina', 'Araucaria cunninghamii', 'Betula pubescens', 'Cinnamomum verum']],
  ['Brisbane', 'Australia', 'OCEANIA', -27.45, 152.95, [['Araucaria cunninghamii', true]], ['Pinus banksiana', 'Prunus spinosa', 'Quercus acutissima', 'Ephedra sinica', 'Kalmia latifolia']],
];

const card = (sci) => {
  const s = by.get(sci);
  if (!s) throw new Error(`Falta ${sci} en la base`);
  if (!notes[sci]) throw new Error(`Falta la nota de ${sci}`);
  return { ...s, photo: null, note: notes[sci] };
};

const out = rounds.map(([label, country, continent, lat, lng, valid, decoys]) => ({
  label,
  place: { lat, lng, continent, country },
  cards: [...valid.map(([s]) => card(s)), ...decoys.map(card)],
  valid: Object.fromEntries(valid.map(([s, native]) => [by.get(s).taxonId, native])),
}));
writeFileSync('src/data/demo.json', JSON.stringify(out, null, 1));
console.log(`${out.length} rondas de muestra`);
