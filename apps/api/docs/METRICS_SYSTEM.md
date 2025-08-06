# 📊 Metrics & Monitoring System

## Overview

The Hospeda API features an advanced, in-memory metrics system that tracks performance, usage patterns, and system health without external dependencies. It provides real-time insights with automatic memory management and Prometheus-compatible export.

## 🎯 Key Features

- **🚀 High Performance**: In-memory storage with minimal overhead
- **📈 Advanced Analytics**: P95/P99 percentiles, response time tracking
- **🧠 Memory Management**: Automatic cleanup and intelligent limits
- **📊 Prometheus Compatible**: Ready for production monitoring
- **🔄 Real-time Updates**: Live metrics via `/metrics` endpoint
- **🛡️ Production Ready**: Configurable limits and cleanup strategies

---

## 🏗️ Architecture

### **Core Components**

#### **1. MetricsStore Class**
Central metrics storage with intelligent memory management:

```typescript
class MetricsStore {
  private metrics: Map<string, EndpointMetrics> = new Map();
  private config: MetricsConfig;
  private cleanupInterval?: Timer;

  constructor(config: MetricsConfig) {
    this.config = config;
    this.startPeriodicCleanup();
  }
}
```

#### **2. Endpoint Metrics Tracking**
```typescript
interface EndpointMetrics {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  responseTimes: number[];        // For percentile calculation
  lastAccess: number;            // For cleanup logic
  statusCodes: Map<number, number>; // Status code distribution
}
```

#### **3. Configuration System**
```typescript
interface MetricsConfig {
  maxEndpoints: number;              // Max tracked endpoints (default: 50)
  maxSamplesPerEndpoint: number;     // Max samples per endpoint (default: 200)
  cleanupIntervalMinutes: number;    // Cleanup frequency (default: 5)
  memoryLimitMB: number;            // Memory usage limit (default: 50)
  percentiles: number[];            // Calculated percentiles [95, 99]
}
```

---

## 📊 Collected Metrics

### **Request Metrics**
- **Total Requests**: Count per endpoint
- **Response Times**: Min, max, average, P95, P99
- **Success Rate**: 2xx vs error responses
- **Status Code Distribution**: Detailed status tracking
- **Error Rate**: 4xx and 5xx response tracking

### **System Metrics**
- **Memory Usage**: Real-time memory consumption
- **Active Endpoints**: Currently tracked endpoints
- **Cache Hit Rates**: Response caching effectiveness
- **Rate Limit Violations**: Rate limiting statistics

### **Performance Metrics**
- **Throughput**: Requests per second
- **Latency Percentiles**: P95, P99 response times
- **Slow Requests**: Requests exceeding thresholds
- **Concurrent Requests**: Active request tracking

---

## 🔧 Configuration

### **Environment Variables**
```env
# Metrics Configuration
METRICS_ENABLED=true
METRICS_ENDPOINT_ENABLED=true
METRICS_DETAILED_ENABLED=true
METRICS_MEMORY_ENABLED=true
METRICS_PROMETHEUS_ENABLED=true

# Performance Tuning
METRICS_MAX_ENDPOINTS=50
METRICS_MAX_SAMPLES_PER_ENDPOINT=200
METRICS_CLEANUP_INTERVAL_MINUTES=5
METRICS_MEMORY_LIMIT_MB=50
METRICS_PERCENTILES=95,99
```

### **Programmatic Configuration**
```typescript
import { configureMetrics } from './middlewares/metrics';

// Custom configuration
configureMetrics({
  maxEndpoints: 100,
  maxSamplesPerEndpoint: 500,
  cleanupIntervalMinutes: 10,
  memoryLimitMB: 100,
  percentiles: [90, 95, 99]
});
```

---

## 📈 Usage Examples

### **Basic Metrics Collection**
Metrics are automatically collected for all requests:

```typescript
// Automatic tracking via middleware
app.use(metricsMiddleware);

// Every request automatically tracks:
// - Response time
// - Status code  
// - Endpoint path
// - Success/error rates
```

### **Custom Metrics**
```typescript
import { recordCustomMetric, incrementCounter } from './middlewares/metrics';

// Custom business metrics
export const trackUserAction = (action: string, userId: string) => {
  incrementCounter(`user_actions.${action}`, {
    userId,
    timestamp: Date.now()
  });
};

// Performance tracking
export const trackDatabaseQuery = async (query: string) => {
  const startTime = Date.now();
  
  try {
    const result = await executeQuery(query);
    recordCustomMetric('database.query.success', Date.now() - startTime);
    return result;
  } catch (error) {
    recordCustomMetric('database.query.error', Date.now() - startTime);
    throw error;
  }
};
```

