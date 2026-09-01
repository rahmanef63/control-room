import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveBuildId } from '../../../build-id.mjs';

describe('resolveBuildId', () => {
  test('prefers explicit PUBLIC_BUILD_ID release labels verbatim', () => {
    assert.equal(resolveBuildId({ PUBLIC_BUILD_ID: 'release-2026.08.31' }, '/tmp'), 'release-2026.08.31');
  });

  test('normalizes long commit hashes to the shared 12-character deploy id', () => {
    assert.equal(
      resolveBuildId({ COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567' }, '/tmp'),
      '0123456789ab'
    );
  });

  test('uses CI precedence before lower-priority commit sources', () => {
    assert.equal(
      resolveBuildId({ GITHUB_SHA: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd', COMMIT_SHA: '1111111111111111' }, '/tmp'),
      'abcdefabcdef'
    );
  });
});
