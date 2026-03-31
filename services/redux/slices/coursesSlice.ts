import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IPELANSection, MoodleModule } from '../../../types/course';

interface CoursesState {
  sections        : IPELANSection[];
  currentSection  : IPELANSection | null;
  currentModule   : MoodleModule | null;
  isLoading       : boolean;
  error           : string | null;
}

const initialState: CoursesState = {
  sections       : [],
  currentSection : null,
  currentModule  : null,
  isLoading      : false,
  error          : null,
};

const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    fetchStart(state) {
      state.isLoading = true;
      state.error     = null;
    },
    fetchSuccess(state, action: PayloadAction<IPELANSection[]>) {
      state.isLoading      = false;
      state.sections       = action.payload;
      state.currentSection = action.payload.find(
        (s) => s.status === 'in_progress',
      ) ?? action.payload[0] ?? null;
    },
    fetchFailure(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error     = action.payload;
    },
    markSectionComplete(state, action: PayloadAction<number>) {
      const section = state.sections.find((s) => s.id === action.payload);
      if (section) {
        section.status   = 'completed';
        section.progress = 100;
      }
    },
  },
});

export const { fetchStart, fetchSuccess, fetchFailure, markSectionComplete } =
  coursesSlice.actions;

export const selectSections       = (s: any) => s.courses.sections;
export const selectCurrentSection = (s: any) => s.courses.currentSection;
export const selectIsLoading      = (s: any) => s.courses.isLoading;

export default coursesSlice.reducer;