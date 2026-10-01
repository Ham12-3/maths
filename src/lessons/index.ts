/** Lesson registry. Order here = order on the home screen and for "Next lesson". */
import type { LessonDef } from '../core/lesson-types';
import { linear } from './linear';
import { pythagoras } from './pythagoras';
import { quadratics } from './quadratics';
import { trig } from './trig';

export const LESSONS: LessonDef[] = [pythagoras, linear, quadratics, trig];

export const findLesson = (id: string): LessonDef | undefined => LESSONS.find((l) => l.meta.id === id);
