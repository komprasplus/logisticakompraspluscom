/**
 * CATEGORY_TREE — Taxonomía jerárquica para clasificación de productos
 * estilo Amazon. Cada llave es una categoría principal y su valor un
 * arreglo de subcategorías.
 */
export const CATEGORY_TREE: Record<string, string[]> = {
  "Herramientas y Ferretería": [
    "Manuales",
    "Eléctricas",
    "Jardinería",
    "Accesorios de Taller",
    "Iluminación de Trabajo",
  ],
  "Hogar y Decoración": [
    "Organización",
    "Cocina",
    "Dormitorio",
    "Decoración de Interiores",
    "Baño",
  ],
  "Tecnología y Gadgets": [
    "Audio y Parlantes",
    "Accesorios para Celular",
    "Smartwatches",
    "Periféricos de PC",
    "Iluminación LED",
  ],
  "Belleza y Cuidado Personal": [
    "Cuidado Facial (Skincare)",
    "Cuidado Capilar",
    "Maquillaje",
    "Barbería y Afeitado",
  ],
  "Salud y Bienestar": [
    "Masajeadores",
    "Cuidado Postural",
    "Suplementos (Wellness)",
    "Termómetros/Salud Digital",
  ],
  "Deportes y Fitness": [
    "Accesorios de Gimnasio",
    "Ropa Deportiva",
    "Ciclismo",
    "Outdoor/Camping",
  ],
  "Mascotas": [
    "Juguetes",
    "Higiene",
    "Accesorios de Paseo",
    "Camas/Descanso",
  ],
  "Juguetería y Bebés": [
    "Educativos",
    "Ropa para Bebé",
    "Accesorios de Maternidad",
    "Juegos de Mesa",
  ],
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_TREE);
