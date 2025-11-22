import axios, { AxiosInstance, AxiosError } from 'axios';
import { redisClient } from '../server';
import config from '../config';
import {
  KeyStage,
  Subject,
  Unit,
  Lesson,
  LessonDetails,
  Video,
  Quiz,
  SearchFilters,
  SearchResults,
  OakApiError,
} from './oakApiTypes';

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
 * Oak National Academy API Service
 * Provides methods to interact with the Oak API with Redis caching
 */
class OakApiService {
  private axiosInstance: AxiosInstance;

  private rateLimitRemaining: number;

  private rateLimitReset: Date | null;

  constructor() {
    this.axiosInstance = axios.create({
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
        const cached = await redisClient.get(cacheKey);
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
        await redisClient.setex(cacheKey, ttl, JSON.stringify(data));
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
        const response = await this.axiosInstance.get<KeyStage[]>('/key-stages');
        return response.data;
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get subjects by key stage
   */
  async getSubjectsByKeyStage(keyStage: number): Promise<Subject[]> {
    const cacheKey = `oak:keystage:${keyStage}:subjects`;

    return this.getCached(cacheKey, CACHE_TTL.SUBJECTS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<Subject[]>(`/key-stages/ks${keyStage}/subjects`);
        return response.data;
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get units for a specific key stage and subject
   */
  async getUnits(keyStage: number, subjectSlug: string): Promise<Unit[]> {
    const cacheKey = `oak:keystage:${keyStage}:subject:${subjectSlug}:units`;

    return this.getCached(cacheKey, CACHE_TTL.UNITS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<Unit[]>(
          `/key-stages/ks${keyStage}/subjects/${subjectSlug}/units`,
        );
        return response.data;
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get lessons for a specific unit
   */
  async getLessons(unitSlug: string): Promise<Lesson[]> {
    const cacheKey = `oak:unit:${unitSlug}:lessons`;

    return this.getCached(cacheKey, CACHE_TTL.LESSONS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<Lesson[]>(`/units/${unitSlug}/lessons`);
        return response.data;
      } catch (error) {
        return this.handleApiError(error);
      }
    });
  }

  /**
   * Get detailed information about a specific lesson
   */
  async getLessonDetails(lessonSlug: string): Promise<LessonDetails> {
    const cacheKey = `oak:lesson:${lessonSlug}:details`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<LessonDetails>(`/lessons/${lessonSlug}`);
        return response.data;
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
          const response = await this.axiosInstance.get<Video>(`/lessons/${lessonSlug}/video`);
          return response.data;
        } catch (error) {
          return this.handleApiError(error);
        }
      },
      true, // Skip cache
    );
  }

  /**
   * Get quiz questions for a lesson
   */
  async getLessonQuiz(lessonSlug: string): Promise<Quiz[]> {
    const cacheKey = `oak:lesson:${lessonSlug}:quiz`;

    return this.getCached(cacheKey, CACHE_TTL.LESSON_DETAILS, async () => {
      this.checkRateLimit();

      try {
        const response = await this.axiosInstance.get<Quiz[]>(`/lessons/${lessonSlug}/quiz`);
        return response.data;
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

        if (keyStage) params.keyStage = `ks${keyStage}`;
        if (subjectSlug) params.subject = subjectSlug;
        if (yearSlug) params.year = yearSlug;

        const response = await this.axiosInstance.get<SearchResults<Lesson>>('/lessons/search', {
          params,
        });

        return response.data;
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
      const keys = await redisClient.keys(`oak:${pattern}*`);
      if (keys.length === 0) {
        return 0;
      }
      return await redisClient.del(...keys);
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

// Export singleton instance
export default new OakApiService();