### **Accessing Metrics Data**
```typescript
import { getMetrics, getDetailedMetrics, getMemoryStats } from './middlewares/metrics';

// Basic metrics summary
const summary = getMetrics();
console.log(`Total requests: ${summary.totalRequests}`);
console.log(`Average response time: ${summary.averageResponseTime}ms`);

// Detailed per-endpoint metrics
const detailed = getDetailedMetrics();
for (const [endpoint, metrics] of Object.entries(detailed.endpoints)) {
  console.log(`${endpoint}: ${metrics.count} requests, P95: ${metrics.p95}ms`);
}

// Memory usage statistics
const memory = getMemoryStats();
console.log(`Memory usage: ${memory.usedMB}MB / ${memory.limitMB}MB`);
```

---

## 🌐 Metrics Endpoint

### **GET /metrics**
Returns comprehensive metrics in multiple formats:

#### **JSON Format (Default)**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRequests": 15420,
      "totalErrors": 89,
      "averageResponseTime": 156.7,
      "successRate": 99.42,
      "uptime": 3600000,
      "memoryUsage": {
        "usedMB": 23.5,
        "limitMB": 50,
        "percentageUsed": 47
      }
    },
    "endpoints": {
      "GET /api/v1/users": {
        "count": 1250,
        "averageTime": 89.3,
        "minTime": 12,
        "maxTime": 456,
        "p95": 178,
        "p99": 234,
        "errorRate": 0.8,
        "statusCodes": {
          "200": 1240,
          "400": 8,
          "500": 2
        }
      }
    }
  }
}
```

#### **Prometheus Format**
```
# Request metrics
http_requests_total{endpoint="GET /api/v1/users"} 1250
http_request_duration_seconds{endpoint="GET /api/v1/users",quantile="0.95"} 0.178
http_request_duration_seconds{endpoint="GET /api/v1/users",quantile="0.99"} 0.234

# System metrics
process_memory_usage_bytes 24641536
http_requests_rate_total 4.27
```

### **Query Parameters**
```
GET /metrics?format=prometheus     # Prometheus format
GET /metrics?format=json          # JSON format (default)
GET /metrics?detailed=true        # Include detailed breakdowns
GET /metrics?reset=true           # Reset metrics after reading
```

---

## 🧠 Memory Management

### **Automatic Cleanup Strategy**

#### **1. Periodic Cleanup**
```typescript
// Runs every 5 minutes (configurable)
private performCleanup() {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [endpoint, metrics] of this.metrics.entries()) {
    if (now - metrics.lastAccess > maxAge) {
      this.removeEndpoint(endpoint);
    }
  }
}
```

#### **2. Memory Limit Enforcement**
```typescript
private enforceMemoryLimit() {
  const memoryUsage = this.calculateMemoryUsage();
  
  if (memoryUsage > this.config.memoryLimitMB) {
    // Remove least recently used endpoints
    this.removeLRUEndpoints();
  }
}
```

#### **3. Sample Limit Management**
```typescript
recordResponseTime(endpoint: string, time: number) {
  const metrics = this.getOrCreateMetrics(endpoint);
  
  // Limit samples per endpoint
  if (metrics.responseTimes.length >= this.config.maxSamplesPerEndpoint) {
    metrics.responseTimes.shift(); // Remove oldest sample
  }
  
  metrics.responseTimes.push(time);
}
```

### **Memory Usage Monitoring**
```typescript
export const getMemoryStats = () => {
  const used = calculateCurrentMemoryUsage();
  const limit = config.memoryLimitMB;
  
  return {
    usedMB: Math.round(used * 100) / 100,
    limitMB: limit,
    percentageUsed: Math.round((used / limit) * 100),
    endpointCount: store.size,
    totalSamples: getTotalSampleCount()
  };
};
```

---

## 📊 Advanced Analytics

### **Percentile Calculations**
```typescript
calculatePercentiles(responseTimes: number[]): PercentileData {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  
  return this.config.percentiles.reduce((acc, p) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    acc[`p${p}`] = sorted[Math.max(0, index)] || 0;
    return acc;
  }, {} as PercentileData);
}
```

### **Trend Analysis**
```typescript
export const getTrends = (timeWindow: number = 3600000) => {
  const now = Date.now();
  const windowStart = now - timeWindow;
  
  return {
    requestRate: calculateRequestRate(windowStart, now),
    errorRate: calculateErrorRate(windowStart, now),
    performanceTrend: calculatePerformanceTrend(windowStart, now),
    slowestEndpoints: getSlowesEndpoints(5)
  };
};
```

### **Alerting Thresholds**
```typescript
export const checkAlerts = () => {
  const metrics = getMetrics();
  const alerts = [];
  
  // High error rate
  if (metrics.errorRate > 5) {
    alerts.push({
      level: 'warning',
      message: `High error rate: ${metrics.errorRate}%`,
      threshold: 5
    });
  }
  
  // Slow response times
  if (metrics.averageResponseTime > 1000) {
    alerts.push({
      level: 'critical',
      message: `Slow responses: ${metrics.averageResponseTime}ms avg`,
      threshold: 1000
    });
  }
  
  return alerts;
};
```

---

## 🧪 Testing Metrics

### **Test Utilities**
```typescript
// test/utils/metrics-testing.ts
export const createMetricsTestSuite = () => {
  let originalStore: MetricsStore;
  
  beforeEach(() => {
    originalStore = getCurrentStore();
    resetMetrics(); // Clean slate for each test
  });
  
  afterEach(() => {
    restoreStore(originalStore);
  });
};

