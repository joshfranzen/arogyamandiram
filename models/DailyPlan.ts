// ============================================
// DailyPlan Model - MongoDB/Mongoose
// ============================================
// Stores the AI-generated daily health plan for each user.
// Plans are generated nightly by cron at 11:55 PM.
// Unique index: { userId, date }

import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IDailyPlanDocument extends Document {
  userId: Types.ObjectId;
  date: string; // 'YYYY-MM-DD' — the day this plan is FOR
  generatedAt: Date;
  status: 'generating' | 'ready' | 'failed';
  errorMessage?: string;

  topInsight?: string; // AI-selected #1 priority for the day

  foodPlan?: {
    suggestions: {
      name: string;
      description: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      ingredients: string[];
      isVegetarian: boolean;
    }[];
    reasoning?: string;
  };

  workoutPlan?: {
    name: string;
    description: string;
    progressionTip?: string;
    exercises: {
      name: string;
      steps?: string[];
      sets: number;
      reps: string;
      durationMinutes?: number;
      restSeconds: number;
      intensity?: 'low' | 'medium' | 'high';
      category?: string;
    }[];
    estimatedCalories: number;
    durationMinutes: number;
    reasoning?: string;
  };

  prediction?: {
    weeklyWeightChangeKg: number;
    projectedWeightKg: number;
    basis: string;
  };

  fitnessLevelDerived?: string;

  feedback?: {
    workoutDifficulty?: 'too_easy' | 'just_right' | 'too_hard';
    skippedWorkoutReason?: 'no_time' | 'tired' | 'injury' | 'other';
    dislikedFoods?: string[];
    replacedMeals?: { original: string; replacement: string }[];
    submittedAt?: Date;
  };

  generationContext?: {
    yesterdayProteinG?: number;
    proteinGapG?: number;
    yesterdayCalories?: number;
    calorieGap?: number;
    recentWorkoutsPerWeek?: number;
    avgWorkoutDurationMin?: number;
  };

}

const MealSuggestionSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], default: 'snack' },
    ingredients: { type: [String], default: [] },
    isVegetarian: { type: Boolean, default: false },
  },
  { _id: false }
);

const ExerciseSchema = new Schema(
  {
    name: { type: String, required: true },
    steps: { type: [String], default: undefined },
    sets: { type: Number, default: 1 },
    reps: { type: String, default: '1' },
    durationMinutes: { type: Number },
    restSeconds: { type: Number, default: 60 },
    intensity: { type: String, enum: ['low', 'medium', 'high'] },
    category: { type: String },
  },
  { _id: false }
);

const DailyPlanSchema = new Schema<IDailyPlanDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    generatedAt: { type: Date, default: () => new Date() },
    status: { type: String, enum: ['generating', 'ready', 'failed'], default: 'generating' },
    errorMessage: { type: String },

    topInsight: { type: String },

    foodPlan: {
      suggestions: { type: [MealSuggestionSchema], default: [] },
      reasoning: { type: String },
    },

    workoutPlan: {
      name: { type: String },
      description: { type: String },
      progressionTip: { type: String },
      exercises: { type: [ExerciseSchema], default: [] },
      estimatedCalories: { type: Number, default: 0 },
      durationMinutes: { type: Number, default: 0 },
      reasoning: { type: String },
    },

    prediction: {
      weeklyWeightChangeKg: { type: Number },
      projectedWeightKg: { type: Number },
      basis: { type: String },
    },

    fitnessLevelDerived: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },

    feedback: {
      workoutDifficulty: { type: String, enum: ['too_easy', 'just_right', 'too_hard'] },
      skippedWorkoutReason: { type: String, enum: ['no_time', 'tired', 'injury', 'other'] },
      dislikedFoods: { type: [String], default: [] },
      replacedMeals: {
        type: [
          {
            original: { type: String, required: true },
            replacement: { type: String, required: true },
          },
        ],
        default: [],
      },
      submittedAt: { type: Date },
    },

    generationContext: {
      yesterdayProteinG: { type: Number },
      proteinGapG: { type: Number },
      yesterdayCalories: { type: Number },
      calorieGap: { type: Number },
      recentWorkoutsPerWeek: { type: Number },
      avgWorkoutDurationMin: { type: Number },
    },

  },
  {
    timestamps: true,
  }
);

// Compound unique index: one plan per user per day
DailyPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

const DailyPlan: Model<IDailyPlanDocument> =
  mongoose.models.DailyPlan ||
  mongoose.model<IDailyPlanDocument>('DailyPlan', DailyPlanSchema);

export default DailyPlan;
