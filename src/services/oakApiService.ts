import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import https from 'https';
import { Readable } from 'stream';
import config from '../config';
import {
  KeyStage,
  Lesson,
  Video,
  LessonQuiz,
  SearchFilters,
  SearchResults,
  OakApiError,
} from './oakApiTypes';
import redisClient from '../config/redis'; // Direct import of the Redis client
import { BLOCKED_UNIT_SLUGS, BLOCKED_LESSON_SLUGS } from '../config/oakBlockedUnits'; // Static hardcoded blocklist
import { OakApiRequestError } from './oakApiErrors';

/**
 * Cache Time-To-Live (TTL) values in seconds
 */
const CACHE_TTL = {
  KEY_STAGES: 24 * 60 * 60, // 24 hours
  SUBJECTS: 24 * 60 * 60, // 24 hours
  UNITS: 12 * 60 * 60, // 12 hours
  LESSONS: 24 * 60 * 60, // 24 hours
  LESSON_DETAILS: 24 * 60 * 60, // 24 hours
  SEARCH: 6 * 60 * 60, // 6 hours
};

/**
 * Oak National Academy's API has no published/versioned schema, and its JSON
 * shape varies significantly across endpoints and content types (units vs.
 * unitOptions vs. examSubject tiers, etc.) - modeling it exactly here would
 * mean reverse-engineering and locking to their internal representation, so
 * it's handled as an open record instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OakJson = Record<string, any>;

/**
 * Interface for Redis client dependency
 */
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
}

/**
 * Unwrap Oak API response structure
 * Oak API returns { data: [...] } but we need just [...]
 */
function unwrap<T>(response: unknown): T {
  // Check if response has a 'data' property
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  // Otherwise return the response as-is
  return response as T;
}

/**
 * Handle API errors and transform them into a consistent format
 */
function handleApiError(error: unknown): never {
  // Add debugging log to see what exactly is blowing up
  console.error('[OakAPI] handleApiError caught:', error instanceof Error ? error.message : error);

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<OakApiError>;

    if (axiosError.response) {
      const statusCode = axiosError.response.status;
      const message =
        axiosError.response.data?.message || axiosError.message || 'Oak API request failed';

      throw new OakApiRequestError({
        message,
        statusCode,
        error: axiosError.response.data?.error,
      });
    }

    throw new OakApiRequestError({
      message: axiosError.message || 'Network error',
      statusCode: 500,
    });
  }

  throw new OakApiRequestError({
    message: error instanceof Error ? error.message : 'Unknown error',
    statusCode: 500,
  });
}

/**
 * Oak National Academy API Service
 * Provides methods to interact with the Oak API with Redis caching
 */
export class OakApiService {
  private axiosInstance: AxiosInstance;

  private redis: RedisClientInterface;

  private rateLimitRemaining: number;

  private rateLimitReset: Date | null;

  constructor(redisClientParam?: RedisClientInterface, axiosInstance?: AxiosInstance) {
    this.redis = redisClientParam || redisClient; // Use the directly imported redisClient
    this.axiosInstance =
      axiosInstance ||
      axios.create({
        baseURL: config.oak.apiBaseUrl,
        headers: {
          'Content-Type': 'application/json',
          ...(config.oak.apiKey && { Authorization: `Bearer ${config.oak.apiKey}` }),
        },
        timeout: 30000, // 30 seconds
      });

    this.rateLimitRemaining = config.oak.rateLimit;
    this.rateLimitReset = null;

    // Add response interceptor to track rate limits
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Update rate limit info from response headers if available
        const remaining = response.headers['x-ratelimit-remaining'];
        const reset = response.headers['x-ratelimit-reset'];

        if (remaining) {
          this.rateLimitRemaining = parseInt(remaining, 10);
        }
        if (reset) {
          this.rateLimitReset = new Date(parseInt(reset, 10) * 1000);
        }

        return response;
      },
      async (error) => {
        if (error.response?.status === 429) {
          this.rateLimitRemaining = 0;
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            this.rateLimitReset = new Date(Date.now() + parseInt(retryAfter, 10) * 1000);
          }
        }

