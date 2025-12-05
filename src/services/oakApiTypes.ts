/**
 * TypeScript interfaces for Oak National Academy API responses
 */

/**
 * Represents a Key Stage in the UK education system
 */
export interface KeyStage {
  slug: string;
  title: string;
  shortCode: string;
}

/**
 * Represents a subject within a key stage
 */
export interface Subject {
  slug: string;
  title: string;
  keyStageSlug: string;
  keyStageTitle: string;
}

/**
 * Represents a unit within a subject
 */
export interface Unit {
  slug: string;
  title: string;
  description?: string;
  keyStageSlug: string;
  subjectSlug: string;
  yearSlug?: string;
  lessonCount: number;
  order?: number;
}

/**
 * Represents a lesson within a unit
 */
export interface Lesson {
  slug: string;
  title: string;
  description?: string;
  unitSlug: string;
  order?: number;
  pupilLessonOutcome?: string;
  keyStageSlug: string;
  subjectSlug: string;
  hasVideo: boolean;
  hasQuiz: boolean;
  hasWorksheet: boolean;
}

/**
 * Represents detailed lesson information
 */
export interface LessonDetails extends Lesson {
  starterQuiz?: Quiz[];
  video?: Video;
  exitQuiz?: Quiz[];
  worksheetUrl?: string;
  transcriptSentences?: TranscriptSentence[];
  misconceptions?: string[];
  keywords?: Keyword[];
  equipment?: string[];
  contentGuidance?: string[];
}

/**
 * Represents a video resource
 */
export interface Video {
  title: string;
  videoMuxPlaybackId?: string;
  signedVideoMuxPlaybackId?: string;
  signedVideoDuration?: number;
  videoThumbUrl?: string;
  duration?: number;
}

/**
 * Represents a quiz answer option (from Oak API)
 */
export interface QuizAnswer {
  type: string;
  content: string;
  distractor: boolean;
  order?: number;
  matchOption?: { type: string; content: string };
  correctChoice?: { type: string; content: string };
}

/**
 * Represents a quiz question (from Oak API)
 */
export interface QuizQuestion {
  question: string;
  questionType: 'multiple-choice' | 'order' | 'match' | 'short-answer' | 'explanatory-text';
  answers: QuizAnswer[];
}

/**
 * Represents the quiz data for a lesson
 */
export interface LessonQuiz {
  starterQuiz: QuizQuestion[];
  exitQuiz: QuizQuestion[];
}

/**
 * @deprecated Use QuizQuestion instead
 */
export interface Quiz {
  question: string;
  answers: { answer: string; correct: boolean }[];
  hint?: string;
}

/**
 * Represents a transcript sentence for video captions
 */
export interface TranscriptSentence {
  start: number;
  end: number;
  text: string;
}

/**
 * Represents a keyword definition
 */
export interface Keyword {
  term: string;
  definition: string;
}

/**
 * Search filters for lessons
 */
export interface SearchFilters {
  keyStage?: string;
  subjectSlug?: string;
  yearSlug?: string;
  page?: number;
  limit?: number;
}

/**
 * Paginated search results
 */
export interface SearchResults<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Oak API Error Response
 */
export interface OakApiError {
  message: string;
  statusCode: number;
  error?: string;
}
