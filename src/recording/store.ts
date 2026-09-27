import { create } from "zustand";

export type RecStatus = "idle" | "recording" | "paused" | "autopaused";

export interface RecState {
  status: RecStatus;
  rideId: string | null;
  startedAt: number;
  distance: number;
  movingTime: number;
  totalTime: number;
  maxSpeed: number;
  ascent: number;
  descent: number;
  /** display polyline of the current ride ([lon, lat]) */
  track: [number, number][];
}

export const initialRec: RecState = {
  status: "idle",
  rideId: null,
  startedAt: 0,
  distance: 0,
  movingTime: 0,
  totalTime: 0,
  maxSpeed: 0,
  ascent: 0,
  descent: 0,
  track: [],
};

export const useRecording = create<RecState>()(() => ({ ...initialRec }));
