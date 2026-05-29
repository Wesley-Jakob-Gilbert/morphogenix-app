#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1] || '';
}

const projectRoot = path.resolve(__dirname, '..');
const appJsonPath = path.join(projectRoot, 'app.json');
const outputDir = readArg('--output-dir') || 'dist';
const hasBaseUrlArg = process.argv.includes('--base-url');
const baseUrl = hasBaseUrlArg ? readArg('--base-url') : undefined;
const originalAppJson = fs.readFileSync(appJsonPath, 'utf8');

function restoreAppJson() {
  fs.writeFileSync(appJsonPath, originalAppJson);
}

try {
  const config = JSON.parse(originalAppJson);
  config.expo = config.expo || {};

  if (baseUrl && baseUrl.length > 0) {
    config.expo.experiments = config.expo.experiments || {};
    config.expo.experiments.baseUrl = baseUrl;
  } else if (config.expo.experiments) {
    delete config.expo.experiments.baseUrl;
    if (Object.keys(config.expo.experiments).length === 0) {
      delete config.expo.experiments;
    }
  }

  fs.writeFileSync(appJsonPath, `${JSON.stringify(config, null, 2)}\n`);

  fs.rmSync(path.join(projectRoot, outputDir), { recursive: true, force: true });

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['expo', 'export', '--platform', 'web', '--output-dir', outputDir],
    { cwd: projectRoot, stdio: 'inherit', env: process.env }
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status || 0;
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
} finally {
  restoreAppJson();
}
