import type { FoodCategory } from '@/types';

export type FoodCategoryFilter =
  | 'all'
  | 'mains'
  | 'legumes'
  | 'breads'
  | 'grains'
  | 'snacks'
  | 'quick_bites'
  | 'desserts'
  | 'drinks'
  | 'breakfast'
  | 'dips'
  | 'salads'
  | 'protein'
  | 'fruits'
  | 'nuts_seeds'
  | 'other';

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  curry: 'Main',
  dal: 'Legume',
  bread: 'Bread',
  rice: 'Grain',
  sweet: 'Dessert',
  snack: 'Snack',
  beverage: 'Drink',
  chutney: 'Dip',
  raita: 'Yogurt Side',
  salad: 'Salad',
  breakfast: 'Breakfast',
  street_food: 'Quick Bite',
  non_veg: 'Protein',
  seafood: 'Seafood',
  dry_fruit: 'Nuts & Dried Fruit',
  fruit: 'Fruit',
  other: 'Other',
};

export function getFoodCategoryLabel(category: string): string {
  return FOOD_CATEGORY_LABELS[category as FoodCategory] || category.replace(/_/g, ' ');
}

export const FOOD_FILTER_OPTIONS: Array<{ key: FoodCategoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'mains', label: 'Mains' },
  { key: 'legumes', label: 'Legumes' },
  { key: 'breads', label: 'Breads' },
  { key: 'grains', label: 'Grains' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'quick_bites', label: 'Quick Bites' },
  { key: 'desserts', label: 'Desserts' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'dips', label: 'Dips' },
  { key: 'salads', label: 'Salads' },
  { key: 'protein', label: 'Protein' },
  { key: 'fruits', label: 'Fruits' },
  { key: 'nuts_seeds', label: 'Nuts & Dried Fruit' },
  { key: 'other', label: 'Other' },
];

export const FOOD_FILTER_TO_CATEGORIES: Record<FoodCategoryFilter, FoodCategory[]> = {
  all: [],
  mains: ['curry'],
  legumes: ['dal'],
  breads: ['bread'],
  grains: ['rice'],
  snacks: ['snack'],
  quick_bites: ['street_food'],
  desserts: ['sweet'],
  drinks: ['beverage'],
  breakfast: ['breakfast'],
  dips: ['chutney', 'raita'],
  salads: ['salad'],
  protein: ['non_veg', 'seafood'],
  fruits: ['fruit'],
  nuts_seeds: ['dry_fruit'],
  other: ['other'],
};

export const FOOD_FILTER_SEED_QUERY: Record<Exclude<FoodCategoryFilter, 'all'>, string> = {
  mains: 'prepared meals',
  legumes: 'beans lentils',
  breads: 'bread wraps',
  grains: 'rice grains',
  snacks: 'popular snacks',
  quick_bites: 'quick meals',
  desserts: 'desserts',
  drinks: 'popular drinks',
  breakfast: 'breakfast foods',
  dips: 'dips spreads yogurt',
  salads: 'salads',
  protein: 'protein foods',
  fruits: 'fruits',
  nuts_seeds: 'nuts dried fruit',
  other: 'common foods',
};
