export type TestCase = {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration?: number;
  error?: string;
};

export type TestSuite = {
  name: string;
  tests: TestCase[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
};

export type TestResult = {
  target: 'backend' | 'frontend';
  code: number;
  durationMs: number;
  output: string;
  skipped?: boolean;
  skipReason?: string;
  suites?: TestSuite[];
  summary?: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
  };
};

export type TestRunSummary = {
  ran: number;
  skipped: number;
  failed: number;
};
