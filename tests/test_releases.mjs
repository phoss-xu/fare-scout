import test from 'node:test';
import assert from 'node:assert/strict';
import {releases, currentRelease} from '../app/static/releases.js';

test('release history has unique identities and honest publication dates', () => {
  assert.equal(currentRelease, releases[0]);
  const identities = new Set();
  let previousDate = '9999-12-31';
  for (const release of releases) {
    const id = release.version || release.revision;
    assert.ok(id && !identities.has(id));
    identities.add(id);
    assert.ok(['preview', 'published'].includes(release.status));
    if (release.version) assert.match(release.version, /^\d+\.\d+\.\d+(?:-preview\.[1-9]\d*)?$/);
    if (release.status === 'preview') {
      assert.match(release.version, /-preview\.[1-9]\d*$/);
      assert.equal(release.date, null);
    } else {
      assert.ok(!release.version?.includes('-preview.'));
      assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Date(`${release.date}T00:00:00Z`).toISOString().slice(0,10), release.date);
      assert.ok(release.date <= previousDate);
      previousDate = release.date;
    }
    assert.ok(release.title.zh && release.title.en);
    assert.ok(release.groups.length);
    for (const group of release.groups) {
      assert.ok(['added', 'improved', 'fixed'].includes(group.type));
      assert.ok(group.items.length);
      for (const item of group.items) assert.ok(item.zh && item.en);
    }
  }
});
