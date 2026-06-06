import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import got from 'got';
import config from '../config';
import {
  KeyStage,
  Subject,
  Unit,
  Lesson,
  LessonDetails,
  Video,
  Quiz,
  LessonQuiz,
  SearchFilters,
  SearchResults,
  OakApiError,
} from './oakApiTypes';
import redisClient from '../config/redis'; // Direct import of the Redis client
import { BLOCKED_UNIT_SLUGS } from '../config/oakBlockedUnits'; // Static hardcoded blocklist

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
 * Interface for Redis client dependency
 */
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
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
        const config = error.config as any;
        if (config) {
          if (!config.retryCount) {
            config.retryCount = 0;
          }

          const maxRetries = 2;
          const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
          const isServerError = error.response && error.response.status >= 500;
          const isRateLimit = error.response?.status === 429;

          if ((isTimeout || isServerError || isRateLimit) && config.retryCount < maxRetries) {
            config.retryCount += 1;
            console.warn(
              `[OakAPI] Request failed (${error.message}). Retrying (${config.retryCount}/${maxRetries})...`,
            );

            // Exponential backoff
            const delay = isRateLimit ? 5000 : 1000 * 2 ** config.retryCount;

            return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
              this.axiosInstance(config),
            );
          }
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Unwrap Oak API response structure
   * Oak API returns { data: [...] } but we need just [...]
   */
  private unwrap<T>(response: any): T {
    // Check if response has a 'data' property
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data as T;
    }
    // Otherwise return the response as-is
    return response as T;
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
   * Handle API errors and transform them into a consistent format
   */
  private handleApiError(error: unknown): never {
    // Add debugging log to see what exactly is blowing up
    console.error(
      '[OakAPI] handleApiError caught:',
      error instanceof Error ? error.message : error,
    );

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<OakApiError>;

      if (axiosError.response) {
        const statusCode = axiosError.response.status;
        const message =
          axiosError.response.data?.message || axiosError.message || 'Oak API request failed';

        throw {
          message,
          statusCode,
          error: axiosError.response.data?.error,
        } as OakApiError;
      }

      throw {
        message: axiosError.message || 'Network error',
        statusCode: 500,
      } as OakApiError;
    }

    throw {
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
    } as OakApiError;
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
      throw {
        message: `Rate limit exceeded. Resets at ${resetTime}`,
        statusCode: 429,
      } as OakApiError;
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
        const response = await this.axiosInstance.get<any>('/key-stages');
        // Unwrap Oak API response: { data: [...] } -> [...]
        return this.unwrap<KeyStage[]>(response.data);
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get subjects by key stage
   * Note: Oak API doesn't have a direct endpoint for subjects by key stage
   * We fetch all subjects and filter by key stage
   */
  async getSubjectsByKeyStage(keyStage: string): Promise<any[]> {
    const cacheKey = `oak:keystage:${keyStage}:subjects`;

    return this.getCached(cacheKey, CACHE_TTL.SUBJECTS, async () => {
      this.checkRateLimit();

      try {
        // Get all subjects from the Oak API
        const response = await this.axiosInstance.get<any>('/subjects');
        const allSubjects = this.unwrap<any[]>(response.data);

        // RELIABILITY FIX: Validate array before operations
        if (!allSubjects || !Array.isArray(allSubjects)) {
          console.warn('Expected array from subjects API, got:', typeof allSubjects);
          return [];
        }

        // Oak API now returns an array of strings for /subjects
        const slugs = allSubjects
          .map((s: any) => (typeof s === 'string' ? s : s.subjectSlug))
          .filter(Boolean);

        // Fetch detailed data for each subject to get keyStages mapping
        // Use Promise.all with concurrency limit or just map since the list is small (~20)
        const detailedResponses = await Promise.all(
          slugs.map((slug: string) =>
            this.axiosInstance.get<any>(`/subjects/${slug}`).catch(() => null),
          ),
        );

        const detailedSubjects = detailedResponses
          .filter((res) => res && res.data)
          .map((res) => this.unwrap<any>(res!.data));

        // Filter subjects that have the requested key stage in any of their sequences
        const filteredSubjects = detailedSubjects
          .filter((subject) => {
            if (!subject.sequenceSlugs) return false;
            return subject.sequenceSlugs.some((seq: any) =>
              seq.keyStages?.some((ks: any) => ks.keyStageSlug === keyStage),
            );
          })
          .map((subject) => {
            // Flatten keyStages from all sequences for the frontend
            const allKeyStages = subject.sequenceSlugs
              ? subject.sequenceSlugs.flatMap((seq: any) => seq.keyStages || [])
              : [];

            // Deduplicate keyStages by slug
            const uniqueKeyStages = Array.from(
              new Map(allKeyStages.map((ks: any) => [ks.keyStageSlug, ks])).values(),
            );

            return {
              slug: subject.subjectSlug,
              title:
                subject.subjectTitle ||
                subject.subjectSlug.charAt(0).toUpperCase() + subject.subjectSlug.slice(1),
              keyStages: uniqueKeyStages,
              years: subject.sequenceSlugs
                ? subject.sequenceSlugs.flatMap((seq: any) => seq.years || [])
                : [],
            };
          });

        return filteredSubjects;
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get units for a specific key stage and subject
   * Note: Oak API uses sequences, not direct key stage/subject paths
   * We fetch the subject to find the matching sequence, then get units for that sequence
   */
  async getUnits(keyStage: string, subjectSlug: string): Promise<any[]> {
    const cacheKey = `oak:keystage:${keyStage}:subject:${subjectSlug}:units`;

    // Fetch the raw list (potentially from cache)
    const rawUnits = await this.getCached(cacheKey, CACHE_TTL.UNITS, async () => {
      this.checkRateLimit();

      try {
        console.log(`[OakAPI] Fetching units for keyStage=${keyStage}, subject=${subjectSlug}`);

        // Step 1: Get the subject to find the appropriate sequence
        const subjectResponse = await this.axiosInstance.get<any>(`/subjects/${subjectSlug}`);
        const subjectData = this.unwrap<any>(subjectResponse.data);

        if (!subjectData) {
          console.warn(`[OakAPI] No subject data returned for ${subjectSlug}`);
          return [];
        }

        // Step 2: Find the BEST sequence for the requested key stage
        const candidateSequences =
          subjectData.sequenceSlugs?.filter((seq: any) =>
            seq.keyStages?.some((ks: any) => ks.keyStageSlug === keyStage),
          ) || [];

        if (candidateSequences.length === 0) {
          console.warn(
            `[OakAPI] No matching sequence found for keyStage=${keyStage} in subject=${subjectSlug}`,
          );
          return [];
        }

        const isSecondaryLevel = keyStage === 'ks3' || keyStage === 'ks4';
        const isPrimaryLevel = keyStage === 'ks1' || keyStage === 'ks2';

        let matchingSequence = candidateSequences[0];

        if (candidateSequences.length > 1) {
          const bestMatch = candidateSequences.find((seq: any) => {
            const seqSlug = (seq.sequenceSlug || '').toLowerCase();
            if (isSecondaryLevel && seqSlug.includes('secondary')) return true;
            if (isPrimaryLevel && seqSlug.includes('primary')) return true;
            return false;
          });

          if (bestMatch) {
            matchingSequence = bestMatch;
          } else {
            const sorted = candidateSequences.sort((a: any, b: any) => {
              const aKeyStages = a.keyStages?.length || 0;
              const bKeyStages = b.keyStages?.length || 0;
              return aKeyStages - bKeyStages;
            });
            matchingSequence = sorted[0];
          }
        }

        console.log(
          `[OakAPI] Selected sequence: ${matchingSequence.sequenceSlug} for ${keyStage}/${subjectSlug}`,
        );

        // Step 3: Fetch units for this sequence
        const unitsResponse = await this.axiosInstance.get<any>(
          `/sequences/${matchingSequence.sequenceSlug}/units`,
        );
        const yearlyUnits = this.unwrap<any[]>(unitsResponse.data);

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
        const allUnits: any[] = [];

        // Helper function to process units
        const processUnits = (
          units: any[],
          year: number | string,
          tier?: { slug: string; title: string },
        ) => {
          units.forEach((unit: any) => {
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
              unit.unitOptions.forEach((option: any, index: number) => {
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

        yearlyUnits.forEach((yearGroup: any) => {
          const yearNum = parseInt(yearGroup.year, 10);
          if (yearRange && !isNaN(yearNum)) {
            if (yearNum < yearRange.min || yearNum > yearRange.max) return;
          }

          if (yearGroup.units && Array.isArray(yearGroup.units)) {
            processUnits(yearGroup.units, yearGroup.year);
          }

          if (yearGroup.tiers && Array.isArray(yearGroup.tiers)) {
            yearGroup.tiers.forEach((tierData: any) => {
              if (tierData.units && Array.isArray(tierData.units)) {
                processUnits(tierData.units, yearGroup.year, {
                  slug: tierData.tierSlug,
                  title: tierData.tierTitle,
                });
              }
            });
          }

          if (yearGroup.examSubjects && Array.isArray(yearGroup.examSubjects)) {
            yearGroup.examSubjects.forEach((examSubject: any) => {
              if (examSubject.tiers && Array.isArray(examSubject.tiers)) {
                examSubject.tiers.forEach((tierData: any) => {
                  if (tierData.units && Array.isArray(tierData.units)) {
                    tierData.units.forEach((unit: any) => {
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
                examSubject.units.forEach((unit: any) => {
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
        return this.handleApiError(error);
      }
    });

    // Step 5: Filter blocked/unavailable units and RE-INDEX
    try {
      const filteredUnits: any[] = [];

      for (const unit of rawUnits) {
        const slug = unit.unitSlug || unit.slug;

        // Skip if in the static hardcoded blocklist (known broken/copyright)
        if (BLOCKED_UNIT_SLUGS.has(slug)) continue;

        filteredUnits.push(unit);
      }

      console.log(
        `[OakAPI] List processed: ${rawUnits.length} raw -> ${filteredUnits.length} units for ${keyStage}/${subjectSlug}`,
      );

      // Re-index to ensure sequential unit numbers (1, 2, 3...)
      return filteredUnits.map((unit: any, index: number) => ({
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
  async getUnitDetails(unitSlug: string): Promise<any> {
    const cacheKey = `oak:unit:${unitSlug}:details`;

    return this.getCached(cacheKey, CACHE_TTL.UNITS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/units/${unitSlug}/summary`);
        const unitData = this.unwrap<any>(response.data);

        // Return unit details (excluding lessons for this endpoint)
        const { unitLessons, ...unitDetails } = unitData;

        return {
          ...unitDetails,
          slug: unitDetails.unitSlug || unitSlug,
          title: unitDetails.unitTitle,
          numberOfLessons: unitLessons?.length || 0,
        };
      } catch (error: any) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get lessons for a specific unit
   * Note: Oak API provides lessons via the /units/{unit}/summary endpoint
   */
  async getLessons(unitSlug: string): Promise<any[]> {
    const cacheKey = `oak:unit:${unitSlug}:lessons`;

    return this.getCached(cacheKey, CACHE_TTL.LESSONS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/units/${unitSlug}/summary`);
        const unitData = this.unwrap<any>(response.data);

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

        return lessons.map((lesson: any) => ({
          ...lesson,
          slug: lesson.lessonSlug, // Add normalized 'slug' field for frontend compatibility
          title: lesson.lessonTitle, // Add normalized 'title' field
          subjectSlug, // Add subject info from unit for freemium logic
          keyStageSlug, // Add keystage info from unit
        }));
      } catch (error: any) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get detailed information about a specific lesson
   * Normalizes Oak API field names to frontend-expected format
   */
  async getLessonDetails(lessonSlug: string): Promise<any> {
    const cacheKey = `oak:lesson:${lessonSlug}:details`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/summary`);
        // Unwrap Oak API response: { data: {...} } -> {...}
        const lessonData = this.unwrap<any>(response.data);

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
        return this.handleApiError(error);
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
          const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/video`);
          // Unwrap Oak API response: { data: {...} } -> {...}
          return this.unwrap<Video>(response.data);
        } catch (error) {
          return this.handleApiError(error);
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
        const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/quiz`);
        // Unwrap Oak API response: { data: { starterQuiz: [...], exitQuiz: [...] } }
        const quizData = this.unwrap<any>(response.data);
        return {
          starterQuiz: quizData.starterQuiz || [],
          exitQuiz: quizData.exitQuiz || [],
        };
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get lesson assets (video, worksheets, slides, etc.)
   * Rewrites Oak API URLs to use our backend proxy
   * Note: Not all lessons have assets - returns empty array for 404
   */
  async getLessonAssets(lessonSlug: string, backendBaseUrl: string = ''): Promise<any> {
    const cacheKey = `oak:lesson:${lessonSlug}:assets`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/assets`);
        const { data } = response;

        // Rewrite all Oak API URLs to use our backend proxy.
        // Video must go through the proxy because Oak API requires Authorization headers.
        // All assets (video, PDF, slides) are rewritten to our authenticated backend URL.
        if (data.assets && Array.isArray(data.assets)) {
          data.assets = data.assets.map((asset: any) => ({
            ...asset,
            url: `${backendBaseUrl}/api/v1/oak/lessons/${lessonSlug}/assets/${asset.type}`,
          }));
        }

        return data;
      } catch (error: any) {
        // Handle 404 gracefully - some lessons don't have assets
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return { assets: [], message: 'No assets available for this lesson' };
        }
        return this.handleApiError(error);
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
    stream: any;
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
        throw {
          message: `Asset '${assetType}' not available for this lesson`,
          statusCode: 404,
        } as OakApiError;
      }

      // Handle other client errors
      if (response.status >= 400) {
        response.data.destroy();
        throw {
          message: `Oak API error: ${response.status}`,
          statusCode: response.status,
        } as OakApiError;
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
    } catch (error: any) {
      // Handle 404 specifically
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw {
          message: `Asset '${assetType}' not available for this lesson`,
          statusCode: 404,
        } as OakApiError;
      }

      console.error(`[oakApiService] Asset stream error for ${assetType}:`, error.message);
      throw {
        message: error.message || 'Network error',
        statusCode: error.response?.status || 500,
      } as OakApiError;
    }
  }

  /**
   * Get lesson transcript
   * Note: Not all lessons have transcripts - returns null for 404
   */
  async getLessonTranscript(lessonSlug: string): Promise<any> {
    const cacheKey = `oak:lesson:${lessonSlug}:transcript`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/transcript`);
        return this.unwrap<any>(response.data);
      } catch (error: any) {
        // Handle 404 gracefully - some lessons don't have transcripts
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return {
            transcript: null,
            vtt: null,
            message: 'No transcript available for this lesson',
          };
        }
        return this.handleApiError(error);
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

        const response = await this.axiosInstance.get<any>('/lessons/search', {
          params,
        });

        // Unwrap Oak API response: { data: {...} } -> {...}
        return this.unwrap<SearchResults<Lesson>>(response.data);
      } catch (error) {
        return this.handleApiError(error);
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
      // Delete keys in batches to avoid Redis limits
      let totalDeleted = 0;
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
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
