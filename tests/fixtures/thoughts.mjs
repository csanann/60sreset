// Fictional format/UAT fixtures shared across the client, contract and API tests.
export const rejectedThoughts = [
  '123456', '١٢٣٤', '１２３４', ' 12 34 ', '!!!', '...?!', '+=$^|~', '！？。',
  ' 12,345.00 ', 'xxxxxxxx', 'XXXXXXXX', 'q'.repeat(40), '\u0000'.repeat(2000), '\u200b\ufeff',
];
export const acceptedThoughts = [
  'Hi', 'I', 'OK', 'Sad', 'No!', 'I have 2 exams', '2026 feels hard',
  'noooooooo', 'aaaaaaaa', 'hhhhhhhh', 'zzzzzzzz', 'ha ha ha ha', 'sad sad sad',
  'x', 'xxxxxxx', 'xoxo', 'abcdefgh', 'ไทย', 'เหนื่อยมาก', '累', '我好累', 'つらい',
  'أنا متعب', 'बहुत थक गया', 'e\u0301', '😢', '😢😢😢', '👩‍👩‍👧‍👦', '∞', ' หลายเรื่อง\n at once 😅 ',
];
