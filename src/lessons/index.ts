/** Lesson registry. Order here = order on the home screen and for "Next lesson". */
import type { LessonDef } from '../core/lesson-types';
import { pythagoras } from './pythagoras';

export const LESSONS: LessonDef[] = [pythagoras];

export const findLesson = (id: string): LessonDef | undefined => LESSONS.find((l) => l.meta.id === id);
