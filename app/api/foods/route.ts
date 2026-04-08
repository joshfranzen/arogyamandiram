// ============================================
// /api/foods - Food Search API
// ============================================
// Cache-first: search MongoDB foods collection by name regex.
// If >= 5 results found → return from MongoDB (no USDA call).
// If < 5 results → fetch from USDA → upsert individual food docs → return.
// This means "paneer" searched once populates ~20 docs; future searches
// for "pan", "paner", "paneer tikka" are all served from MongoDB.

import { NextRequest } from 'next/server';
import type { FoodCategory, FoodItem } from '@/types';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import connectDB from '@/lib/db';
import Food, { type IFoodDocument } from '@/models/Food';
import User from '@/models/User';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: FoodCategory[] = [
  'curry', 'dal', 'bread', 'rice', 'sweet', 'snack', 'beverage', 'chutney',
  'raita', 'salad', 'breakfast', 'street_food', 'non_veg', 'seafood', 'dry_fruit', 'fruit', 'other',
];

const NID_CALORIES = 1008;
const NID_PROTEIN  = 1003;
const NID_CARBS    = 1005;
const NID_FAT      = 1004;
const NID_FIBER    = 1079;

const LIQUID_KEYWORDS = [
  'milk', 'juice', 'water', 'oil', 'drink', 'tea', 'coffee', 'shake',
  'smoothie', 'beer', 'wine', 'broth', 'soup', 'lassi', 'buttermilk',
];

function inferServingUnit(name: string): 'g' | 'ml' {
  const lower = name.toLowerCase();
  return LIQUID_KEYWORDS.some((kw) => lower.includes(kw)) ? 'ml' : 'g';
}

const CATEGORY_KEYWORDS: [FoodCategory, string[]][] = [
  ['curry',      ['paneer', 'curry', 'masala', 'korma', 'tikka', 'butter chicken', 'makhani', 'kofta', 'vindaloo', 'saag', 'palak']],
  ['dal',        ['dal', 'daal', 'lentil', 'chana', 'rajma', 'kadhi', 'sambar']],
  ['bread',      ['roti', 'naan', 'paratha', 'chapati', 'puri', 'bhatura', 'kulcha', 'flatbread']],
  ['rice',       ['rice', 'biryani', 'pulao', 'khichdi', 'pilaf', 'fried rice']],
  ['snack',      ['samosa', 'pakora', 'bhajia', 'vada', 'bhel', 'puri', 'namkeen', 'chips', 'chivda']],
  ['street_food',['pani puri', 'chaat', 'golgappa', 'dabeli', 'vada pav', 'pav bhaji', 'kachori']],
  ['sweet',      ['halwa', 'ladoo', 'barfi', 'kheer', 'gulab jamun', 'jalebi', 'rasgulla', 'mithai', 'dessert', 'sweet']],
  ['beverage',   ['chai', 'tea', 'coffee', 'lassi', 'juice', 'milk', 'shake', 'smoothie', 'water', 'drink', 'nimbu pani']],
  ['breakfast',  ['idli', 'dosa', 'poha', 'upma', 'uttapam', 'paratha', 'oats', 'porridge']],
  ['non_veg',    ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'egg', 'meat', 'keema', 'biryani']],
  ['seafood',    ['fish', 'prawn', 'shrimp', 'crab', 'lobster', 'salmon', 'tuna', 'seafood']],
  ['fruit',      ['apple', 'banana', 'mango', 'orange', 'grape', 'papaya', 'guava', 'watermelon', 'fruit']],
  ['dry_fruit',  ['almond', 'cashew', 'walnut', 'pistachio', 'raisin', 'date', 'fig', 'dry fruit', 'nut']],
  ['salad',      ['salad', 'kachumber', 'raita']],
];

function inferCategory(name: string): FoodCategory {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return 'other';
}

