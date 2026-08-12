import { Schema, model, Document } from "mongoose";

/**
 * Interface for Counters
 * Backs atomic sequence generation for human-friendly entity IDs
 * (e.g. medicineId "MED-000001", hospitalId "HOS-000001").
 */
export interface ICounter extends Document {
  name: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Counter = model<ICounter>("Counter", counterSchema);