        // --- RETRY LOGIC FOR TIMEOUTS & SERVER ERRORS ---
        const requestConfig = error.config as
          | (AxiosRequestConfig & { retryCount?: number })
          | undefined;
        if (requestConfig) {
          if (!requestConfig.retryCount) {
            requestConfig.retryCount = 0;
          }

          const maxRetries = 2;
          const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
          const isServerError = error.response && error.response.status >= 500;
          const isRateLimit = error.response?.status === 429;

          if (
            (isTimeout || isServerError || isRateLimit) &&
            requestConfig.retryCount < maxRetries
          ) {
            requestConfig.retryCount += 1;
            console.warn(
              `[OakAPI] Request failed (${error.message}). Retrying (${requestConfig.retryCount}/${maxRetries})...`,
            );

            // Exponential backoff
            const delay = isRateLimit ? 5000 : 1000 * 2 ** requestConfig.retryCount;

            await new Promise<void>((resolve) => {
              setTimeout(resolve, delay);
            });
            return this.axiosInstance(requestConfig);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Generic method to get data from cache or API
   */
  private async getCached<T>(
    cacheKey: string,
    ttl: number,
    fetchFn: () => Promise<T>,
    skipCache = false,
  ): Promise<T> {
    // Try to get from cache first (unless skipping cache)
    if (!skipCache) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          // RELIABILITY FIX: Wrap JSON.parse in try-catch to handle corrupted cache
          try {
            console.log(`[OakAPI Cache] HIT for key: ${cacheKey}`);
            return JSON.parse(cached) as T;
          } catch (parseError) {
            console.error(
              `[OakAPI Cache] Parse error for key ${cacheKey}, clearing corrupted cache:`,
              parseError,
            );
            // Delete corrupted cache entry and fall through to fetch fresh data
            try {
              await this.redis.del(cacheKey);
            } catch (delError) {
              console.error(
                `[OakAPI Cache] Failed to delete corrupted cache key ${cacheKey}:`,
                delError,
              );
            }
          }
        } else {
          console.log(`[OakAPI Cache] MISS for key: ${cacheKey}`);
        }
      } catch (error) {
        console.error(`[OakAPI Cache] Get error for key ${cacheKey}:`, error);
        // Continue to fetch from API if cache fails
      }
    }

    // Fetch from API
    const data = await fetchFn();

    // Store in cache (don't cache if TTL is 0)
    if (ttl > 0) {
      try {
        await this.redis.setEx(cacheKey, ttl, JSON.stringify(data));
      } catch (error) {
        console.error(`Cache set error for key ${cacheKey}:`, error);
        // Continue anyway, just log the error
      }
    }

