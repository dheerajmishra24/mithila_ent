import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// The fabrics a shopper has picked for a swatch kit. Only ids and labels are
// kept; the kit price and the limit come from the server (swatch_settings),
// and the database re-checks both when the kit order is placed.
export interface SwatchPick {
  id: string; // variant id
  title: string;
  color: string;
  image: string;
}

interface SwatchKitState {
  picks: SwatchPick[];
  add: (pick: SwatchPick, max: number) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

export const useSwatchKit = create<SwatchKitState>()(
  persist(
    (set, get) => ({
      picks: [],
      add: (pick, max) => {
        const { picks } = get();
        if (picks.some((p) => p.id === pick.id)) return true;
        if (picks.length >= max) return false;
        set({ picks: [...picks, pick] });
        return true;
      },
      remove: (id) => set((s) => ({ picks: s.picks.filter((p) => p.id !== id) })),
      clear: () => set({ picks: [] }),
    }),
    { name: 'mithila-swatch-kit' }
  )
);
