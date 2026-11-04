const fs = require('fs');
const path = require('path');
const { nextVersion } = require('../set-version');

const ROOT = path.join(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const version = app.expo.version;

// The top "## x.y.z — date" entry of CHANGELOG.md and its bullet lines.
function latestEntry() {
  const [, entry = ''] = read('CHANGELOG.md').split(/^## /m);
  const [heading, ...body] = entry.split('\n');
  return { heading, bullets: body.filter(line => line.startsWith('- ')) };
}

describe('nextVersion', () => {
  it.each([
    ['1.0.0', 'patch', '1.0.1'],
    ['1.0.9', 'minor', '1.1.0'],
    ['1.4.2', 'major', '2.0.0'],
    ['1.0.0', '1.2.0', '1.2.0'],
  ])('%s + %s → %s', (current, bump, expected) => {
    expect(nextVersion(current, bump)).toBe(expected);
  });

  it.each([
    ['1.0.0', 'bump'], ['1.0.0', undefined], ['1.0.1', '1.0.0'], ['1.0.1', '1.0.1'], ['1.0', 'patch'],
  ])('refuses %s + %s', (current, bump) => {
    expect(() => nextVersion(current, bump)).toThrow();
  });
});

// RELEASING.md: one version name, set with `npm run set-version`, and a
// changelog entry for it that doubles as Play's "What's new".
describe('release version', () => {
  it('is x.y.z and the same in app.json, package.json and package-lock.json', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).toBe(version);
    expect(lock.version).toBe(version);
    expect(lock.packages[''].version).toBe(version);
  });

  it('heads CHANGELOG.md', () => {
    expect(latestEntry().heading).toMatch(new RegExp(`^${version.replace(/\./g, '\\.')} — \\d{4}-\\d{2}-\\d{2}$`));
  });

  it('has Play release notes within its 500-character limit', () => {
    const { bullets } = latestEntry();
    expect(bullets.length).toBeGreaterThan(0);
    expect(bullets.join('\n').length).toBeLessThanOrEqual(500);
  });
});
