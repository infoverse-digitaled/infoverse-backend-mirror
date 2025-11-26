import axios from 'axios';
import { redisClient } from '../../server';
import oakApiService from '../../services/oakApiService';
import { KeyStage } from '../../services/oakApiTypes';

// Mock config
jest.mock('../../config', () => ({
  default: {
    oak: {
      apiBaseUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
      },
    },
  },
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock redisClient
jest.mock('../../server', () => ({
  redisClient: {
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  },
}));

describe('OakApiService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getKeyStages', () => {
    const mockKeyStages: KeyStage[] = [
      {
        slug: 'ks1',
        title: 'Key Stage 1',
        shortCode: 'KS1',
      },
      {
        slug: 'ks2',
        title: 'Key Stage 2',
        shortCode: 'KS2',
      },
      {
        slug: 'ks3',
        title: 'Key Stage 3',
        shortCode: 'KS3',
      },
      {
        slug: 'ks4',
        title: 'Key Stage 4',
        shortCode: 'KS4',
      },
    ];

    it('should return key stages data correctly from API', async () => {
      // Mock cache miss (no cached data)
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock successful API response
      mockedAxios.create = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockKeyStages }),
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any);

      // Re-import oakApiService to get the mocked axios instance
      // Note: Due to singleton pattern, we need to work with the existing instance
      // For this test, we'll mock the internal axios call directly
      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn().mockResolvedValue({ data: mockKeyStages });

      const result = await oakApiService.getKeyStages();

      // Verify the result
      expect(result).toEqual(mockKeyStages);
      expect(result).toHaveLength(4);
      expect(result[0].title).toBe('Key Stage 1');

      // Verify cache was checked
      expect(redisClient.get).toHaveBeenCalledWith('oak:keystages');

      // Verify cache was set with correct TTL (24 hours = 86400 seconds)
      expect(redisClient.setex).toHaveBeenCalledWith(
        'oak:keystages',
        86400,
        JSON.stringify(mockKeyStages),
      );
    });

    it('should use cached data on second call', async () => {
      const cachedData = JSON.stringify(mockKeyStages);

      // Mock cache hit (cached data exists)
      (redisClient.get as jest.Mock).mockResolvedValue(cachedData);

      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn();

      const result = await oakApiService.getKeyStages();

      // Verify the result is from cache
      expect(result).toEqual(mockKeyStages);

      // Verify cache was checked
      expect(redisClient.get).toHaveBeenCalledWith('oak:keystages');

      // Verify API was NOT called (data came from cache)
      expect(axiosInstance.get).not.toHaveBeenCalled();

      // Verify cache was NOT set again
      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    it('should handle errors when Oak API is down', async () => {
      // Mock cache miss
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock API error (network error)
      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn().mockRejectedValue({
        message: 'Network Error',
        isAxiosError: true,
      });

      // Expect the call to throw an error
      await expect(oakApiService.getKeyStages()).rejects.toMatchObject({
        message: 'Network Error',
        statusCode: 500,
      });

      // Verify cache was checked
      expect(redisClient.get).toHaveBeenCalledWith('oak:keystages');

      // Verify cache was NOT set (due to error)
      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    it('should handle 404 errors from Oak API', async () => {
      // Mock cache miss
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock API error (404 Not Found)
      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn().mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: 'Resource not found',
            error: 'Not Found',
          },
        },
        isAxiosError: true,
      });

      // Expect the call to throw an error with 404 status
      await expect(oakApiService.getKeyStages()).rejects.toMatchObject({
        message: 'Resource not found',
        statusCode: 404,
        error: 'Not Found',
      });
    });

    it('should handle rate limit errors (429)', async () => {
      // Mock cache miss
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock rate limit error
      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn().mockRejectedValue({
        response: {
          status: 429,
          data: {
            message: 'Rate limit exceeded',
          },
          headers: {
            'retry-after': '60',
          },
        },
        isAxiosError: true,
      });

      // Expect the call to throw a rate limit error
      await expect(oakApiService.getKeyStages()).rejects.toMatchObject({
        message: 'Rate limit exceeded',
        statusCode: 429,
      });
    });

    it('should continue if cache get fails but API succeeds', async () => {
      // Mock cache error
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Redis connection error'));

      // Mock successful API response
      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn().mockResolvedValue({ data: mockKeyStages });

      // Spy on console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await oakApiService.getKeyStages();

      // Verify the result is from API
      expect(result).toEqual(mockKeyStages);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Cache get error for key oak:keystages:',
        expect.any(Error),
      );

      // Verify API was called (fallback after cache error)
      expect(axiosInstance.get).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should continue if cache set fails but data is returned', async () => {
      // Mock cache miss
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock cache set error
      (redisClient.setex as jest.Mock).mockRejectedValue(new Error('Redis write error'));

      // Mock successful API response
      const axiosInstance = (oakApiService as any).axiosInstance;
      axiosInstance.get = jest.fn().mockResolvedValue({ data: mockKeyStages });

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await oakApiService.getKeyStages();

      // Verify the result is returned despite cache error
      expect(result).toEqual(mockKeyStages);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Cache set error for key oak:keystages:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear cache keys matching pattern', async () => {
      const mockKeys = ['oak:keystages', 'oak:keystage:1:subjects', 'oak:keystage:2:subjects'];

      // Mock redis keys and del operations
      (redisClient.keys as jest.Mock).mockResolvedValue(mockKeys);
      (redisClient.del as jest.Mock).mockResolvedValue(mockKeys.length);

      const result = await oakApiService.clearCache('keystage');

      // Verify keys were fetched with correct pattern
      expect(redisClient.keys).toHaveBeenCalledWith('oak:keystage*');

      // Verify keys were deleted
      expect(redisClient.del).toHaveBeenCalledWith(...mockKeys);

      // Verify correct count returned
      expect(result).toBe(3);
    });

    it('should return 0 when no keys match pattern', async () => {
      // Mock empty keys result
      (redisClient.keys as jest.Mock).mockResolvedValue([]);

      const result = await oakApiService.clearCache('nonexistent');

      // Verify no deletion attempted
      expect(redisClient.del).not.toHaveBeenCalled();

      // Verify 0 returned
      expect(result).toBe(0);
    });

    it('should throw error when cache clear fails', async () => {
      // Mock cache error
      (redisClient.keys as jest.Mock).mockRejectedValue(new Error('Redis error'));

      // Expect error to be thrown
      await expect(oakApiService.clearCache('keystage')).rejects.toThrow('Redis error');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', () => {
      const status = oakApiService.getRateLimitStatus();

      // Verify status has expected properties
      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('reset');

      // Type check
      expect(typeof status.remaining).toBe('number');
      expect(status.reset === null || status.reset instanceof Date).toBe(true);
    });
  });
});
