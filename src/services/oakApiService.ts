import axios, { AxiosInstance, AxiosError } from 'axios';
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
    this.axiosInstance = axiosInstance || axios.create({
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
      (error) => {
        if (error.response?.status === 429) {
          this.rateLimitRemaining = 0;
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            this.rateLimitReset = new Date(Date.now() + parseInt(retryAfter, 10) * 1000);
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
          return JSON.parse(cached) as T;
        }
      } catch (error) {
        console.error(`Cache get error for key ${cacheKey}:`, error);
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
   */
  private checkRateLimit(): void {
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

        // Filter subjects that have the requested key stage
        const filteredSubjects = allSubjects
          .filter((subject) => {
            // Check if this subject has content for the requested key stage
            return subject.keyStages?.some((ks: any) => ks.keyStageSlug === keyStage);
          })
          .map((subject) => ({
            slug: subject.subjectSlug,
            title: subject.subjectTitle,
            // Include key stage information for reference
            keyStages: subject.keyStages,
            years: subject.years,
          }));

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

    return this.getCached(cacheKey, CACHE_TTL.UNITS, async () => {
      this.checkRateLimit();

      try {
        // Step 1: Get the subject to find the appropriate sequence
        const subjectResponse = await this.axiosInstance.get<any>(`/subjects/${subjectSlug}`);
        const subjectData = this.unwrap<any>(subjectResponse.data);

        // Step 2: Find the sequence that matches the requested key stage
        const matchingSequence = subjectData.sequenceSlugs?.find((seq: any) =>
          seq.keyStages?.some((ks: any) => ks.keyStageSlug === keyStage)
        );

        if (!matchingSequence) {
          // Return empty array if no matching sequence found
          return [];
        }

        // Step 3: Fetch units for this sequence
        const unitsResponse = await this.axiosInstance.get<any>(
          `/sequences/${matchingSequence.sequenceSlug}/units`
        );
        const yearlyUnits = this.unwrap<any[]>(unitsResponse.data);

        // Step 4: Flatten and normalize the units array (units are grouped by year)
        const allUnits: any[] = [];
        yearlyUnits.forEach((yearGroup: any) => {
          if (yearGroup.units && Array.isArray(yearGroup.units)) {
            yearGroup.units.forEach((unit: any) => {
              // Some units have unitSlug directly, others have unitOptions array
              if (unit.unitSlug) {
                // Regular unit with a direct slug
                allUnits.push({
                  ...unit,
                  slug: unit.unitSlug, // Normalized slug
                  title: unit.unitTitle, // Normalized title
                  unitNumber: unit.unitOrder, // Frontend expects unitNumber
                  subjectSlug: subjectSlug, // Add subject context
                  keyStageSlug: keyStage, // Add key stage context
                  year: yearGroup.year, // Add year information
                  // numberOfLessons requires additional API call to /units/{slug}/summary
                  // Setting to undefined - can be fetched on demand if needed
                  numberOfLessons: undefined,
                });
              } else if (unit.unitOptions && Array.isArray(unit.unitOptions)) {
                // Multi-option unit - expand each option as a separate unit
                unit.unitOptions.forEach((option: any, index: number) => {
                  allUnits.push({
                    unitTitle: option.unitTitle,
                    unitSlug: option.unitSlug,
                    unitOrder: unit.unitOrder + (index * 0.1), // Maintain order but distinguish options
                    slug: option.unitSlug,
                    title: option.unitTitle,
                    unitNumber: unit.unitOrder,
                    subjectSlug: subjectSlug,
                    keyStageSlug: keyStage,
                    year: yearGroup.year,
                    isOption: true, // Mark as an option unit
                    parentUnitTitle: unit.unitTitle, // Reference to parent
                    threads: unit.threads, // Inherit threads from parent
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
      } catch (error) {
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

        // Extract subject and keystage information from unit summary
        const subjectSlug = unitData.subjectSlug;
        const keyStageSlug = unitData.keyStageSlug;

        // Extract and normalize lessons from the unit summary
        const lessons = unitData.unitLessons || [];
        return lessons.map((lesson: any) => ({
          ...lesson,
          slug: lesson.lessonSlug, // Add normalized 'slug' field for frontend compatibility
          title: lesson.lessonTitle, // Add normalized 'title' field
          subjectSlug: subjectSlug, // Add subject info from unit for freemium logic
          keyStageSlug: keyStageSlug, // Add keystage info from unit
        }));
      } catch (error) {
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

        // Normalize field names for frontend compatibility
        return {
          ...lessonData,
          slug: lessonSlug,
          title: lessonData.lessonTitle,
          description: lessonData.pupilLessonOutcome,
          lessonNumber: lessonData.lessonOrder || 1,
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
   */
  async getLessonAssets(lessonSlug: string, backendBaseUrl: string = ''): Promise<any> {
    const cacheKey = `oak:lesson:${lessonSlug}:assets`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/assets`);
        const data = response.data;

        // Rewrite Oak API URLs to use our backend proxy
        if (data.assets && Array.isArray(data.assets)) {
          data.assets = data.assets.map((asset: any) => ({
            ...asset,
            // Replace Oak API URL with our backend proxy URL
            url: `${backendBaseUrl}/api/v1/oak/lessons/${lessonSlug}/assets/${asset.type}`,
          }));
        }

        return data;
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get a specific asset file (video, worksheet, etc.) - streams directly from Oak API
   */
  async getAssetFile(lessonSlug: string, assetType: string): Promise<{ stream: any; contentType: string; contentDisposition?: string }> {
    this.checkRateLimit();

    try {
      const response = await this.axiosInstance.get(
        `/lessons/${lessonSlug}/assets/${assetType}`,
        { responseType: 'stream' }
      );

      return {
        stream: response.data,
        contentType: response.headers['content-type'] || 'application/octet-stream',
        contentDisposition: response.headers['content-disposition'],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Get lesson transcript
   */
  async getLessonTranscript(lessonSlug: string): Promise<any> {
    const cacheKey = `oak:lesson:${lessonSlug}:transcript`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<any>(`/lessons/${lessonSlug}/transcript`);
        return this.unwrap<any>(response.data);
      } catch (error) {
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
      if (keys.length === 0) {
        return 0;
      }
      return await this.redis.del(...keys);
    } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
    }
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
  getUnits: (keyStage: string, subjectSlug: string) => getOakApiService().getUnits(keyStage, subjectSlug),
  getUnitDetails: (unitSlug: string) => getOakApiService().getUnitDetails(unitSlug),
  getLessons: (unitSlug: string) => getOakApiService().getLessons(unitSlug),
  getLessonDetails: (lessonSlug: string) => getOakApiService().getLessonDetails(lessonSlug),
  getLessonVideo: (lessonSlug: string) => getOakApiService().getLessonVideo(lessonSlug),
  getLessonQuiz: (lessonSlug: string) => getOakApiService().getLessonQuiz(lessonSlug),
  getLessonAssets: (lessonSlug: string, backendBaseUrl?: string) => getOakApiService().getLessonAssets(lessonSlug, backendBaseUrl),
  getAssetFile: (lessonSlug: string, assetType: string) => getOakApiService().getAssetFile(lessonSlug, assetType),
  getLessonTranscript: (lessonSlug: string) => getOakApiService().getLessonTranscript(lessonSlug),
  searchLessons: (query: string, filters?: SearchFilters) => getOakApiService().searchLessons(query, filters),
  clearCache: (pattern: string) => getOakApiService().clearCache(pattern),
  getRateLimitStatus: () => getOakApiService().getRateLimitStatus(),
};