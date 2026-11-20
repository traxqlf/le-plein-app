import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { readJSON, writeJSON } from "../lib/storage.ts";

export default function usePersistentState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readJSON<T>(key, initial));
  useEffect(() => writeJSON(key, value), [key, value]);
  return [value, setValue];
}