interface UsdaNutrient { nutrientId: number; value?: number; }
interface UsdaFood {
  fdcId: number;
  description: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: UsdaNutrient[];
}
interface UsdaPortion {
  amount?: number;
  modifier?: string;
  gramWeight?: number;
  sequenceNumber?: number;
}
interface UsdaFullFood {
  fdcId: number;
  foodPortions?: UsdaPortion[];
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

function getNutrient(nutrients: UsdaNutrient[], id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

async function resolveApiKey(userId: string): Promise<string> {
  try {
    const user = await User.findById(userId).select('+apiKeys.fdcApiKey').lean();
    const stored = (user?.apiKeys as { fdcApiKey?: string } | undefined)?.fdcApiKey;
    if (stored) return decrypt(stored);
  } catch { /* fall through */ }
  return process.env.FDC_API_KEY || '';
}

// Fallback measures for common countable whole foods when USDA portions are missing
const COUNTABLE_FOOD_DEFAULTS: { keywords: string[]; measures: { label: string; grams: number }[] }[] = [
  { keywords: ['egg'],                  measures: [{ label: '1 egg', grams: 50 }] },
  { keywords: ['roti', 'chapati'],      measures: [{ label: '1 roti', grams: 40 }] },
  { keywords: ['paratha'],              measures: [{ label: '1 paratha', grams: 80 }] },
  { keywords: ['idli'],                 measures: [{ label: '1 idli', grams: 40 }] },
  { keywords: ['dosa'],                 measures: [{ label: '1 dosa', grams: 80 }] },
  { keywords: ['banana'],               measures: [{ label: '1 banana', grams: 120 }] },
  { keywords: ['apple'],                measures: [{ label: '1 apple', grams: 182 }] },
  { keywords: ['bread', 'slice'],       measures: [{ label: '1 slice', grams: 28 }] },
];

/** Build natural serving measures from USDA portion data + branded serving info. */
function buildMeasures(
  full: UsdaFullFood | undefined,
  baseUnit: 'g' | 'ml',
  foodName?: string
): { label: string; grams: number }[] {
  const measures: { label: string; grams: number }[] = [];

  // From foodPortions (SR Legacy / Foundation foods)
  const portions = full?.foodPortions ?? [];
  const sorted = [...portions].sort((a, b) => (a.sequenceNumber ?? 99) - (b.sequenceNumber ?? 99));
  for (const p of sorted) {
    if (!p.modifier || !p.gramWeight || p.gramWeight <= 0) continue;
    // Skip portions where modifier is purely numeric (USDA internal IDs)
    if (/^\d+$/.test(String(p.modifier).trim())) continue;
    const amount = p.amount ?? 1;
    const label = amount === 1 ? p.modifier : `${amount} ${p.modifier}`;
    measures.push({ label: label.trim(), grams: Math.round(p.gramWeight) });
  }

  // Fallback for countable whole foods when USDA returns no portions
  if (measures.length === 0 && foodName) {
    const lower = foodName.toLowerCase();
    for (const entry of COUNTABLE_FOOD_DEFAULTS) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        measures.push(...entry.measures);
        break;
      }
    }
  }

  // From branded food servingSize (Branded data type has no foodPortions)
  if (measures.length === 0 && full?.servingSize && full.servingSize > 0) {
    const unit = (full.servingSizeUnit || '').toLowerCase();
    let grams: number | undefined;
    if (unit === 'g' || unit === 'ml') grams = Math.round(full.servingSize);
    else if (unit === 'oz')             grams = Math.round(full.servingSize * 28.35);
    if (grams) {
      const label = full.householdServingFullText?.trim() || `1 serving`;
      measures.push({ label, grams });
    }
  }

  // Always include 100g/100ml as the last fallback option
  const baseLabel = `100${baseUnit}`;
  if (!measures.some((m) => m.label === baseLabel)) {
    measures.push({ label: baseLabel, grams: 100 });
  }

  return measures;
}

/** Patch cached docs that have empty measures with countable-food defaults. */
function patchMeasures(doc: { name: string; servingUnit: string; measures: { label: string; grams: number }[] }): { label: string; grams: number }[] {
  const hasMeaningful = (doc.measures ?? []).some((m) => !m.label.startsWith('100'));
  if (hasMeaningful) return doc.measures ?? [];

  const lower = doc.name.toLowerCase();
  for (const entry of COUNTABLE_FOOD_DEFAULTS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      const baseLabel = `100${doc.servingUnit}`;
      const withBase = [...entry.measures];
      if (!withBase.some((m) => m.label === baseLabel)) withBase.push({ label: baseLabel, grams: 100 });
      return withBase;
    }
  }
  return doc.measures ?? [];
}

function toFoodItem(doc: {
  foodId: string; name: string; category: string; servingSize: number; servingUnit: string;
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
  isVegetarian: boolean; isVegan: boolean; tags: string[];
  measures: { label: string; grams: number }[];
}): FoodItem {
  return {
    id: doc.foodId,
    name: doc.name,
    category: doc.category as FoodCategory,
    servingSize: doc.servingSize,
    servingUnit: doc.servingUnit,
    calories: doc.calories,
    protein: doc.protein,
    carbs: doc.carbs,
    fat: doc.fat,
    fiber: doc.fiber,
    isVegetarian: doc.isVegetarian,
    isVegan: doc.isVegan,
    tags: doc.tags,
    measures: patchMeasures(doc),
  } as FoodItem;
}

