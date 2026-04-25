/**
 * Test Storage - localStorage API for individual tests and suites
 */

const TESTS_KEY = 'cli-tests';
const SUITES_KEY = 'cli-suites';

// ============ Individual Tests ============

export function getTests() {
  try {
    const data = localStorage.getItem(TESTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTest(test) {
  const tests = getTests();
  const newTest = {
    ...test,
    id: test.id || `test-${Date.now()}`,
    createdAt: test.createdAt || new Date().toISOString()
  };

  // Check if updating existing test
  const existingIndex = tests.findIndex(t => t.id === newTest.id);
  if (existingIndex >= 0) {
    tests[existingIndex] = newTest;
  } else {
    tests.push(newTest);
  }

  localStorage.setItem(TESTS_KEY, JSON.stringify(tests));
  return newTest;
}

export function deleteTest(id) {
  const tests = getTests().filter(t => t.id !== id);
  localStorage.setItem(TESTS_KEY, JSON.stringify(tests));

  // Also remove from any suites
  const suites = getSuites();
  const updatedSuites = suites.map(suite => ({
    ...suite,
    testIds: suite.testIds.filter(testId => testId !== id)
  }));
  localStorage.setItem(SUITES_KEY, JSON.stringify(updatedSuites));
}

export function getTestById(id) {
  return getTests().find(t => t.id === id);
}

// ============ Test Suites ============

export function getSuites() {
  try {
    const data = localStorage.getItem(SUITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSuite(suite) {
  const suites = getSuites();
  const newSuite = {
    ...suite,
    id: suite.id || `suite-${Date.now()}`,
    createdAt: suite.createdAt || new Date().toISOString()
  };

  // Check if updating existing suite
  const existingIndex = suites.findIndex(s => s.id === newSuite.id);
  if (existingIndex >= 0) {
    suites[existingIndex] = newSuite;
  } else {
    suites.push(newSuite);
  }

  localStorage.setItem(SUITES_KEY, JSON.stringify(suites));
  return newSuite;
}

export function deleteSuite(id) {
  const suites = getSuites().filter(s => s.id !== id);
  localStorage.setItem(SUITES_KEY, JSON.stringify(suites));
}

export function getSuiteById(id) {
  return getSuites().find(s => s.id === id);
}

// ============ Helper Functions ============

/**
 * Get full test objects for a suite
 */
export function getTestsForSuite(suiteId) {
  const suite = getSuiteById(suiteId);
  if (!suite) return [];

  const allTests = getTests();
  return suite.testIds
    .map(id => allTests.find(t => t.id === id))
    .filter(Boolean);
}

/**
 * Format tests for API execution
 */
export function formatTestsForExecution(tests) {
  return tests.map(test => ({
    id: test.id,
    name: test.name,
    executable: test.executable,
    args: typeof test.args === 'string' ? test.args.split(/\s+/).filter(Boolean) : test.args,
    cwd: test.cwd || undefined,
    expectations: test.expectations || {}
  }));
}