export const simulateRequests = async (
  endpoint: string, 
  count: number,
  responseTimeRange: [number, number] = [10, 200]
) => {
  for (let i = 0; i < count; i++) {
    const responseTime = Math.random() * 
      (responseTimeRange[1] - responseTimeRange[0]) + responseTimeRange[0];
    
    recordRequest(endpoint, responseTime, 200);
  }
};
```

### **Performance Testing**
```typescript
describe('Metrics Performance', () => {
  it('should handle high-frequency requests', async () => {
    const startTime = Date.now();
    
    // Simulate 10,000 requests
    for (let i = 0; i < 10000; i++) {
      recordRequest('/test', Math.random() * 100, 200);
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    
    const metrics = getMetrics();
    expect(metrics.totalRequests).toBe(10000);
  });
  
  it('should maintain memory limits', async () => {
    // Create many unique endpoints
    for (let i = 0; i < 1000; i++) {
      recordRequest(`/endpoint-${i}`, 100, 200);
    }
    
    const memoryStats = getMemoryStats();
    expect(memoryStats.endpointCount).toBeLessThanOrEqual(50); // Configured limit
    expect(memoryStats.usedMB).toBeLessThanOrEqual(50); // Memory limit
  });
});
```

---

## 🚀 Production Best Practices

### **Configuration Recommendations**

#### **High Traffic APIs**
```env
METRICS_MAX_ENDPOINTS=100
METRICS_MAX_SAMPLES_PER_ENDPOINT=500
METRICS_CLEANUP_INTERVAL_MINUTES=2
METRICS_MEMORY_LIMIT_MB=100
```

#### **Standard APIs**
```env
METRICS_MAX_ENDPOINTS=50
METRICS_MAX_SAMPLES_PER_ENDPOINT=200
METRICS_CLEANUP_INTERVAL_MINUTES=5
METRICS_MEMORY_LIMIT_MB=50
```

#### **Low Resource Environments**
```env
METRICS_MAX_ENDPOINTS=25
METRICS_MAX_SAMPLES_PER_ENDPOINT=100
METRICS_CLEANUP_INTERVAL_MINUTES=10
METRICS_MEMORY_LIMIT_MB=25
```

### **Monitoring Integration**
```typescript
// External monitoring integration
setInterval(() => {
  const metrics = getMetrics();
  
  // Send to external monitoring service
  if (externalMonitoring.enabled) {
    externalMonitoring.send({
      timestamp: Date.now(),
      metrics: {
        requests_per_second: metrics.requestRate,
        average_response_time: metrics.averageResponseTime,
        error_rate: metrics.errorRate,
        memory_usage: getMemoryStats().usedMB
      }
    });
  }
}, 60000); // Every minute
```

### **Alerting Setup**
```typescript
// Production alerting
const alerts = checkAlerts();
if (alerts.length > 0) {
  alerts.forEach(alert => {
    if (alert.level === 'critical') {
      notificationService.sendCriticalAlert(alert);
    } else {
      logger.warn('Metrics alert', alert);
    }
  });
}
```

---

## 🔍 Troubleshooting

### **Common Issues**

#### **High Memory Usage**
```bash
# Check memory stats
curl /metrics?format=json | jq '.data.summary.memoryUsage'

# Solutions:
# 1. Reduce maxSamplesPerEndpoint
# 2. Increase cleanup frequency
# 3. Reduce maxEndpoints
```

#### **Missing Metrics**
```typescript
// Verify middleware is applied
app.use(metricsMiddleware); // Must be early in middleware stack

// Check if metrics are enabled
console.log('Metrics enabled:', env.METRICS_ENABLED);
```

#### **Performance Impact**
```typescript
// Monitor metrics collection overhead
const before = process.hrtime.bigint();
recordRequest('/test', 100, 200);
const after = process.hrtime.bigint();
const overhead = Number(after - before) / 1000000; // Convert to ms

console.log(`Metrics overhead: ${overhead}ms`);
```

---

## 📚 Related Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Metrics configuration
- [Performance Testing](./TESTING_GUIDE.md#performance-testing) - Testing metrics
- [Middleware System](./COMPLETE_API_GUIDE.md#middleware-system) - Integration details
- [Route Factory System](./ROUTE_FACTORY_SYSTEM.md) - Automatic metrics collection

---

*The metrics system provides comprehensive monitoring without external dependencies while maintaining high performance. Last updated: 2024-12-19*
