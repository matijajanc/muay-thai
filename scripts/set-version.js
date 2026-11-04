#!/usr/bin/env node
// Sets the app's version name everywhere it's written: app.json (expo.version,
// what Play and Settings show), package.json and package-lock.json. The build
// number (Android versionCode) is EAS's own: +1 on every production build.
// See RELEASING.md.
//
//   npm run set-version -- patch | minor | major | 1.2.3

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const parts = (version) => version.match(SEMVER).slice(1).map(Number);
const isHigher = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  const i = x.findIndex((n, k) => n !== y[k]);
  return i >= 0 && x[i] > y[i];
};

// "1.0.0" + "patch" → "1.0.1"; an explicit x.y.z must be higher than current.
function nextVersion(current, bump) {
  if (!SEMVER.test(current)) throw new Error(`current version "${current}" isn't x.y.z`);
  const [major, minor, patch] = parts(current);
  let next;
  if (bump === 'major') next = `${major + 1}.0.0`;
  else if (bump === 'minor') next = `${major}.${minor + 1}.0`;
  else if (bump === 'patch') next = `${major}.${minor}.${patch + 1}`;
  else if (SEMVER.test(bump ?? '')) next = bump;
  else throw new Error(`expected patch, minor, major or x.y.z, got "${bump ?? ''}"`);
  if (!isHigher(next, current)) throw new Error(`${next} isn't higher than ${current}`);
  return next;
}

const file = (name) => path.join(ROOT, name);
const readJSON = (name) => JSON.parse(fs.readFileSync(file(name), 'utf8'));
const writeJSON = (name, data) => fs.writeFileSync(file(name), `${JSON.stringify(data, null, 2)}\n`);

function setVersion(bump) {
  const app = readJSON('app.json');
  const version = nextVersion(app.expo.version, bump);
  app.expo.version = version;
  writeJSON('app.json', app);

  const pkg = readJSON('package.json');
  pkg.version = version;
  writeJSON('package.json', pkg);

  const lock = readJSON('package-lock.json');
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  writeJSON('package-lock.json', lock);
  return version;
}

if (require.main === module) {
  try {
    const version = setVersion(process.argv[2]);
    console.log(`Version ${version}. Next: a "## ${version}" entry at the top of CHANGELOG.md.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { nextVersion };
