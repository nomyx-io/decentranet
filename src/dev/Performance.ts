// Performance.ts

import { EventEmitter } from '../utils/EventEmitter';
import { performance as nodePerformance } from 'perf_hooks';
import { Logger } from '../Logger';

interface TimingData {
  start: number;
  end: number;
  duration: number;
}

interface MetricData {
  count: number;
  total: number;
  min: number;
  max: number;
  average: number;
}

export class Performance extends EventEmitter {
  private timings: Map<string, TimingData[]> = new Map();
  private metrics: Map<string, MetricData> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  private getTimestamp(): number {
    if (typeof window !== 'undefined' && window.performance && window.performance.now) {
      return window.performance.now();
    }
    return nodePerformance.now();
  }

  startTiming(label: string): void {
    if (!this.timings.has(label)) {
      this.timings.set(label, []);
    }
    this.timings.get(label)!.push({ start: this.getTimestamp(), end: 0, duration: 0 });
    this.logger.debug(`Timing started: ${label}`, 'Performance');
  }

  endTiming(label: string): number {
    const timings = this.timings.get(label);
    if (!timings || timings.length === 0) {
      this.logger.warn(`No timing started for: ${label}`, 'Performance');
      return 0;
    }

    const timing = timings[timings.length - 1];
    timing.end = this.getTimestamp();
    timing.duration = timing.end - timing.start;

    this.logger.debug(`Timing ended: ${label}`, 'Performance', { duration: timing.duration });
    this.emit('timingComplete', { label, duration: timing.duration });

    return timing.duration;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { count: 0, total: 0, min: Infinity, max: -Infinity, average: 0 });
    }

    const metric = this.metrics.get(name)!;
    metric.count++;
    metric.total += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.average = metric.total / metric.count;

    this.logger.debug(`Metric recorded: ${name}`, 'Performance', { value });
    this.emit('metricRecorded', { name, value });
  }

  trackMemoryUsage(interval: number = 60000): () => void {
    const trackMemory = () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        this.recordMetric('memory.rss', usage.rss);
        this.recordMetric('memory.heapTotal', usage.heapTotal);
        this.recordMetric('memory.heapUsed', usage.heapUsed);
        this.recordMetric('memory.external', usage.external);
      } else if (typeof window !== 'undefined' && (window.performance as any).memory) {
        const memory = (window.performance as any).memory;
        this.recordMetric('memory.jsHeapSizeLimit', memory.jsHeapSizeLimit);
        this.recordMetric('memory.totalJSHeapSize', memory.totalJSHeapSize);
        this.recordMetric('memory.usedJSHeapSize', memory.usedJSHeapSize);
      }
    };

    const timer = setInterval(trackMemory, interval);
    return () => clearInterval(timer);
  }

  getTimings(label: string): TimingData[] {
    return this.timings.get(label) || [];
  }

  getMetric(name: string): MetricData | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Map<string, MetricData> {
    return new Map(this.metrics);
  }

  clearTimings(): void {
    this.timings.clear();
    this.logger.info('All timings cleared', 'Performance');
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.logger.info('All metrics cleared', 'Performance');
  }

  generateReport(): string {
    let report = "Performance Report\n==================\n\n";

    report += "Timings:\n";
    for (const [label, timings] of this.timings.entries()) {
      const averageDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
      report += `${label}: ${averageDuration.toFixed(2)}ms (${timings.length} samples)\n`;
    }

    report += "\nMetrics:\n";
    for (const [name, metric] of this.metrics.entries()) {
      report += `${name}: avg=${metric.average.toFixed(2)}, min=${metric.min}, max=${metric.max}, count=${metric.count}\n`;
    }

    return report;
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startTiming(label);
    try {
      const result = await fn();
      return result;
    } finally {
      this.endTiming(label);
    }
  }

  measure<T>(label: string, fn: () => T): T {
    this.startTiming(label);
    try {
      return fn();
    } finally {
      this.endTiming(label);
    }
  }

  startProfiling(label: string): void {
    if (typeof console !== 'undefined' && console.profile) {
      console.profile(label);
    }
  }

  endProfiling(label: string): void {
    if (typeof console !== 'undefined' && console.profileEnd) {
      console.profileEnd(label);
    }
  }

  measureOperationTime<T>(label: string, fn: () => T): T {
    this.startProfiling(label);
    try {
      return fn();
    } finally {
      this.endProfiling(label);
    }
  }
}

// Singleton instance
export const performance = new Performance();

// Decorator for measuring method performance
export function Measure(label?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const measureLabel = label || `${target.constructor.name}.${propertyKey}`;
      return performance.measure(measureLabel, () => originalMethod.apply(this, args));
    };
    return descriptor;
  };
}

// Decorator for measuring async method performance
export function MeasureAsync(label?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const measureLabel = label || `${target.constructor.name}.${propertyKey}`;
      return performance.measureAsync(measureLabel, () => originalMethod.apply(this, args));
    };
    return descriptor;
  };
}