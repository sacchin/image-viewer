import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeFolderName, MAX_FOLDER_NAME_LENGTH } from '../sanitizeFolderName';

test('replaces Windows-forbidden characters with underscores', () => {
  assert.equal(sanitizeFolderName('Title: with/special*chars?'), 'Title_with_special_chars_');
  assert.equal(sanitizeFolderName('Title<>with|pipe"and*quote'), 'Title_with_pipe_and_quote');
  assert.equal(sanitizeFolderName('Title\\with\\backslash'), 'Title_with_backslash');
});

test('keeps characters that are legal in folder names', () => {
  assert.equal(sanitizeFolderName('[Author] Sample Gallery (Series)'), '[Author]_Sample_Gallery_(Series)');
});

test('collapses runs of whitespace and underscores', () => {
  assert.equal(
    sanitizeFolderName('Title    with___multiple     spaces___and___underscores'),
    'Title_with_multiple_spaces_and_underscores'
  );
});

test('strips leading and trailing dots', () => {
  assert.equal(sanitizeFolderName('...Title with dots...'), 'Title_with_dots');
});

test('truncates to the maximum folder name length', () => {
  const result = sanitizeFolderName('A'.repeat(250));
  assert.equal(result.length, MAX_FOLDER_NAME_LENGTH);
  assert.equal(result, 'A'.repeat(MAX_FOLDER_NAME_LENGTH));
});

test('falls back to a gallery_<timestamp> name when nothing is left', () => {
  assert.match(sanitizeFolderName(''), /^gallery_\d+$/);
  assert.match(sanitizeFolderName('...'), /^gallery_\d+$/);
});
