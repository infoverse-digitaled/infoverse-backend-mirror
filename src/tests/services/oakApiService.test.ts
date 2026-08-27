import axios, { AxiosInstance } from 'axios';
import { OakApiService, RedisClientInterface } from '../../services/oakApiService';
import { KeyStage } from '../../services/oakApiTypes';

// Mock config
jest.mock('../../config', () => {
  const mockConfig = {
    oak: {
      apiBaseUrl: 'http://mock-api',
      apiKey: 'mock-key',
      rateLimit: 100,
    },
    redis: {
      url: 'redis://mock:6379',
      port: 6379,
    },
  };
  return {
    __esModule: true,
    default: mockConfig,
    ...mockConfig,
  };
});

// The service is exercised via DI with a mock redis client below; prevent the
// module-level `import redisClient from '../config/redis'` in oakApiService.ts
// from opening a real connection during tests.
jest.mock('../../config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    setEx: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock axios.isAxiosError for error handling
jest
  .spyOn(axios, 'isAxiosError')
  .mockImplementation(
    (payload: unknown) => (payload as { isAxiosError?: boolean })?.isAxiosError === true,
  );

// Create mock Redis client
const createMockRedis = (): jest.Mocked<RedisClientInterface> => ({
  get: jest.fn(),
  setEx: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
});

// Create mock Axios instance
const createMockAxios = () => ({
  get: jest.fn(),
  interceptors: {
    response: {
      use: jest.fn(),
    },
  },
});

describe('OakApiService', () => {
  let mockRedis: jest.Mocked<RedisClientInterface>;
  let mockAxiosInstance: ReturnType<typeof createMockAxios>;
  let service: OakApiService;

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

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRedis = createMockRedis();
    mockAxiosInstance = createMockAxios();
    service = new OakApiService(mockRedis, mockAxiosInstance as unknown as AxiosInstance);
  });

  describe('getKeyStages', () => {
    it('should return key stages data correctly from API', async () => {
      // Mock cache miss (no cached data)
      mockRedis.get.mockResolvedValue(null);

      // Mock successful API response
      mockAxiosInstance.get.mockResolvedValue({ data: mockKeyStages });

      const result = await service.getKeyStages();

      // Verify the result
      expect(result).toEqual(mockKeyStages);
      expect(result).toHaveLength(4);
      expect(result[0].title).toBe('Key Stage 1');

      // Verify cache was checked
      expect(mockRedis.get).toHaveBeenCalledWith('oak:keystages');

      // Verify cache was set with correct TTL (24 hours = 86400 seconds)
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        'oak:keystages',
        86400,
        JSON.stringify(mockKeyStages),
      );
    });

    it('should use cached data on second call', async () => {
      const cachedData = JSON.stringify(mockKeyStages);

      // Mock cache hit (cached data exists)
      mockRedis.get.mockResolvedValue(cachedData);

      const result = await service.getKeyStages();

      // Verify the result is from cache
      expect(result).toEqual(mockKeyStages);

      // Verify cache was checked
      expect(mockRedis.get).toHaveBeenCalledWith('oak:keystages');

      // Verify API was NOT called (data came from cache)
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();

      // Verify cache was NOT set again
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    it('should handle errors when Oak API is down', async () => {
      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock API error (network error)
      mockAxiosInstance.get.mockRejectedValue({
        message: 'Network Error',
        isAxiosError: true,
      });

      // Expect the call to throw an error
      await expect(service.getKeyStages()).rejects.toMatchObject({
        message: 'Network Error',
        statusCode: 500,
      });

      // Verify cache was checked
      expect(mockRedis.get).toHaveBeenCalledWith('oak:keystages');

      // Verify cache was NOT set (due to error)
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    it('should handle 404 errors from Oak API', async () => {
      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock API error (404 Not Found)
      mockAxiosInstance.get.mockRejectedValue({
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
      await expect(service.getKeyStages()).rejects.toMatchObject({
        message: 'Resource not found',
        statusCode: 404,
        error: 'Not Found',
      });
    });

    it('should handle rate limit errors (429)', async () => {
      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock rate limit error
      mockAxiosInstance.get.mockRejectedValue({
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
      await expect(service.getKeyStages()).rejects.toMatchObject({
        message: 'Rate limit exceeded',
        statusCode: 429,
      });
    });

    it('should continue if cache get fails but API succeeds', async () => {
      // Mock cache error
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));

      // Mock successful API response
      mockAxiosInstance.get.mockResolvedValue({ data: mockKeyStages });

      // Spy on console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getKeyStages();

      // Verify the result is from API
      expect(result).toEqual(mockKeyStages);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OakAPI Cache] Get error for key oak:keystages:',
        expect.any(Error),
      );

      // Verify API was called (fallback after cache error)
      expect(mockAxiosInstance.get).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should continue if cache set fails but data is returned', async () => {
      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock cache set error
      mockRedis.setEx.mockRejectedValue(new Error('Redis write error'));

      // Mock successful API response
      mockAxiosInstance.get.mockResolvedValue({ data: mockKeyStages });

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getKeyStages();

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
      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.del.mockResolvedValue(mockKeys.length);

      const result = await service.clearCache('keystage');

      // Verify keys were fetched with correct pattern
      expect(mockRedis.keys).toHaveBeenCalledWith('oak:keystage*');

      // Verify keys were deleted
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys);

      // Verify correct count returned
      expect(result).toBe(3);
    });

    it('should return 0 when no keys match pattern', async () => {
      // Mock empty keys result
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.clearCache('nonexistent');

      // Verify no deletion attempted
      expect(mockRedis.del).not.toHaveBeenCalled();

      // Verify 0 returned
      expect(result).toBe(0);
    });

    it('should throw error when cache clear fails', async () => {
      // Mock cache error
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      // Expect error to be thrown
      await expect(service.clearCache('keystage')).rejects.toThrow('Redis error');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', () => {
      const status = service.getRateLimitStatus();

      // Verify status has expected properties
      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('reset');

      // Type check
      expect(typeof status.remaining).toBe('number');
      expect(status.reset === null || status.reset instanceof Date).toBe(true);
    });
  });
});
