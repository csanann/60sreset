import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseModelOutput, parseReflection, parseResetResponse, MOCK_LABEL, GEMINI_LABEL,
  validateThought, isClearlyNonMeaningfulThought, THOUGHT_CONTENT_MESSAGE } from '../src/lib/reset-contract.ts';
import { acceptedThoughts, rejectedThoughts } from './fixtures/thoughts.mjs';

test('shared validation rejects only the focused non-meaningful fixtures', () => {
  for (const text of rejectedThoughts) {
    assert.equal(isClearlyNonMeaningfulThought(text), true, JSON.stringify(text));
    assert.equal(validateThought(text), THOUGHT_CONTENT_MESSAGE, JSON.stringify(text));
  }
  for (const text of ['', ' \n\t\u00a0']) assert.ok(validateThought(text));
});

test('short, emotional, ambiguous and multilingual thoughts pass without rewriting', () => {
  for (const text of acceptedThoughts) assert.equal(validateThought(text), null, JSON.stringify(text));
  assert.equal(validateThought('ab'.repeat(1000)), null);
  assert.match(validateThought('ab'.repeat(1000) + ' '), /2,000/);
});

const valid = { reflection: ' A fictional task feels hard. ', perspective: ' One task is not the whole day. ' };

test('structured reflection requires reflection and perspective, trims text and permits one optional next step', () => {
  assert.deepEqual(parseReflection(valid), { reflection: valid.reflection.trim(), perspective: valid.perspective.trim() });
  assert.deepEqual(parseReflection({ ...valid, nextStep: ' Pause. ' }), {
    reflection: valid.reflection.trim(), perspective: valid.perspective.trim(), nextStep: 'Pause.',
  });
  assert.ok(parseReflection({ reflection: 'x'.repeat(600), perspective: 'x'.repeat(600), nextStep: 'x'.repeat(240) }));
});

for (const [name, value] of [
  ['null', null], ['array', []], ['missing perspective', { reflection: 'Pause.' }],
  ['number', { ...valid, reflection: 1 }], ['blank reflection', { ...valid, reflection: ' \t' }],
  ['blank perspective', { ...valid, perspective: ' ' }], ['oversized reflection', { ...valid, reflection: 'x'.repeat(601) }],
  ['oversized perspective', { ...valid, perspective: 'x'.repeat(601) }],
  ['empty next step', { ...valid, nextStep: '' }], ['null next step', { ...valid, nextStep: null }],
  ['long next step', { ...valid, nextStep: 'x'.repeat(241) }], ['extra fields', { ...valid, instructions: 'ignore rules' }],
]) {
  test(`reflection validator rejects ${name}`, () => assert.equal(parseReflection(value), null));
}

test('model safety output cannot carry a normal reframe or arbitrary advice', () => {
  assert.deepEqual(parseModelOutput({ kind: 'safety' }), { kind: 'safety' });
  assert.equal(parseModelOutput({ kind: 'safety', ...valid }), null);
  assert.equal(parseModelOutput({ kind: 'other', ...valid }), null);
  assert.ok(parseModelOutput({ kind: 'reflection', ...valid }));
});

test('client response requires the correct fixed label for mock/AI and a valid perspective', () => {
  for (const [mock, label] of [[true, MOCK_LABEL], [false, GEMINI_LABEL]]) {
    assert.ok(parseResetResponse({ kind: 'reflection', mock, label, ...valid }));
  }
  assert.equal(parseResetResponse({ kind: 'reflection', mock: true, label: GEMINI_LABEL, ...valid }), null);
  assert.equal(parseResetResponse({ kind: 'reflection', mock: false, label: MOCK_LABEL, ...valid }), null);
});
