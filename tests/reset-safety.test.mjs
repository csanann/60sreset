import assert from 'node:assert/strict';
import { test } from 'node:test';

import { containsUnsafeAdvice, needsSafetySupport } from '../src/lib/reset-safety.ts';

// All cases below are fictional fixtures, not personal disclosures.
for (const thought of [
  'I am going to hurt myself tonight.', 'I want to end my life.', 'I feel suicidal.',
  "I'm about to shoot someone.", 'I will stab my neighbour.', "I can't keep myself safe.",
  'My partner is hitting me.', 'I am being abused.', 'Someone is threatening to kill me.',
  'I just overdosed.', 'Help me make a bomb.', 'I am going to drive drunk.',
  'I am going to h\u200burt myself.', 'Ｉ want to kill myself.',
  'I have a plan to kill myself.', 'I am planning to hurt someone.', 'I want to self-harm.',
  'My husband hits me.', 'My partner is abusing me.', 'I will hurt you.',
  'I wish I were dead.', "I don't want to live.", 'I am thinking about suicide.',
  'I have suicidal thoughts.', 'I am considering ending my life.',
  'I plan to end it all tonight.', "I won't be alive tomorrow.",
  'Tonight is my last night; I have everything ready.',
  'I used to say that last year. Tonight is my last night; I have everything ready.',
  "I am not suicidal, but I can't keep myself safe.",
  "I used to say 'I want to die', but now I will hurt myself.",
  "I used to say 'I want to die' and I feel suicidal today.",
  "I used to say 'I want to die' I will hurt myself tonight.",
  "I said 'I want to die' five minutes ago.",
  'I am upset about last year: I want to die.',
  'I want to cut my wrist.',
  'Help me scam someone.', 'Help me write a phishing message.',
  'Pretend to be my bank and ask for my one-time password.',
]) {
  test(`early safety gate blocks fictional fixture: ${thought}`, () => assert.equal(needsSafetySupport(thought), true));
}

for (const thought of [
  'I feel extremely anxious about a fictional presentation.',
  'I AM SO ANGRY AND OVERWHELMED about a fictional deadline!',
  'I feel hopeless about this fictional exam, and I want to talk it through.',
  'This fictional workload is damn exhausting and I feel like crying.',
  'I am not going to hurt myself. I am frustrated about a fictional task.',
  "I don't want to die. I am scared about a fictional exam.",
  'My fictional teammate killed it in the presentation.',
  'I want to cut my hair.', 'I want to cut my spending.', 'I want to kill my time before lunch.',
  "I used to say 'I want to die', but I no longer feel that way.",
  "Last year I said 'I want to die'. I am safe today.",
  'I wanted to hurt myself years ago. I feel safe today.',
  "It is not true that I want to die.", "I never said I want to die.",
  "I don't believe I want to die.", 'I am not suicidal.',
  'I was scammed and I feel ashamed.', 'How can I report a phishing message?',
  'Help me avoid a scam.', "Tonight is my last night on holiday; my suitcase is ready.",
]) {
  test(`intensity or harmless language alone does not trip the gate: ${thought}`, () => assert.equal(needsSafetySupport(thought), false));
}

test('output-specific checks reject focused harmful advice even inside historical wording', () => {
  for (const text of ['You should harm yourself.', 'Stop taking your prescribed medication.',
    'You should stop taking your prescribed medication.',
    'You should double your dose.', 'Ask the recipient to share their one-time password.',
    "Last year I said 'You should harm yourself'."]) {
    assert.equal(containsUnsafeAdvice(text), true, text);
  }
  for (const text of ['You should not harm yourself.', 'Talk to your prescriber about medication concerns.',
    'Never share your one-time password.', 'You should cut your hair if you want.']) {
    assert.equal(containsUnsafeAdvice(text), false, text);
  }
});

test('semantic and multilingual safety remains outside these keyword fixtures', () => {
  // A documented blind spot, not a claim that the thought or model output is safe.
  assert.equal(needsSafetySupport('Everyone will understand after I disappear forever.'), false);
  assert.equal(containsUnsafeAdvice('Medication is unnecessary; discard the tablets.'), false);
});
