import { describe, expect, test } from 'bun:test';
import { asList, findSensitive, parseArgs, redactSensitive, slugify } from './lib.mjs';

describe('engineering helpers', () => {
  test('slugify produces stable filenames', () => {
    expect(slugify('Mobile Navigation / Before & After')).toBe('mobile-navigation-before-after');
  });

  test('argument parser preserves repeated flags', () => {
    const args = parseArgs(['--check', 'build=passed', '--check', 'e2e=passed', 'query']);
    expect(args.check).toEqual(['build=passed', 'e2e=passed']);
    expect(args._).toEqual(['query']);
  });

  test('list parsing accepts repeated and comma-separated values', () => {
    expect(asList(['ui,mobile', 'regression'])).toEqual(['ui', 'mobile', 'regression']);
  });

  test('secret-like material is detected and redacted', () => {
    const sample = 'password=supersecretvalue12345';
    expect(findSensitive(sample).length).toBeGreaterThan(0);
    expect(redactSensitive(sample)).toContain('[REDACTED:assigned-secret]');
  });
});