    return data;
  }

  /**
   * Check rate limit before making requests
   * Automatically resets if the reset time has passed
   */
  private checkRateLimit(): void {
    // If we have a reset time and it has passed, reset the counter
    if (this.rateLimitReset && new Date() >= this.rateLimitReset) {
      this.rateLimitRemaining = config.oak.rateLimit;
      this.rateLimitReset = null;
    }

    if (this.rateLimitRemaining <= 0) {
      const resetTime = this.rateLimitReset?.toISOString() || 'unknown';
      throw new OakApiRequestError({
        message: `Rate limit exceeded. Resets at ${resetTime}`,
        statusCode: 429,
      });
    }
  }

  /**
   * Get all available key stages
   */
  async getKeyStages(): Promise<KeyStage[]> {
    const cacheKey = 'oak:keystages';

    return this.getCached(cacheKey, CACHE_TTL.KEY_STAGES, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>('/key-stages');
        // Unwrap Oak API response: { data: [...] } -> [...]
        return unwrap<KeyStage[]>(response.data);
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Get subjects by key stage
   * Note: Oak API doesn't have a direct endpoint for subjects by key stage
   * We fetch all subjects and filter by key stage
   */
  async getSubjectsByKeyStage(keyStage: string): Promise<OakJson[]> {
    const cacheKey = `oak:keystage:${keyStage}:subjects`;

    return this.getCached(cacheKey, CACHE_TTL.SUBJECTS, async () => {
      this.checkRateLimit();

      try {
        // Get all subjects from the Oak API
        const response = await this.axiosInstance.get<OakJson>('/subjects');
        const allSubjects = unwrap<OakJson[]>(response.data);

        // RELIABILITY FIX: Validate array before operations
        if (!allSubjects || !Array.isArray(allSubjects)) {
          console.warn('Expected array from subjects API, got:', typeof allSubjects);
          return [];
        }

        // Oak API now returns an array of strings for /subjects
        const slugs = allSubjects
          .map((s: OakJson | string) => (typeof s === 'string' ? s : s.subjectSlug))
          .filter(Boolean);

        // Fetch detailed data for each subject to get keyStages mapping
        // Use Promise.all with concurrency limit or just map since the list is small (~20)
        const detailedResponses = await Promise.all(
          slugs.map((slug: string) =>
            this.axiosInstance.get<OakJson>(`/subjects/${slug}`).catch(() => null),
          ),
        );

        const detailedSubjects = detailedResponses
          .filter((res) => res && res.data)
          .map((res) => unwrap<OakJson>(res!.data));

        // Filter subjects that have the requested key stage in any of their sequences
        const filteredSubjects = detailedSubjects
          .filter((subject) => {
            if (!subject.sequenceSlugs) return false;
            return subject.sequenceSlugs.some((seq: OakJson) =>
              seq.keyStages?.some((ks: OakJson) => ks.keyStageSlug === keyStage),
            );
          })
          .map((subject) => {
            // Flatten keyStages from all sequences for the frontend
            const allKeyStages = subject.sequenceSlugs
              ? subject.sequenceSlugs.flatMap((seq: OakJson) => seq.keyStages || [])
              : [];

            // Deduplicate keyStages by slug
            const uniqueKeyStages = Array.from(
              new Map(allKeyStages.map((ks: OakJson) => [ks.keyStageSlug, ks])).values(),
            );

            return {
              slug: subject.subjectSlug,
              title:
                subject.subjectTitle ||
                subject.subjectSlug.charAt(0).toUpperCase() + subject.subjectSlug.slice(1),
              keyStages: uniqueKeyStages,
              years: subject.sequenceSlugs
                ? subject.sequenceSlugs.flatMap((seq: OakJson) => seq.years || [])
                : [],
            };
          });

        return filteredSubjects;
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Get units for a specific key stage and subject
   * Note: Oak API uses sequences, not direct key stage/subject paths
   * We fetch the subject to find the matching sequence, then get units for that sequence
   */
  async getUnits(keyStage: string, subjectSlug: string): Promise<OakJson[]> {
    const cacheKey = `oak:keystage:${keyStage}:subject:${subjectSlug}:units`;

    // Fetch the raw list (potentially from cache)
    const rawUnits = await this.getCached(cacheKey, CACHE_TTL.UNITS, async () => {
      this.checkRateLimit();

      try {
        console.log(`[OakAPI] Fetching units for keyStage=${keyStage}, subject=${subjectSlug}`);

        // Step 1: Get the subject to find the appropriate sequence
        const subjectResponse = await this.axiosInstance.get<OakJson>(`/subjects/${subjectSlug}`);
        const subjectData = unwrap<OakJson>(subjectResponse.data);

        if (!subjectData) {
          console.warn(`[OakAPI] No subject data returned for ${subjectSlug}`);
          return [];
        }

        // Step 2: Find the BEST sequence for the requested key stage
        const allSequences: OakJson[] = subjectData.sequenceSlugs || [];

        let matchingSequence: OakJson | undefined;

        // 1. First, try to find a sequence slug that explicitly includes the key stage (e.g. 'ks3')
        matchingSequence = allSequences.find((seq: OakJson) => {
          const seqSlug = (seq.sequenceSlug || (typeof seq === 'string' ? seq : '')).toLowerCase();
          // Match the exact key stage at the end or separated by a hyphen
          return (
            seqSlug.includes(`-${keyStage.toLowerCase()}`) ||
            seqSlug.endsWith(keyStage.toLowerCase())
          );
        });

        // 2. Fallback to previous logic if exact match not found
        if (!matchingSequence) {
          const candidateSequences = allSequences.filter((seq: OakJson) =>
            seq.keyStages?.some((ks: OakJson) => ks.keyStageSlug === keyStage),
          );

          if (candidateSequences.length > 0) {
            const isSecondaryLevel = keyStage === 'ks3' || keyStage === 'ks4';
            const isPrimaryLevel = keyStage === 'ks1' || keyStage === 'ks2';

            matchingSequence =
              candidateSequences.find((seq: OakJson) => {
                const seqSlug = (seq.sequenceSlug || '').toLowerCase();
                if (isSecondaryLevel && seqSlug.includes('secondary')) return true;
                if (isPrimaryLevel && seqSlug.includes('primary')) return true;
                return false;
              }) || candidateSequences[0];
          }
        }

        if (!matchingSequence) {
          console.warn(
            `[OakAPI] No matching sequence found for keyStage=${keyStage} in subject=${subjectSlug}`,
          );
          return [];
        }

        const sequenceSlugToUse = matchingSequence.sequenceSlug || matchingSequence;

        console.log(
          `[OakAPI] Selected sequence: ${sequenceSlugToUse} for ${keyStage}/${subjectSlug}`,
        );

        // Step 3: Fetch units for this sequence
        const unitsResponse = await this.axiosInstance.get<OakJson>(
          `/sequences/${sequenceSlugToUse}/units`,
        );
        const yearlyUnits = unwrap<OakJson[]>(unitsResponse.data);

        if (!yearlyUnits || !Array.isArray(yearlyUnits)) {
          return [];
        }

        const keyStageYearRanges: Record<string, { min: number; max: number }> = {
          ks1: { min: 1, max: 2 },
          ks2: { min: 3, max: 6 },
          ks3: { min: 7, max: 9 },
          ks4: { min: 10, max: 11 },
        };

        const yearRange = keyStageYearRanges[keyStage];
        const allUnits: OakJson[] = [];

        // Helper function to process units
        const processUnits = (
          units: OakJson[],
          year: number | string,
          tier?: { slug: string; title: string },
        ) => {
          units.forEach((unit: OakJson) => {
            if (unit.unitSlug) {
              allUnits.push({
                ...unit,
                slug: unit.unitSlug,
                title: unit.unitTitle || 'Untitled Unit',
                unitNumber: unit.unitOrder ?? 0,
                subjectSlug,
                keyStageSlug: keyStage,
                year,
                ...(tier && { tier: tier.slug, tierTitle: tier.title }),
                numberOfLessons: undefined,
              });
            } else if (unit.unitOptions && Array.isArray(unit.unitOptions)) {
              unit.unitOptions.forEach((option: OakJson, index: number) => {
                const baseOrder = unit.unitOrder ?? 0;
                allUnits.push({
                  unitTitle: option.unitTitle || 'Untitled Unit',
                  unitSlug: option.unitSlug,
                  unitOrder: baseOrder + index * 0.1,
                  slug: option.unitSlug,
                  title: option.unitTitle || 'Untitled Unit',
                  unitNumber: baseOrder,
                  subjectSlug,
                  keyStageSlug: keyStage,
                  year,
                  isOption: true,
                  parentUnitTitle: unit.unitTitle || 'Unknown',
                  threads: unit.threads,
                  ...(tier && { tier: tier.slug, tierTitle: tier.title }),
                  numberOfLessons: undefined,
                });
              });
            }
          });
        };

        yearlyUnits.forEach((yearGroup: OakJson) => {
          const yearNum = parseInt(yearGroup.year, 10);
          if (yearRange && !Number.isNaN(yearNum)) {
            if (yearNum < yearRange.min || yearNum > yearRange.max) return;
          }

          if (yearGroup.units && Array.isArray(yearGroup.units)) {
            processUnits(yearGroup.units, yearGroup.year);
          }

          if (yearGroup.tiers && Array.isArray(yearGroup.tiers)) {
            yearGroup.tiers.forEach((tierData: OakJson) => {
              if (tierData.units && Array.isArray(tierData.units)) {
                processUnits(tierData.units, yearGroup.year, {
                  slug: tierData.tierSlug,
                  title: tierData.tierTitle,
                });
              }
            });
          }

          if (yearGroup.examSubjects && Array.isArray(yearGroup.examSubjects)) {
            yearGroup.examSubjects.forEach((examSubject: OakJson) => {
              if (examSubject.tiers && Array.isArray(examSubject.tiers)) {
                examSubject.tiers.forEach((tierData: OakJson) => {
                  if (tierData.units && Array.isArray(tierData.units)) {
                    tierData.units.forEach((unit: OakJson) => {
                      allUnits.push({
                        ...unit,
                        slug: unit.unitSlug,
                        title: unit.unitTitle || 'Untitled Unit',
                        unitNumber: unit.unitOrder ?? 0,
                        subjectSlug,
                        keyStageSlug: keyStage,
                        year: yearGroup.year,
                        examSubject: examSubject.examSubjectSlug,
                        examSubjectTitle: examSubject.examSubjectTitle,
                        tier: tierData.tierSlug,
                        tierTitle: tierData.tierTitle,
                        numberOfLessons: undefined,
                      });
                    });
                  }
                });
              }
              if (examSubject.units && Array.isArray(examSubject.units)) {
                examSubject.units.forEach((unit: OakJson) => {
                  allUnits.push({
                    ...unit,
                    slug: unit.unitSlug,
                    title: unit.unitTitle || 'Untitled Unit',
                    unitNumber: unit.unitOrder ?? 0,
                    subjectSlug,
                    keyStageSlug: keyStage,
                    year: yearGroup.year,
                    examSubject: examSubject.examSubjectSlug,
                    examSubjectTitle: examSubject.examSubjectTitle,
                    numberOfLessons: undefined,
                  });
                });
              }
            });
          }
        });

        return allUnits;
      } catch (error) {
        return handleApiError(error);
      }
    });

    // Step 5: Filter blocked/unavailable units and RE-INDEX
    try {
      const filteredUnits: OakJson[] = rawUnits.filter((unit: OakJson) => {
        const slug = unit.unitSlug || unit.slug;
        // Skip if in the static hardcoded blocklist (known broken/copyright)
        return !BLOCKED_UNIT_SLUGS.has(slug);
      });

      console.log(
        `[OakAPI] List processed: ${rawUnits.length} raw -> ${filteredUnits.length} units for ${keyStage}/${subjectSlug}`,
      );

      // Re-index to ensure sequential unit numbers (1, 2, 3...)
      return filteredUnits.map((unit: OakJson, index: number) => ({
        ...unit,
        unitNumber: index + 1,
      }));
    } catch (e) {
      console.error('[OakAPI] Failed to filter or re-index units:', e);
      return rawUnits;
    }
  }

  /**
   * Get unit details by slug
   * Fetches unit information from the Oak API
   */
  async getUnitDetails(unitSlug: string): Promise<OakJson> {
    const cacheKey = `oak:unit:${unitSlug}:details`;

    return this.getCached(cacheKey, CACHE_TTL.UNITS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>(`/units/${unitSlug}/summary`);
        const unitData = unwrap<OakJson>(response.data);

        // Return unit details (excluding lessons for this endpoint)
        const { unitLessons, ...unitDetails } = unitData;

        return {
          ...unitDetails,
          slug: unitDetails.unitSlug || unitSlug,
          title: unitDetails.unitTitle,
          numberOfLessons: unitLessons?.length || 0,
        };
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Get lessons for a specific unit
   * Note: Oak API provides lessons via the /units/{unit}/summary endpoint
   */
  async getLessons(unitSlug: string): Promise<OakJson[]> {
    const cacheKey = `oak:unit:${unitSlug}:lessons`;

    return this.getCached(cacheKey, CACHE_TTL.LESSONS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>(`/units/${unitSlug}/summary`);
        const unitData = unwrap<OakJson>(response.data);

        // RELIABILITY FIX: Validate unitData exists
        if (!unitData) {
          console.warn(`No unit data returned for ${unitSlug}`);
          return [];
        }

        // Extract subject and keystage information from unit summary
        const subjectSlug = unitData.subjectSlug || '';
        const keyStageSlug = unitData.keyStageSlug || '';

        // Extract and normalize lessons from the unit summary
        const lessons = unitData.unitLessons || [];

        // RELIABILITY FIX: Validate lessons is an array
        if (!Array.isArray(lessons)) {
          console.warn(`Expected lessons array for unit ${unitSlug}, got:`, typeof lessons);
          return [];
        }

        // Filter out blocked/unavailable lessons
        const filteredLessons = lessons.filter(
          (lesson: OakJson) => !BLOCKED_LESSON_SLUGS.has(lesson.lessonSlug),
        );

        return filteredLessons.map((lesson: OakJson) => ({
          ...lesson,
          slug: lesson.lessonSlug, // Add normalized 'slug' field for frontend compatibility
          title: lesson.lessonTitle, // Add normalized 'title' field
          subjectSlug, // Add subject info from unit for freemium logic
          keyStageSlug, // Add keystage info from unit
        }));
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Get detailed information about a specific lesson
   * Normalizes Oak API field names to frontend-expected format
   */
  async getLessonDetails(lessonSlug: string): Promise<OakJson> {
    const cacheKey = `oak:lesson:${lessonSlug}:details`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>(`/lessons/${lessonSlug}/summary`);
        // Unwrap Oak API response: { data: {...} } -> {...}
        const lessonData = unwrap<OakJson>(response.data);

        // RELIABILITY FIX: Validate lessonData exists
        if (!lessonData) {
          console.warn(`No lesson data returned for ${lessonSlug}`);
          return {
            slug: lessonSlug,
            title: 'Unknown Lesson',
            description: '',
            lessonNumber: 1,
          };
        }

        // Normalize field names for frontend compatibility
        return {
          ...lessonData,
          slug: lessonSlug,
          title: lessonData.lessonTitle || 'Untitled Lesson', // RELIABILITY FIX: Default title
          description: lessonData.pupilLessonOutcome || '', // RELIABILITY FIX: Default description
          lessonNumber: lessonData.lessonOrder ?? 1, // RELIABILITY FIX: Default to 1
          // Keep original fields as well for backwards compatibility
        };
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Get video information for a lesson
   * Videos are not cached as they are typically streaming resources
   */
  async getLessonVideo(lessonSlug: string): Promise<Video> {
    // No caching for videos (TTL = 0)
    const cacheKey = `oak:lesson:${lessonSlug}:video`;

    return this.getCached(
      cacheKey,
      0, // No cache for videos
      async () => {
        this.checkRateLimit();

        try {
          const response = await this.axiosInstance.get<OakJson>(`/lessons/${lessonSlug}/video`);
          // Unwrap Oak API response: { data: {...} } -> {...}
          return unwrap<Video>(response.data);
        } catch (error) {
          return handleApiError(error);
        }
      },
      true, // Skip cache
    );
  }

  /**
   * Get quiz questions for a lesson
   * Returns starterQuiz and exitQuiz arrays
   */
  async getLessonQuiz(lessonSlug: string): Promise<LessonQuiz> {
    const cacheKey = `oak:lesson:${lessonSlug}:quiz`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>(`/lessons/${lessonSlug}/quiz`);
        // Unwrap Oak API response: { data: { starterQuiz: [...], exitQuiz: [...] } }
        const quizData = unwrap<OakJson>(response.data);
        return {
          starterQuiz: quizData.starterQuiz || [],
          exitQuiz: quizData.exitQuiz || [],
        };
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Get lesson assets (video, worksheets, slides, etc.)
   * Rewrites Oak API URLs to use our backend proxy
   * Note: Not all lessons have assets - returns empty array for 404
   */
  async getLessonAssets(lessonSlug: string, backendBaseUrl: string = ''): Promise<OakJson> {
    const cacheKey = `oak:lesson:${lessonSlug}:assets`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>(`/lessons/${lessonSlug}/assets`);
        const { data } = response;

        // Rewrite all Oak API URLs to use our backend proxy.
        // Video must go through the proxy because Oak API requires Authorization headers.
        // All assets (video, PDF, slides) are rewritten to our authenticated backend URL.
        if (data.assets && Array.isArray(data.assets)) {
          data.assets = data.assets.map((asset: OakJson) => ({
            ...asset,
            url: `${backendBaseUrl}/api/v1/oak/lessons/${lessonSlug}/assets/${asset.type}`,
          }));
        }

        return data;
      } catch (error) {
        // Handle 404 gracefully - some lessons don't have assets
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return { assets: [], message: 'No assets available for this lesson' };
        }
        return handleApiError(error);
      }
    });
  }

  /**
   * Get a specific asset file (video, worksheet, etc.) - streams directly from Oak API
   * Uses axios with extended timeouts for reliability
   * NOTE: We explicitly DO NOT pass through Oak API headers to avoid CORS conflicts
   * Note: Not all lessons have all asset types - throws custom error for 404
   */
  async getAssetFile(
    lessonSlug: string,
    assetType: string,
    range?: string,
  ): Promise<{
    stream: Readable;
    contentType: string;
    contentDisposition?: string;
    contentLength?: string;
    contentRange?: string;
    status: number;
  }> {
    this.checkRateLimit();

    try {
      // Create a dedicated axios instance for streaming with longer timeouts
      // and no maxBodyLength limit
      const streamAxios = axios.create({
        baseURL: config.oak.apiBaseUrl,
        headers: {
          ...(config.oak.apiKey && { Authorization: `Bearer ${config.oak.apiKey}` }),
          ...(range && { Range: range }),
          Accept: '*/*',
          'User-Agent': 'Infoverse-Backend/1.0',
        },
        timeout: 120000, // 2 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        maxRedirects: 10,
        httpsAgent: new https.Agent({
          keepAlive: false, // Don't reuse sockets to avoid TLS issues
          timeout: 120000,
        }),
      });

      const response = await streamAxios.get(`/lessons/${lessonSlug}/assets/${assetType}`, {
        responseType: 'stream',
        validateStatus: (status) => status < 500, // Allow 4xx to pass through
      });

      // Handle 404
      if (response.status === 404) {
        response.data.destroy();
        throw new OakApiRequestError({
          message: `Asset '${assetType}' not available for this lesson`,
          statusCode: 404,
        });
      }

      // Handle other client errors
      if (response.status >= 400) {
        response.data.destroy();
        throw new OakApiRequestError({
          message: `Oak API error: ${response.status}`,
          statusCode: response.status,
        });
      }

      // Success - return the stream
      const contentType =
        assetType === 'video'
          ? 'video/mp4'
          : response.headers['content-type'] || 'application/octet-stream';

      return {
        stream: response.data,
        contentType,
        contentDisposition: response.headers['content-disposition'],
        contentLength: response.headers['content-length'],
        contentRange: response.headers['content-range'],
        status: response.status,
      };
    } catch (error) {
      // Handle 404 specifically
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new OakApiRequestError({
          message: `Asset '${assetType}' not available for this lesson`,
          statusCode: 404,
        });
      }

      const message = error instanceof Error ? error.message : 'Network error';
      const statusCode = (axios.isAxiosError(error) && error.response?.status) || 500;
      console.error(`[oakApiService] Asset stream error for ${assetType}:`, message);
      throw new OakApiRequestError({ message, statusCode });
    }
  }

  /**
   * Get lesson transcript
   * Note: Not all lessons have transcripts - returns null for 404
   */
  async getLessonTranscript(lessonSlug: string): Promise<OakJson> {
    const cacheKey = `oak:lesson:${lessonSlug}:transcript`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<OakJson>(`/lessons/${lessonSlug}/transcript`);
        return unwrap<OakJson>(response.data);
      } catch (error) {
        // Handle 404 gracefully - some lessons don't have transcripts
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return {
            transcript: null,
            vtt: null,
            message: 'No transcript available for this lesson',
          };
        }
        return handleApiError(error);
      }
    });
  }

  /**
   * Search for lessons with filters
   */
  async searchLessons(query: string, filters: SearchFilters = {}): Promise<SearchResults<Lesson>> {
    const { keyStage, subjectSlug, yearSlug, page = 1, limit = 20 } = filters;

    // Create cache key based on search parameters
    const cacheKey = `oak:search:${query}:${keyStage || 'all'}:${subjectSlug || 'all'}:${yearSlug || 'all'}:${page}:${limit}`;

    return this.getCached(cacheKey, CACHE_TTL.SEARCH, async () => {
      this.checkRateLimit();

      try {
        const params: Record<string, string | number> = {
          q: query,
          page,
          limit,
        };

        if (keyStage) params.keyStage = keyStage;
        if (subjectSlug) params.subject = subjectSlug;
        if (yearSlug) params.year = yearSlug;

        const response = await this.axiosInstance.get<OakJson>('/lessons/search', {
          params,
        });

        const searchResults = unwrap<SearchResults<Lesson> & OakJson>(response.data);

        // Filter out blocked lessons and units
        if (searchResults && Array.isArray(searchResults.data)) {
          searchResults.data = searchResults.data.filter((lesson: OakJson) => {
            const lessonResultSlug = lesson.lessonSlug || lesson.slug;
            const { unitSlug } = lesson;

            if (lessonResultSlug && BLOCKED_LESSON_SLUGS.has(lessonResultSlug)) return false;
            if (unitSlug && BLOCKED_UNIT_SLUGS.has(unitSlug)) return false;

            return true;
          });
        }

        return searchResults;
      } catch (error) {
        return handleApiError(error);
      }
    });
  }

  /**
   * Clear cache for a specific key pattern
   * Useful for cache invalidation
   */
  async clearCache(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(`oak:${pattern}*`);
      console.log(`[OakAPI Cache] Clearing ${keys.length} keys matching pattern: oak:${pattern}*`);
      if (keys.length === 0) {
        return 0;
      }
      // Delete keys in batches to avoid Redis limits. Sequential (not
      // Promise.all) on purpose - this deliberately throttles delete
      // throughput rather than firing all batches at Redis at once.
      let totalDeleted = 0;
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        // eslint-disable-next-line no-await-in-loop
        const deleted = await this.redis.del(...batch);
        totalDeleted += deleted;
      }
      console.log(`[OakAPI Cache] Deleted ${totalDeleted} keys`);
      return totalDeleted;
    } catch (error) {
      console.error('[OakAPI Cache] Clear error:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific key stage and subject
   */
  async clearSubjectCache(keyStage: string, subjectSlug: string): Promise<number> {
    const pattern = `keystage:${keyStage}:subject:${subjectSlug}`;
    return this.clearCache(pattern);
  }

  /**
   * Clear all cache for a key stage
   */
  async clearKeyStageCache(keyStage: string): Promise<number> {
    const pattern = `keystage:${keyStage}`;
    return this.clearCache(pattern);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; reset: Date | null } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset,
    };
  }
}

// Lazy singleton instance
let instance: OakApiService | null = null;

/**
 * Get the singleton OakApiService instance
 */
export const getOakApiService = (): OakApiService => {
  if (!instance) {
    instance = new OakApiService();
  }
  return instance;
};

// Export singleton instance (lazy)
export default {
  get instance() {
    return getOakApiService();
  },
  getKeyStages: () => getOakApiService().getKeyStages(),
  getSubjectsByKeyStage: (keyStage: string) => getOakApiService().getSubjectsByKeyStage(keyStage),
  getUnits: (keyStage: string, subjectSlug: string) =>
    getOakApiService().getUnits(keyStage, subjectSlug),
  getUnitDetails: (unitSlug: string) => getOakApiService().getUnitDetails(unitSlug),
  getLessons: (unitSlug: string) => getOakApiService().getLessons(unitSlug),
  getLessonDetails: (lessonSlug: string) => getOakApiService().getLessonDetails(lessonSlug),
  getLessonVideo: (lessonSlug: string) => getOakApiService().getLessonVideo(lessonSlug),
  getLessonQuiz: (lessonSlug: string) => getOakApiService().getLessonQuiz(lessonSlug),
  getLessonAssets: (lessonSlug: string, backendBaseUrl?: string) =>
    getOakApiService().getLessonAssets(lessonSlug, backendBaseUrl),
  getAssetFile: (lessonSlug: string, assetType: string, range?: string) =>
    getOakApiService().getAssetFile(lessonSlug, assetType, range),
  getLessonTranscript: (lessonSlug: string) => getOakApiService().getLessonTranscript(lessonSlug),
  searchLessons: (query: string, filters?: SearchFilters) =>
    getOakApiService().searchLessons(query, filters),
  clearCache: (pattern: string) => getOakApiService().clearCache(pattern),
  clearSubjectCache: (keyStage: string, subjectSlug: string) =>
    getOakApiService().clearSubjectCache(keyStage, subjectSlug),
  clearKeyStageCache: (keyStage: string) => getOakApiService().clearKeyStageCache(keyStage),
  getRateLimitStatus: () => getOakApiService().getRateLimitStatus(),
};
