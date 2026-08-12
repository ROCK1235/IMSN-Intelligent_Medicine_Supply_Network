import { Counter } from "../model/counter.model";

/**
 * Atomically increments the named counter and returns a zero-padded,
 * prefixed sequential id, e.g. generateSequentialId("hospital", "HOS")
 * -> "HOS-000001".
 *
 * The increment happens in a single atomic findOneAndUpdate, so it stays
 * correct under concurrent inserts.
 */
export async function generateSequentialId(
  sequenceName: string,
  prefix: string,
  padLength = 6
): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  if (!counter) {
    throw new Error(`Failed to generate sequential id for "${sequenceName}"`);
  }

  return `${prefix}-${String(counter.seq).padStart(padLength, "0")}`;
}
