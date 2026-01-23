// Logistics Zoning System for Bogotá and surrounding municipalities
// Zones: NOR (Norte), OCC (Occidente), CEN (Centro), SUR (Sur)

export type ZonaCodigo = "NOR" | "OCC" | "CEN" | "SUR";

export interface ZonaConfig {
  codigo: ZonaCodigo;
  nombre: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const ZONAS: Record<ZonaCodigo, ZonaConfig> = {
  NOR: {
    codigo: "NOR",
    nombre: "Norte",
    color: "#3b82f6", // blue-500
    bgColor: "bg-blue-500",
    textColor: "text-white",
  },
  OCC: {
    codigo: "OCC",
    nombre: "Occidente",
    color: "#8b5cf6", // violet-500
    bgColor: "bg-violet-500",
    textColor: "text-white",
  },
  CEN: {
    codigo: "CEN",
    nombre: "Centro",
    color: "#10b981", // emerald-500
    bgColor: "bg-emerald-500",
    textColor: "text-white",
  },
  SUR: {
    codigo: "SUR",
    nombre: "Sur",
    color: "#f59e0b", // amber-500
    bgColor: "bg-amber-500",
    textColor: "text-white",
  },
};

// Complete neighborhood database organized by locality/municipality
export interface BarrioInfo {
  nombre: string;
  localidad: string;
  zona: ZonaCodigo;
}

// ============================================================
// ZONA NORTE (NOR) - Usaquén, Suba
// ============================================================
const BARRIOS_USAQUEN: BarrioInfo[] = [
  { nombre: "Usaquén Centro", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Santa Bárbara", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Cedritos", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Country Club", localidad: "Usaquén", zona: "NOR" },
  { nombre: "La Carolina", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Toberín", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Barrancas", localidad: "Usaquén", zona: "NOR" },
  { nombre: "San Cristóbal Norte", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Santa Ana", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Bella Suiza", localidad: "Usaquén", zona: "NOR" },
  { nombre: "El Contador", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Lijacá", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Verbenal", localidad: "Usaquén", zona: "NOR" },
  { nombre: "San Antonio Norte", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Tibabita", localidad: "Usaquén", zona: "NOR" },
  { nombre: "La Uribe", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Servitá", localidad: "Usaquén", zona: "NOR" },
  { nombre: "El Cedro", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Bosque de Pinos", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Codito", localidad: "Usaquén", zona: "NOR" },
  { nombre: "La Cita", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Estrella del Norte", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Lisboa", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Santa Teresa", localidad: "Usaquén", zona: "NOR" },
  { nombre: "Unicerros", localidad: "Usaquén", zona: "NOR" },
];

const BARRIOS_SUBA: BarrioInfo[] = [
  { nombre: "Suba Centro", localidad: "Suba", zona: "NOR" },
  { nombre: "Niza", localidad: "Suba", zona: "NOR" },
  { nombre: "Prado Veraniego", localidad: "Suba", zona: "NOR" },
  { nombre: "Ciudad Jardín Norte", localidad: "Suba", zona: "NOR" },
  { nombre: "El Rincón", localidad: "Suba", zona: "NOR" },
  { nombre: "Tibabuyes", localidad: "Suba", zona: "NOR" },
  { nombre: "Casa Blanca Suba", localidad: "Suba", zona: "NOR" },
  { nombre: "La Gaitana", localidad: "Suba", zona: "NOR" },
  { nombre: "Berlín", localidad: "Suba", zona: "NOR" },
  { nombre: "La Campiña", localidad: "Suba", zona: "NOR" },
  { nombre: "Tuna Alta", localidad: "Suba", zona: "NOR" },
  { nombre: "Tuna Baja", localidad: "Suba", zona: "NOR" },
  { nombre: "El Prado", localidad: "Suba", zona: "NOR" },
  { nombre: "Guaymaral", localidad: "Suba", zona: "NOR" },
  { nombre: "La Alhambra", localidad: "Suba", zona: "NOR" },
  { nombre: "La Floresta", localidad: "Suba", zona: "NOR" },
  { nombre: "Santa Cecilia", localidad: "Suba", zona: "NOR" },
  { nombre: "Villa del Prado", localidad: "Suba", zona: "NOR" },
  { nombre: "Britalia", localidad: "Suba", zona: "NOR" },
  { nombre: "Colina Campestre", localidad: "Suba", zona: "NOR" },
  { nombre: "Gilmar", localidad: "Suba", zona: "NOR" },
  { nombre: "Las Villas", localidad: "Suba", zona: "NOR" },
  { nombre: "Mazurén", localidad: "Suba", zona: "NOR" },
  { nombre: "Niza Antigua", localidad: "Suba", zona: "NOR" },
  { nombre: "Niza Norte", localidad: "Suba", zona: "NOR" },
  { nombre: "Niza Sur", localidad: "Suba", zona: "NOR" },
  { nombre: "Pinar de Suba", localidad: "Suba", zona: "NOR" },
  { nombre: "Puente Largo", localidad: "Suba", zona: "NOR" },
  { nombre: "Rincón de Santa Inés", localidad: "Suba", zona: "NOR" },
  { nombre: "Salitre Suba", localidad: "Suba", zona: "NOR" },
  { nombre: "San José de Bavaria", localidad: "Suba", zona: "NOR" },
  { nombre: "Santa Rosa", localidad: "Suba", zona: "NOR" },
  { nombre: "Spring", localidad: "Suba", zona: "NOR" },
  { nombre: "Torreladera", localidad: "Suba", zona: "NOR" },
  { nombre: "Villa Elisa", localidad: "Suba", zona: "NOR" },
  { nombre: "Lombardía", localidad: "Suba", zona: "NOR" },
  { nombre: "Lisboa (Suba)", localidad: "Suba", zona: "NOR" },
  { nombre: "Aures", localidad: "Suba", zona: "NOR" },
  { nombre: "Compartir", localidad: "Suba", zona: "NOR" },
  { nombre: "Costa Azul", localidad: "Suba", zona: "NOR" },
];

// ============================================================
// ZONA CENTRO (CEN) - Chapinero, Teusaquillo, Barrios Unidos, Santa Fe, Los Mártires, Antonio Nariño, Puente Aranda
// ============================================================
const BARRIOS_CHAPINERO: BarrioInfo[] = [
  { nombre: "Chapinero Alto", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Chapinero Central", localidad: "Chapinero", zona: "CEN" },
  { nombre: "El Nogal", localidad: "Chapinero", zona: "CEN" },
  { nombre: "El Chicó", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Rosales", localidad: "Chapinero", zona: "CEN" },
  { nombre: "La Cabrera", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Lago Gaitán", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Quinta Camacho", localidad: "Chapinero", zona: "CEN" },
  { nombre: "El Retiro", localidad: "Chapinero", zona: "CEN" },
  { nombre: "El Refugio", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Antiguo Country", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Chico Norte", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Chicó Reservado", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Emaus", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Granada", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Juan XXIII", localidad: "Chapinero", zona: "CEN" },
  { nombre: "La Porciúncula", localidad: "Chapinero", zona: "CEN" },
  { nombre: "La Salle", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Los Andes", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Marly", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Pardo Rubio", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Seminario", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Sucre", localidad: "Chapinero", zona: "CEN" },
  { nombre: "Virrey", localidad: "Chapinero", zona: "CEN" },
];

const BARRIOS_TEUSAQUILLO: BarrioInfo[] = [
  { nombre: "Teusaquillo Centro", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Galerías", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Palermo", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "La Esmeralda", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "La Soledad", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Armenia", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Acevedo Tejada", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Belalcázar", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "El Campín", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "El Recuerdo", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Nicolás de Federmán", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Pablo VI", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Parque Central Simón Bolívar", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Quirinal", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Rafael Núñez", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Santa Teresita", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Ciudad Salitre Occidental", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Ciudad Salitre Oriental", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Quinta Paredes", localidad: "Teusaquillo", zona: "CEN" },
  { nombre: "Gran América", localidad: "Teusaquillo", zona: "CEN" },
];

const BARRIOS_BARRIOS_UNIDOS: BarrioInfo[] = [
  { nombre: "Doce de Octubre", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Siete de Agosto", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Alcázares", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "San Fernando", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Andes", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Benjamín Herrera", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Colombia", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "El Rosario", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Jorge Eliécer Gaitán", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "José Joaquín Vargas", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "La Castellana", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "La Patria", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "La Paz", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Los Alcázares", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Metrópolis", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Polo Club", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Rafael Uribe", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Rionegro", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "San Miguel", localidad: "Barrios Unidos", zona: "CEN" },
  { nombre: "Santa Sofía", localidad: "Barrios Unidos", zona: "CEN" },
];

const BARRIOS_SANTA_FE: BarrioInfo[] = [
  { nombre: "La Candelaria", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "Las Nieves", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "La Macarena", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "Centro Administrativo", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "El Guavio", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "El Rocío", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "La Capuchina", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "La Perseverancia", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "Las Cruces", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "Lourdes", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "San Bernardo", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "San Martín", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "Veracruz", localidad: "Santa Fe", zona: "CEN" },
  { nombre: "El Sagrado Corazón", localidad: "Santa Fe", zona: "CEN" },
];

const BARRIOS_LOS_MARTIRES: BarrioInfo[] = [
  { nombre: "Santa Isabel", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "El Listón", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "Ricaurte", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "El Progreso", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "La Estanzuela", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "La Favorita", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "La Pepita", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "La Sabana", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "Paloquemao", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "San Victorino", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "Voto Nacional", localidad: "Los Mártires", zona: "CEN" },
  { nombre: "Eduardo Santos", localidad: "Los Mártires", zona: "CEN" },
];

const BARRIOS_ANTONIO_NARINO: BarrioInfo[] = [
  { nombre: "Restrepo", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "Ciudad Jardín Sur", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "La Fragua", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "La Hortúa", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "Policarpa", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "San Antonio (Antonio Nariño)", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "Santander", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "Sevilla", localidad: "Antonio Nariño", zona: "CEN" },
  { nombre: "Villa Mayor", localidad: "Antonio Nariño", zona: "CEN" },
];

const BARRIOS_PUENTE_ARANDA: BarrioInfo[] = [
  { nombre: "Puente Aranda Centro", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Galán", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Muzú", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Alcalá", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Américas", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Andino", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Bavaria", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Centro Industrial", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Ciudad Montes", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Colón", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "El Ejido", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "El Remanso", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Jorge Gaitán Cortés", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "La Camelia", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "La Ponderosa", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "La Trinidad", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Los Comuneros", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Pensilvania", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Pradera", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Salazar Gómez", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "San Gabriel", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "San Rafael Industrial", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Santa Matilde", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Tibana", localidad: "Puente Aranda", zona: "CEN" },
  { nombre: "Veraguas", localidad: "Puente Aranda", zona: "CEN" },
];

// ============================================================
// ZONA OCCIDENTE (OCC) - Engativá, Fontibón, Funza, Madrid, Mosquera
// ============================================================
const BARRIOS_ENGATIVA: BarrioInfo[] = [
  { nombre: "Engativá Centro", localidad: "Engativá", zona: "OCC" },
  { nombre: "Las Ferias", localidad: "Engativá", zona: "OCC" },
  { nombre: "Minuto de Dios", localidad: "Engativá", zona: "OCC" },
  { nombre: "Boyacá Real", localidad: "Engativá", zona: "OCC" },
  { nombre: "Álamos Norte", localidad: "Engativá", zona: "OCC" },
  { nombre: "Santa Helenita", localidad: "Engativá", zona: "OCC" },
  { nombre: "Bolivia", localidad: "Engativá", zona: "OCC" },
  { nombre: "Bonanza", localidad: "Engativá", zona: "OCC" },
  { nombre: "El Dorado", localidad: "Engativá", zona: "OCC" },
  { nombre: "El Encanto", localidad: "Engativá", zona: "OCC" },
  { nombre: "El Laurel", localidad: "Engativá", zona: "OCC" },
  { nombre: "El Muelle", localidad: "Engativá", zona: "OCC" },
  { nombre: "El Real", localidad: "Engativá", zona: "OCC" },
  { nombre: "El Salitre", localidad: "Engativá", zona: "OCC" },
  { nombre: "Engativá Pueblo", localidad: "Engativá", zona: "OCC" },
  { nombre: "Estrada", localidad: "Engativá", zona: "OCC" },
  { nombre: "Ferias Occidente", localidad: "Engativá", zona: "OCC" },
  { nombre: "Florida Blanca", localidad: "Engativá", zona: "OCC" },
  { nombre: "Garcés Navas", localidad: "Engativá", zona: "OCC" },
  { nombre: "Jardín Botánico", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Cabaña", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Clarita", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Estradita", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Faena", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Granja", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Isabela", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Palma", localidad: "Engativá", zona: "OCC" },
  { nombre: "La Serena", localidad: "Engativá", zona: "OCC" },
  { nombre: "Las Palmas (Engativá)", localidad: "Engativá", zona: "OCC" },
  { nombre: "Los Ángeles (Engativá)", localidad: "Engativá", zona: "OCC" },
  { nombre: "Normandía", localidad: "Engativá", zona: "OCC" },
  { nombre: "París Gaitán", localidad: "Engativá", zona: "OCC" },
  { nombre: "Plazuelas del Virrey", localidad: "Engativá", zona: "OCC" },
  { nombre: "Portal de Engativá", localidad: "Engativá", zona: "OCC" },
  { nombre: "Quirigua", localidad: "Engativá", zona: "OCC" },
  { nombre: "San Antonio (Engativá)", localidad: "Engativá", zona: "OCC" },
  { nombre: "San Basilio", localidad: "Engativá", zona: "OCC" },
  { nombre: "San Ignacio", localidad: "Engativá", zona: "OCC" },
  { nombre: "San Marcos", localidad: "Engativá", zona: "OCC" },
  { nombre: "Santa María del Lago", localidad: "Engativá", zona: "OCC" },
  { nombre: "Villa Amalia", localidad: "Engativá", zona: "OCC" },
  { nombre: "Villa del Mar", localidad: "Engativá", zona: "OCC" },
  { nombre: "Villa Gladys", localidad: "Engativá", zona: "OCC" },
  { nombre: "Villas de Granada", localidad: "Engativá", zona: "OCC" },
  { nombre: "Villas de Madrigal", localidad: "Engativá", zona: "OCC" },
  { nombre: "Zarzamora", localidad: "Engativá", zona: "OCC" },
];

const BARRIOS_FONTIBON: BarrioInfo[] = [
  { nombre: "Fontibón Centro", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Modelia", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Hayuelos", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Capellanía", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Aeropuerto El Dorado", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Atahualpa", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Ciudad Salitre", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Cofradía", localidad: "Fontibón", zona: "OCC" },
  { nombre: "El Cuco", localidad: "Fontibón", zona: "OCC" },
  { nombre: "El Refugio (Fontibón)", localidad: "Fontibón", zona: "OCC" },
  { nombre: "El Tintal", localidad: "Fontibón", zona: "OCC" },
  { nombre: "El Vergel", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Fontibón San Pablo", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Granjas de Techo", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Kasandra", localidad: "Fontibón", zona: "OCC" },
  { nombre: "La Cabañita", localidad: "Fontibón", zona: "OCC" },
  { nombre: "La Giralda", localidad: "Fontibón", zona: "OCC" },
  { nombre: "La Laguna", localidad: "Fontibón", zona: "OCC" },
  { nombre: "La Perla", localidad: "Fontibón", zona: "OCC" },
  { nombre: "La Rosita", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Montevideo", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Predio El Salitre", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Sabana Grande", localidad: "Fontibón", zona: "OCC" },
  { nombre: "San José de Fontibón", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Santa Cecilia (Fontibón)", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Veracruz (Fontibón)", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Villemar", localidad: "Fontibón", zona: "OCC" },
  { nombre: "Zona Franca", localidad: "Fontibón", zona: "OCC" },
];

// Municipalities outside Bogotá - OCCIDENTE
const BARRIOS_FUNZA: BarrioInfo[] = [
  { nombre: "Funza Centro", localidad: "Funza", zona: "OCC" },
  { nombre: "El Cortijo (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "El Hato (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "San Sebastián (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "Santa Clara (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "Villa Diana (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "El Porvenir (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "La Florida (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "La Estación (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "Las Mercedes (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "Los Héroes (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "Prados de la Sabana (Funza)", localidad: "Funza", zona: "OCC" },
  { nombre: "Zaragoza (Funza)", localidad: "Funza", zona: "OCC" },
];

const BARRIOS_MADRID: BarrioInfo[] = [
  { nombre: "Madrid Centro", localidad: "Madrid", zona: "OCC" },
  { nombre: "Balcones de Madrid", localidad: "Madrid", zona: "OCC" },
  { nombre: "Bolonia (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "El Sosiego (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "La Magnolia (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "La Virgen (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Las Palmas (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Los Cerezos (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Parque Residencial (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Portal de Madrid", localidad: "Madrid", zona: "OCC" },
  { nombre: "San Francisco (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "San José (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Santa María (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Serrezuela (Madrid)", localidad: "Madrid", zona: "OCC" },
  { nombre: "Villa Mayor (Madrid)", localidad: "Madrid", zona: "OCC" },
];

const BARRIOS_MOSQUERA: BarrioInfo[] = [
  { nombre: "Mosquera Centro", localidad: "Mosquera", zona: "OCC" },
  { nombre: "El Cabrero (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "El Diamante (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "El Lucero (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "El Porvenir (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "El Recreo (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "El Trebol (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "La Estación (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "La Fontana (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "Los Lagos (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "Planadas (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "San Antonio (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "San Francisco (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "San Jorge (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "San José (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "Santa Ana (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "Santa Rosa (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "Serrezuela (Mosquera)", localidad: "Mosquera", zona: "OCC" },
  { nombre: "Villa Nueva (Mosquera)", localidad: "Mosquera", zona: "OCC" },
];

// ============================================================
// ZONA SUR (SUR) - Kennedy, Bosa, Rafael Uribe Uribe, Ciudad Bolívar, Tunjuelito, Usme, San Cristóbal, Soacha
// ============================================================
const BARRIOS_KENNEDY: BarrioInfo[] = [
  { nombre: "Kennedy Central", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Patio Bonito", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Timiza", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Tintalá", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Castilla", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Marsella", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Américas Occidental", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Bavaria Kennedy", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Calandaima", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Carvajal", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Ciudad Kennedy Central", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Ciudad Kennedy Norte", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Ciudad Kennedy Sur", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Corabastos", localidad: "Kennedy", zona: "SUR" },
  { nombre: "El Amparo", localidad: "Kennedy", zona: "SUR" },
  { nombre: "El Japón", localidad: "Kennedy", zona: "SUR" },
  { nombre: "El Paraíso (Kennedy)", localidad: "Kennedy", zona: "SUR" },
  { nombre: "El Tintal Norte", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Hipotecho", localidad: "Kennedy", zona: "SUR" },
  { nombre: "La Igualdad", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Las Américas", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Las Margaritas (Kennedy)", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Mandalay", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Nueva Marsella", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Nueva Timiza", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Nuevo Kennedy", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Osorio", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Pastrana", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Roma", localidad: "Kennedy", zona: "SUR" },
  { nombre: "San Carlos (Kennedy)", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Santa Catalina", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Techo", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Valladolid", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Villa Alsacia", localidad: "Kennedy", zona: "SUR" },
  { nombre: "Villas de Kennedy", localidad: "Kennedy", zona: "SUR" },
];

const BARRIOS_BOSA: BarrioInfo[] = [
  { nombre: "Bosa Centro", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Recreo (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "San José de Bosa", localidad: "Bosa", zona: "SUR" },
  { nombre: "Apogeo", localidad: "Bosa", zona: "SUR" },
  { nombre: "Bosa La Estación", localidad: "Bosa", zona: "SUR" },
  { nombre: "Bosa Santafé", localidad: "Bosa", zona: "SUR" },
  { nombre: "Brasilia (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "Carlos Albán", localidad: "Bosa", zona: "SUR" },
  { nombre: "Carbonell", localidad: "Bosa", zona: "SUR" },
  { nombre: "Cementerio", localidad: "Bosa", zona: "SUR" },
  { nombre: "Chicó Sur", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Anhelo", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Jardín", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Libertador", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Llanito", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Palmar (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Porvenir (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Retazo", localidad: "Bosa", zona: "SUR" },
  { nombre: "El Rincón de Bosa", localidad: "Bosa", zona: "SUR" },
  { nombre: "Escocia", localidad: "Bosa", zona: "SUR" },
  { nombre: "Grancolombiano", localidad: "Bosa", zona: "SUR" },
  { nombre: "Islandia", localidad: "Bosa", zona: "SUR" },
  { nombre: "Jiménez de Quesada", localidad: "Bosa", zona: "SUR" },
  { nombre: "José Antonio Galán", localidad: "Bosa", zona: "SUR" },
  { nombre: "La Amistad", localidad: "Bosa", zona: "SUR" },
  { nombre: "La Esperanza", localidad: "Bosa", zona: "SUR" },
  { nombre: "La Libertad (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "La Independencia (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "La Paz (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "La Veguita", localidad: "Bosa", zona: "SUR" },
  { nombre: "Laureles", localidad: "Bosa", zona: "SUR" },
  { nombre: "Metrovivienda", localidad: "Bosa", zona: "SUR" },
  { nombre: "Nueva Granada", localidad: "Bosa", zona: "SUR" },
  { nombre: "Nueva Roma", localidad: "Bosa", zona: "SUR" },
  { nombre: "Olarte", localidad: "Bosa", zona: "SUR" },
  { nombre: "Palestina (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "Piamonte", localidad: "Bosa", zona: "SUR" },
  { nombre: "San Bernardino", localidad: "Bosa", zona: "SUR" },
  { nombre: "San Diego", localidad: "Bosa", zona: "SUR" },
  { nombre: "San Pablo Bosa", localidad: "Bosa", zona: "SUR" },
  { nombre: "San Pedro", localidad: "Bosa", zona: "SUR" },
  { nombre: "Santa Fé (Bosa)", localidad: "Bosa", zona: "SUR" },
  { nombre: "Villa Suaita", localidad: "Bosa", zona: "SUR" },
];

const BARRIOS_RAFAEL_URIBE_URIBE: BarrioInfo[] = [
  { nombre: "Quiroga", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Marco Fidel Suárez", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Inglés", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Bravo Páez", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Claret", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Country Sur", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Diana Turbay", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "El Pesebre", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Gustavo Restrepo", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "La Paz (Rafael Uribe)", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Lomas", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Marruecos", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Mirador (Rafael Uribe)", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Molinos (Rafael Uribe)", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Olaya", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "San José Sur Oriental", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Santa Lucía Sur Oriental", localidad: "Rafael Uribe Uribe", zona: "SUR" },
  { nombre: "Sosiego Sur", localidad: "Rafael Uribe Uribe", zona: "SUR" },
];

const BARRIOS_CIUDAD_BOLIVAR: BarrioInfo[] = [
  { nombre: "Ciudad Bolívar Centro", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Candelaria La Nueva", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "El Tesoro", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Arborizadora Alta", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Arborizadora Baja", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Arabia", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Bella Flor", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Bogotá Sur", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Caracolí", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Casa de Teja", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Compartir (Ciudad Bolívar)", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Divino Niño", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "El Espino", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "El Lucero", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "El Mochuelo", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "El Perdomo", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Ismael Perdomo", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Jerusalén", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Juan Pablo II", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "La Estancia", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Lucero Alto", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Lucero Bajo", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Meissen", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Monterrey", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Naciones Unidas", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Nutibara", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Paraíso", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Potosí", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "San Fernando (Ciudad Bolívar)", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "San Francisco", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Santa Viviana", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Sierra Morena", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Sotavento", localidad: "Ciudad Bolívar", zona: "SUR" },
  { nombre: "Villas del Progreso", localidad: "Ciudad Bolívar", zona: "SUR" },
];

const BARRIOS_TUNJUELITO: BarrioInfo[] = [
  { nombre: "Tunjuelito Centro", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Venecia", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "San Carlos (Tunjuelito)", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Abraham Lincoln", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Carmen", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "El Tunal", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Fátima (Tunjuelito)", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Isla del Sol", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Muzu", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Rincón de Venecia", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Rincón de Nuevo Muzú", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Salazar Gómez (Tunjuelito)", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "San Benito", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "San Vicente Ferrer", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Samore", localidad: "Tunjuelito", zona: "SUR" },
  { nombre: "Santa Lucía", localidad: "Tunjuelito", zona: "SUR" },
];

const BARRIOS_USME: BarrioInfo[] = [
  { nombre: "Usme Centro", localidad: "Usme", zona: "SUR" },
  { nombre: "Santa Librada", localidad: "Usme", zona: "SUR" },
  { nombre: "La Flora", localidad: "Usme", zona: "SUR" },
  { nombre: "Alfonso López", localidad: "Usme", zona: "SUR" },
  { nombre: "Betania", localidad: "Usme", zona: "SUR" },
  { nombre: "Brazuelos", localidad: "Usme", zona: "SUR" },
  { nombre: "Chuniza", localidad: "Usme", zona: "SUR" },
  { nombre: "Comuneros (Usme)", localidad: "Usme", zona: "SUR" },
  { nombre: "Danubio Azul", localidad: "Usme", zona: "SUR" },
  { nombre: "El Virrey", localidad: "Usme", zona: "SUR" },
  { nombre: "Gran Yomasa", localidad: "Usme", zona: "SUR" },
  { nombre: "La Andrea", localidad: "Usme", zona: "SUR" },
  { nombre: "La Aurora", localidad: "Usme", zona: "SUR" },
  { nombre: "La Fiscala", localidad: "Usme", zona: "SUR" },
  { nombre: "La Marichuela", localidad: "Usme", zona: "SUR" },
  { nombre: "La Reforma", localidad: "Usme", zona: "SUR" },
  { nombre: "Las Violetas", localidad: "Usme", zona: "SUR" },
  { nombre: "Los Arrayanes", localidad: "Usme", zona: "SUR" },
  { nombre: "Los Tejares", localidad: "Usme", zona: "SUR" },
  { nombre: "Monteblanco", localidad: "Usme", zona: "SUR" },
  { nombre: "Nuevo San Andrés de los Altos", localidad: "Usme", zona: "SUR" },
  { nombre: "Nuevo Usme", localidad: "Usme", zona: "SUR" },
  { nombre: "Parque Entrenubes", localidad: "Usme", zona: "SUR" },
  { nombre: "Portal de Usme", localidad: "Usme", zona: "SUR" },
  { nombre: "Puerta al Llano", localidad: "Usme", zona: "SUR" },
  { nombre: "Quintas de Yomasa", localidad: "Usme", zona: "SUR" },
  { nombre: "Regadera", localidad: "Usme", zona: "SUR" },
  { nombre: "San Juan de Usme", localidad: "Usme", zona: "SUR" },
  { nombre: "Tenerife", localidad: "Usme", zona: "SUR" },
  { nombre: "Usminia", localidad: "Usme", zona: "SUR" },
  { nombre: "Valles de Cafam", localidad: "Usme", zona: "SUR" },
  { nombre: "Villa Diana (Usme)", localidad: "Usme", zona: "SUR" },
  { nombre: "Yomasa", localidad: "Usme", zona: "SUR" },
];

const BARRIOS_SAN_CRISTOBAL: BarrioInfo[] = [
  { nombre: "San Cristóbal Centro", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "20 de Julio", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "La Victoria", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Aguas Claras", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Altamira (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Altos del Virrey", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Atenas", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Bellavista", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Buenavista Sur", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Córdoba (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "El Futuro", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "El Pinar (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "El Quindío", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "El Ramajal", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Gran Colombia", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Granada Sur", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Guacamayas", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Juan Rey", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "La Belleza", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "La Gloria (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Las Gaviotas", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Los Alpes", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Los Libertadores (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Moralba", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Nueva Delhi", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Nueva Gloria", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Primero de Mayo", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Ramajal", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Blas", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Cristóbal Norte (Sur)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Isidro Sur", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Luis (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Martín Sur", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Pedro de los Alpes", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Rafael Sur Oriental", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "San Vicente (San Cristóbal)", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Santa Inés Sur", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Santa Rita Sur Oriental", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Sociego", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Sosiego", localidad: "San Cristóbal", zona: "SUR" },
  { nombre: "Vitelma", localidad: "San Cristóbal", zona: "SUR" },
];

// Soacha municipality - ZONA SUR
const BARRIOS_SOACHA: BarrioInfo[] = [
  { nombre: "Soacha Centro", localidad: "Soacha", zona: "SUR" },
  { nombre: "Altos de Cazucá", localidad: "Soacha", zona: "SUR" },
  { nombre: "Altos de la Florida", localidad: "Soacha", zona: "SUR" },
  { nombre: "Bosques de San Carlos", localidad: "Soacha", zona: "SUR" },
  { nombre: "Cazucá", localidad: "Soacha", zona: "SUR" },
  { nombre: "Ciudadela Sucre", localidad: "Soacha", zona: "SUR" },
  { nombre: "Ciudad Latina", localidad: "Soacha", zona: "SUR" },
  { nombre: "Ciudad Verde", localidad: "Soacha", zona: "SUR" },
  { nombre: "Compartir (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "Ducales", localidad: "Soacha", zona: "SUR" },
  { nombre: "El Nogal (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "El Oasis (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "El Porvenir (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "El Progreso (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "El Sol (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "La Despensa (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "La Florida (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "La Isla (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "La María (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "La Veredita", localidad: "Soacha", zona: "SUR" },
  { nombre: "Las Ferias (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "León XIII", localidad: "Soacha", zona: "SUR" },
  { nombre: "Los Cerezos (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "Los Ocales", localidad: "Soacha", zona: "SUR" },
  { nombre: "Los Olivos (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "Maiporé", localidad: "Soacha", zona: "SUR" },
  { nombre: "Nuevo Colón", localidad: "Soacha", zona: "SUR" },
  { nombre: "Olivos (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "Parque Campestre", localidad: "Soacha", zona: "SUR" },
  { nombre: "Portalegre", localidad: "Soacha", zona: "SUR" },
  { nombre: "Potrero Grande", localidad: "Soacha", zona: "SUR" },
  { nombre: "Quintas de la Laguna", localidad: "Soacha", zona: "SUR" },
  { nombre: "San Humberto", localidad: "Soacha", zona: "SUR" },
  { nombre: "San Marcos (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "San Mateo", localidad: "Soacha", zona: "SUR" },
  { nombre: "San Nicolás (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "Santa Ana (Soacha)", localidad: "Soacha", zona: "SUR" },
  { nombre: "Terreros", localidad: "Soacha", zona: "SUR" },
  { nombre: "Villa Italia", localidad: "Soacha", zona: "SUR" },
  { nombre: "Villa Sandra", localidad: "Soacha", zona: "SUR" },
];

// ============================================================
// COMBINED DATABASE
// ============================================================
export const BARRIOS_DATABASE: BarrioInfo[] = [
  // Zona Norte
  ...BARRIOS_USAQUEN,
  ...BARRIOS_SUBA,
  // Zona Centro
  ...BARRIOS_CHAPINERO,
  ...BARRIOS_TEUSAQUILLO,
  ...BARRIOS_BARRIOS_UNIDOS,
  ...BARRIOS_SANTA_FE,
  ...BARRIOS_LOS_MARTIRES,
  ...BARRIOS_ANTONIO_NARINO,
  ...BARRIOS_PUENTE_ARANDA,
  // Zona Occidente
  ...BARRIOS_ENGATIVA,
  ...BARRIOS_FONTIBON,
  ...BARRIOS_FUNZA,
  ...BARRIOS_MADRID,
  ...BARRIOS_MOSQUERA,
  // Zona Sur
  ...BARRIOS_KENNEDY,
  ...BARRIOS_BOSA,
  ...BARRIOS_RAFAEL_URIBE_URIBE,
  ...BARRIOS_CIUDAD_BOLIVAR,
  ...BARRIOS_TUNJUELITO,
  ...BARRIOS_USME,
  ...BARRIOS_SAN_CRISTOBAL,
  ...BARRIOS_SOACHA,
].sort((a, b) => a.nombre.localeCompare(b.nombre));

// Build lookup map for quick zone retrieval
const BARRIO_ZONA_MAP: Record<string, ZonaCodigo> = {};
BARRIOS_DATABASE.forEach((barrio) => {
  BARRIO_ZONA_MAP[barrio.nombre] = barrio.zona;
});

// Get unique localities for filtering
export const LOCALIDADES = [...new Set(BARRIOS_DATABASE.map((b) => b.localidad))].sort();

/**
 * Get all barrios as simple string array (for backward compatibility)
 */
export function getAllBarriosNames(): string[] {
  return BARRIOS_DATABASE.map((b) => b.nombre);
}

/**
 * Get the zone code for a given barrio
 * Returns null if barrio is not found in the mapping
 */
export function getZonaFromBarrio(barrio: string | null | undefined): ZonaCodigo | null {
  if (!barrio) return null;
  return BARRIO_ZONA_MAP[barrio] || null;
}

/**
 * Get the zone code based on municipality
 * Implements automatic zone assignment for supported municipalities
 */
export function getZonaFromMunicipio(municipio: string | null | undefined): ZonaCodigo | null {
  if (!municipio) return null;
  
  const normalizedMunicipio = municipio.toLowerCase().trim();
  
  // Zona Sur - Soacha and southern areas
  if (normalizedMunicipio.includes("soacha") || normalizedMunicipio.includes("sibaté")) {
    return "SUR";
  }
  
  // Zona Norte - Sabana Norte municipalities
  if (
    normalizedMunicipio.includes("chía") ||
    normalizedMunicipio.includes("chia") ||
    normalizedMunicipio.includes("cota") ||
    normalizedMunicipio.includes("cajicá") ||
    normalizedMunicipio.includes("cajica") ||
    normalizedMunicipio.includes("zipaquirá") ||
    normalizedMunicipio.includes("zipaquira")
  ) {
    return "NOR";
  }
  
  // Zona Occidente - Western municipalities
  if (
    normalizedMunicipio.includes("funza") ||
    normalizedMunicipio.includes("madrid") ||
    normalizedMunicipio.includes("mosquera") ||
    normalizedMunicipio.includes("facatativá") ||
    normalizedMunicipio.includes("facatativa")
  ) {
    return "OCC";
  }
  
  // Default for Bogotá - depends on barrio, but default to CEN
  if (normalizedMunicipio.includes("bogotá") || normalizedMunicipio.includes("bogota")) {
    return "CEN"; // Will be overridden by barrio if available
  }
  
  return null;
}

/**
 * Get full barrio info
 */
export function getBarrioInfo(barrio: string): BarrioInfo | null {
  return BARRIOS_DATABASE.find((b) => b.nombre === barrio) || null;
}

/**
 * Get the zone configuration for a given zone code
 */
export function getZonaConfig(zona: ZonaCodigo | null | undefined): ZonaConfig | null {
  if (!zona) return null;
  return ZONAS[zona] || null;
}

/**
 * Get all zone codes as an array
 */
export function getAllZonas(): ZonaCodigo[] {
  return Object.keys(ZONAS) as ZonaCodigo[];
}

/**
 * Search barrios with fuzzy matching
 */
export function searchBarrios(query: string, limit = 10): BarrioInfo[] {
  if (!query.trim()) return [];
  
  const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  return BARRIOS_DATABASE
    .filter((barrio) => {
      const normalizedName = barrio.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedLocalidad = barrio.localidad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalizedName.includes(normalizedQuery) || normalizedLocalidad.includes(normalizedQuery);
    })
    .slice(0, limit);
}
