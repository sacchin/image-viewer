import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSiteProfile, PRIVATE_PROFILE_MODULE } from '../external/profileLoader';
import { exampleProfile } from '../../shared/sites/example';

const notFound = (id: string) => {
  const err = new Error(`Cannot find module '${id}'`) as Error & { code: string };
  err.code = 'MODULE_NOT_FOUND';
  throw err;
};

test('falls back to the sample profile when the private module is absent', () => {
  const loaded = loadSiteProfile(notFound);
  assert.equal(loaded.isSample, true);
  assert.equal(loaded.profile, exampleProfile);
});

test('uses the private profile when it exports a valid siteProfile', () => {
  const privateProfile = { ...exampleProfile, id: 'private-test', displayName: 'Private' };
  const loaded = loadSiteProfile((id) => {
    assert.equal(id, PRIVATE_PROFILE_MODULE);
    return { siteProfile: privateProfile };
  });
  assert.equal(loaded.isSample, false);
  assert.equal(loaded.profile.id, 'private-test');
});

test('accepts a default export as well', () => {
  const loaded = loadSiteProfile(() => ({ default: { ...exampleProfile, id: 'via-default' } }));
  assert.equal(loaded.isSample, false);
  assert.equal(loaded.profile.id, 'via-default');
});

test('falls back when the private module exports something that is not a profile', () => {
  const loaded = loadSiteProfile(() => ({ siteProfile: { id: 'broken' } }));
  assert.equal(loaded.isSample, true);
  assert.equal(loaded.profile, exampleProfile);
});

test('falls back when the private module throws while loading', () => {
  const loaded = loadSiteProfile(() => {
    throw new Error('syntax error in private profile');
  });
  assert.equal(loaded.isSample, true);
});

test('does not treat a nested missing dependency as "profile absent"', () => {
  // A MODULE_NOT_FOUND for some other module means the private profile exists
  // but is broken; we still fall back, just via the warning path.
  const loaded = loadSiteProfile(() => notFound('some-other-dependency'));
  assert.equal(loaded.isSample, true);
});
