/**
 * CATEGORY_TREE — Taxonomía jerárquica para clasificación de productos
 * estilo Amazon. Cada llave es una categoría principal y su valor un
 * arreglo de subcategorías.
 */
export const CATEGORY_TREE: Record<string, string[]> = {
  "Salud y Belleza": [
    "Cuidado Facial",
    "Cuidado Capilar",
    "Suplementos y Vitaminas",
    "Equipos de Belleza",
  ],
  "Tecnología y Gadgets": [
    "Smartwatches",
    "Audio",
    "Accesorios Celular",
    "Smart Home",
  ],
  "Hogar y Cocina": [
    "Organización",
    "Electrodomésticos",
    "Utensilios de Cocina",
    "Decoración",
  ],
  "Deportes y Fitness": [
    "Ropa Deportiva",
    "Equipos de Entrenamiento",
    "Suplementación",
    "Accesorios Outdoor",
  ],
  "Mascotas": [
    "Alimentos",
    "Juguetes",
    "Accesorios",
    "Higiene y Cuidado",
  ],
  "Moda y Accesorios": [
    "Ropa Mujer",
    "Ropa Hombre",
    "Calzado",
    "Bolsos y Carteras",
  ],
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_TREE);
