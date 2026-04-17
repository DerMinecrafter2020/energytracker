import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) =>
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const bumpDigitVersion = (version) => {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected x.y.z`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  patch += 1;
  if (patch > 9) {
    patch = 0;
    minor += 1;
  }
  if (minor > 9) {
    minor = 0;
    major += 1;
  }

  return `${major}.${minor}.${patch}`;
};

const pkg = readJson(packageJsonPath);
const oldVersion = pkg.version;
const newVersion = bumpDigitVersion(oldVersion);

pkg.version = newVersion;
writeJson(packageJsonPath, pkg);

if (fs.existsSync(packageLockPath)) {
  const lock = readJson(packageLockPath);

  lock.version = newVersion;

  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
  }

  writeJson(packageLockPath, lock);
}

console.log(`Version bumped: ${oldVersion} -> ${newVersion}`);
