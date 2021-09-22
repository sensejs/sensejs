import {matchLabels} from '../src/utils/match-labels.js';

test('matchLabel', () => {
  expect(matchLabels(new Set([]))).toBeTruthy();

  expect(matchLabels(new Set(['foo']))).toBeTruthy();

  expect(matchLabels(new Set(['foo']), ['bar'])).toBeFalsy();

  expect(matchLabels(new Set(['foo', 'bar']), ['foo'])).toBeTruthy();

  expect(matchLabels(new Set(['foo']), ['foo', 'bar'])).toBeFalsy();

  expect(matchLabels(new Set(['foo', 'bar']), ['foo', 'bar'])).toBeTruthy();

  expect(matchLabels(new Set(), () => true)).toBeTruthy();

  expect(matchLabels(new Set(), () => false)).toBeFalsy();
});
