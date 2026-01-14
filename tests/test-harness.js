const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function run() {
  let failed = 0;

  tests.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(err);
    }
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

module.exports = { test, run };
