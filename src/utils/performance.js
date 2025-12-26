// Performance monitoring and optimization utilities

// Measure component render time
export const measureRenderTime = (componentName, renderFn) => {
  const startTime = performance.now();
  const result = renderFn();
  const endTime = performance.now();
  const renderTime = endTime - startTime;
  
  if (renderTime > 16) { // More than one frame
    console.warn(`⚠️ ${componentName} took ${renderTime.toFixed(2)}ms to render`);
  }
  
  return result;
};

// Debounce utility for search and other input-heavy operations
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle utility for scroll events
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Virtual scrolling helper for large lists
export const calculateVisibleItems = (containerHeight, itemHeight, scrollTop, totalItems) => {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, totalItems);
  
  return {
    startIndex: Math.max(0, startIndex),
    endIndex,
    offsetY: startIndex * itemHeight
  };
};

// Image lazy loading observer
export const createImageObserver = (callback) => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: '50px 0px',
      threshold: 0.1
    }
  );
  
  return observer;
};

// Memory usage monitoring
export const monitorMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = performance.memory;
    const used = (memory.usedJSHeapSize / 1048576).toFixed(2);
    const total = (memory.totalJSHeapSize / 1048576).toFixed(2);
    const limit = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
    
    console.log(`🧠 Memory Usage: ${used}MB / ${total}MB (limit: ${limit}MB)`);
    
    // Warn if memory usage is high
    if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
      console.warn('⚠️ High memory usage detected. Consider optimizing.');
    }
    
    return {
      used: parseFloat(used),
      total: parseFloat(total),
      limit: parseFloat(limit)
    };
  }
  
  return null;
};

// Network performance monitoring
export const measureNetworkPerformance = (url) => {
  const startTime = performance.now();
  
  return fetch(url)
    .then(response => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const size = response.headers.get('content-length');
      
      console.log(`🌐 Network: ${url} - ${duration.toFixed(2)}ms (${size ? `${(size/1024).toFixed(2)}KB` : 'unknown size'})`);
      
      return response;
    })
    .catch(error => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.error(`❌ Network Error: ${url} - ${duration.toFixed(2)}ms - ${error.message}`);
      throw error;
    });
};

// Cache utility for API responses
export class ResponseCache {
  constructor(maxSize = 50, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  set(key, value) {
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if item is expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

// Create global cache instance
export const apiCache = new ResponseCache();

// Performance marks for measuring user interactions
export const markPerformance = (name) => {
  performance.mark(`${name}-start`);
};

export const measurePerformance = (name) => {
  try {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`);
    
    // Clean up marks and measures
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);
    performance.clearMeasures(name);
    
    return measure.duration;
  } catch (error) {
    console.warn(`Could not measure performance for ${name}:`, error.message);
    return 0;
  }
};

// Batch DOM updates to reduce layout thrashing
export class DOMBatcher {
  constructor() {
    this.pendingUpdates = [];
    this.isScheduled = false;
  }
  
  schedule(updateFn) {
    this.pendingUpdates.push(updateFn);
    
    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }
  
  flush() {
    const updates = this.pendingUpdates.splice(0);
    
    // Batch all DOM reads first
    const reads = updates.filter(update => update.type === 'read');
    reads.forEach(update => update.fn());
    
    // Then batch all DOM writes
    const writes = updates.filter(update => update.type === 'write');
    writes.forEach(update => update.fn());
    
    this.isScheduled = false;
  }
  
  read(fn) {
    this.schedule({ type: 'read', fn });
  }
  
  write(fn) {
    this.schedule({ type: 'write', fn });
  }
}

// Create global DOM batcher instance
export const domBatcher = new DOMBatcher();