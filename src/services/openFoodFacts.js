const BASE_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

// Caffeine mg/100ml defaults by OFF category tag
const CATEGORY_CAFFEINE_DEFAULTS = {
  'en:energy-drinks':      32,
  'en:caffeinated-drinks': 32,
  'en:espressos':         212,
  'en:filter-coffees':     50,
  'en:coffees':            60,
  'en:teas':               20,
  'en:black-teas':         25,
  'en:green-teas':         20,
  'en:colas':              10,
  'en:cola':               10,
};

const parseMl = (value) => {
  if (!value) return null;
  const match = String(value).toLowerCase().match(/(\d+(?:[\.,]\d+)?)\s*ml/);
  if (!match) return null;
  return Math.round(parseFloat(match[1].replace(',', '.')));
};

// Try to extract mg of caffeine from ingredients text (usually per serving)
const parseIngredientsForCaffeine = (product) => {
  const text =
    product.ingredients_text ||
    product.ingredients_text_de ||
    product.ingredients_text_en ||
    '';
  if (!text) return null;

  // Match "Koffein (80mg)", "caffeine: 80 mg", "caféine (80mg)" etc.
  const mgMatch = text.match(
    /(?:koffein|caffeine|caféine)[^0-9]*(\d+(?:[.,]\d+)?)\s*mg/i
  );
  if (!mgMatch) return null;

  const caffeinePerServing = parseFloat(mgMatch[1].replace(',', '.'));
  if (!caffeinePerServing) return null;

  // The mg value in ingredients is usually per can / serving — scale to 100 ml
  const servingSizeMl =
    parseMl(product.serving_size) || parseMl(product.quantity);
  if (!servingSizeMl) return null;

  return Math.round((caffeinePerServing / servingSizeMl) * 100);
};

// Rough fallback based on product category
const getCategoryFallback = (product) => {
  const categories = product.categories_tags || [];
  for (const [tag, value] of Object.entries(CATEGORY_CAFFEINE_DEFAULTS)) {
    if (categories.includes(tag)) return value;
  }
  return null;
};

const normalizeCaffeine = (product) => {
  const nutriments = product?.nutriments || {};

  // 1. Direct caffeine per 100 g/ml in nutriments (best case)
  const caffeine100g = nutriments.caffeine_100g;
  if (typeof caffeine100g === 'number' && !Number.isNaN(caffeine100g)) {
    return Math.round(caffeine100g);
  }
  const caffeine = nutriments.caffeine;
  if (typeof caffeine === 'number' && !Number.isNaN(caffeine)) {
    return Math.round(caffeine);
  }

  // 2. Caffeine per serving in nutriments + serving size in ml
  const caffeineServing = nutriments.caffeine_serving;
  if (typeof caffeineServing === 'number' && !Number.isNaN(caffeineServing)) {
    const servingSizeMl = parseMl(product.serving_size);
    if (servingSizeMl) {
      return Math.round((caffeineServing / servingSizeMl) * 100);
    }
  }

  // 3. Parse ingredients text for mg values near "caffeine"
  const fromIngredients = parseIngredientsForCaffeine(product);
  if (fromIngredients !== null) return fromIngredients;

  // 4. Category-based rough default
  return getCategoryFallback(product);
};

export const searchProducts = async (query) => {
  if (!query?.trim()) return [];

  const url = new URL(BASE_URL);
  url.searchParams.set('search_terms', query.trim());
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '10');
  // Request the fields needed for caffeine detection
  url.searchParams.set(
    'fields',
    'id,code,product_name,generic_name,brands,quantity,serving_size,' +
    'nutriments,categories_tags,ingredients_text,ingredients_text_de,ingredients_text_en'
  );

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Fehler beim Abrufen der Daten');
  }

  const data = await response.json();
  const products = Array.isArray(data?.products) ? data.products : [];

  return products.map((product, index) => {
    const quantity = product.quantity || product.serving_size || '';
    const sizeMl = parseMl(quantity) || parseMl(product.serving_size) || parseMl(product.quantity);
    const caffeinePer100ml = normalizeCaffeine(product);

    // Flag estimated values (category fallback) so the UI can indicate uncertainty
    const isCaffeineEstimated =
      caffeinePer100ml !== null &&
      !product.nutriments?.caffeine_100g &&
      !product.nutriments?.caffeine &&
      !product.nutriments?.caffeine_serving &&
      parseIngredientsForCaffeine(product) === null;

    return {
      id: product.id || product._id || product.code || `${index}`,
      name: product.product_name || product.generic_name || 'Unbekanntes Getränk',
      brand: product.brands || '',
      quantity,
      caffeinePer100ml,
      isCaffeineEstimated,
      sizeMl,
    };
  });
};