async function fetchAndCacheFromUsda(
  usdaQuery: string,
  categoryOverride: FoodCategory | '',
  apiKey: string
): Promise<FoodItem[]> {
  // Step 1: search
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', usdaQuery);
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Branded');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) {
    console.error(`[USDA] ${res.status} for query: ${usdaQuery}`);
    return [];
  }

  const data = await res.json() as { foods?: UsdaFood[] };
  const usdaFoods = data.foods ?? [];
  if (usdaFoods.length === 0) return [];

  // Step 2: batch-fetch full details to get foodPortions (natural serving sizes)
  const fdcIds = usdaFoods.map((f) => f.fdcId);
  let fullFoodsMap = new Map<number, UsdaFullFood>();
  try {
    const batchRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods?api_key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fdcIds, format: 'full' }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (batchRes.ok) {
      const full = await batchRes.json() as UsdaFullFood[];
      if (Array.isArray(full)) {
        fullFoodsMap = new Map(full.map((f) => [f.fdcId, f]));
      }
    }
  } catch (err) {
    console.warn('[USDA] batch portions fetch failed (non-fatal):', err);
  }

  const ttlDays = parseInt(process.env.FOOD_CACHE_TTL_DAYS || '30', 10);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const mapped: FoodItem[] = [];

  const upsertOps = usdaFoods.map((f) => {
    const name = f.brandName ? `${f.description} (${f.brandName})` : f.description;
    const category = categoryOverride || inferCategory(name);
    const baseUnit = inferServingUnit(f.description);
    const measures = buildMeasures(fullFoodsMap.get(f.fdcId), baseUnit, name);

    const doc = {
      foodId:      `fdc_${f.fdcId}`,
      name,
      nameLower:   name.toLowerCase(),
      category,
      servingSize: 100,
      servingUnit: baseUnit,
      calories:    Math.round(getNutrient(f.foodNutrients, NID_CALORIES)),
      protein:     Math.round(getNutrient(f.foodNutrients, NID_PROTEIN) * 10) / 10,
      carbs:       Math.round(getNutrient(f.foodNutrients, NID_CARBS)   * 10) / 10,
      fat:         Math.round(getNutrient(f.foodNutrients, NID_FAT)     * 10) / 10,
      fiber:       Math.round(getNutrient(f.foodNutrients, NID_FIBER)   * 10) / 10,
      isVegetarian:false,
      isVegan:     false,
      tags:        ['usda', 'fdc'],
      source:      'usda',
      expiresAt,
      measures,
    };
    mapped.push(toFoodItem(doc));
    return {
      updateOne: {
        filter: { foodId: doc.foodId },
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  if (upsertOps.length > 0) {
    try {
      await Food.bulkWrite(upsertOps, { ordered: false });
    } catch (err) {
      console.error('[FoodCache] bulkWrite error (non-fatal):', err);
    }
  }

  return mapped;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const { searchParams } = new URL(req.url);
    const query    = (searchParams.get('q') || '').trim();
    const category = (searchParams.get('category') || '').trim();
    const cacheCategory = VALID_CATEGORIES.includes(category as FoodCategory)
      ? (category as FoodCategory)
      : ('' as const);

    await connectDB();

    // Case 1: text query present
    if (query.length >= 3) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      // Search MongoDB first
      const cached = await Food.find({ nameLower: regex }).limit(20).lean<IFoodDocument[]>();
      if (cached.length >= 5) {
        const foods = cached.map(toFoodItem);
        return maskedResponse({ foods, edamamFoods: [], total: foods.length });
      }

      // Not enough cached — call USDA
      const apiKey = await resolveApiKey(String(userId));
      if (!apiKey) {
        const foods = cached.map(toFoodItem);
        return maskedResponse({ foods, edamamFoods: [], total: foods.length });
      }

      const fresh = await fetchAndCacheFromUsda(query, cacheCategory, apiKey);
      const cachedIds = new Set(cached.map((c) => c.foodId));
      const merged = [...cached.map(toFoodItem), ...fresh.filter((f) => !cachedIds.has(f.id))];
      return maskedResponse({ foods: merged, edamamFoods: [], total: merged.length });
    }

    // Case 2: query < 3 chars — category browse or default
    if (cacheCategory) {
      const cached = await Food.find({ category: cacheCategory }).limit(40).lean<IFoodDocument[]>();
      if (cached.length >= 5) {
        const foods = cached.map(toFoodItem);
        return maskedResponse({ foods, edamamFoods: [], total: foods.length });
      }
      const apiKey = await resolveApiKey(String(userId));
      if (!apiKey) return maskedResponse({ foods: [], edamamFoods: [], total: 0 });
      const foods = await fetchAndCacheFromUsda(cacheCategory, cacheCategory, apiKey);
      return maskedResponse({ foods, edamamFoods: [], total: foods.length });
    }

    // Case 3: empty query, no category — default "All" view
    const cached = await Food.find({}).limit(20).lean<IFoodDocument[]>();
    if (cached.length >= 5) {
      const foods = cached.map(toFoodItem);
      return maskedResponse({ foods, edamamFoods: [], total: foods.length });
    }
    const apiKey = await resolveApiKey(String(userId));
    if (!apiKey) return maskedResponse({ foods: [], edamamFoods: [], total: 0 });
    const foods = await fetchAndCacheFromUsda('indian food', '', apiKey);
    return maskedResponse({ foods, edamamFoods: [], total: foods.length });

  } catch (err) {
    console.error('[Food Search Error]:', err);
    return errorResponse('Failed to search foods', 500);
  }
}
