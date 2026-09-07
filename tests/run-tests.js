const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 =========================================');
console.log('   SVI DigiCash - Full Test Suite');
console.log('===========================================\n');

const tests = [
  { name: 'Signature Utilities', file: 'test-signature.js' },
  { name: 'Pay API', file: 'test-pay.js' },
  { name: 'Payout API', file: 'test-payout.js' },
  { name: 'Status API', file: 'test-status.js' },
  { name: 'Callback Handling', file: 'test-callback.js' }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n🚀 Running: ${test.name}`);
    console.log('-------------------------------------------');
    
    const child = spawn('node', [path.join(__dirname, test.file)], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${test.name}: PASSED`);
        resolve({ name: test.name, passed: true });
      } else {
        console.log(`\n❌ ${test.name}: FAILED (exit code: ${code})`);
        resolve({ name: test.name, passed: false, code });
      }
    });
    
    child.on('error', (error) => {
      console.log(`\n❌ ${test.name}: ERROR - ${error.message}`);
      resolve({ name: test.name, passed: false, error: error.message });
    });
  });
}

async function runAllTests() {
  const startTime = Date.now();
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n===========================================');
  console.log('   Full Test Suite Summary');
  console.log('===========================================');
  console.log(`⏱️  Total Time: ${totalTime}s`);
  console.log(`📋 Tests Run: ${results.length}`);
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  console.log('\n📊 Detailed Results:');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`   ${status} ${r.name}`);
  });
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! SVI DigiCash integration is ready.');
  }
}

runAllTests();