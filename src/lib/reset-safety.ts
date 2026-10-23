// Focused English-language safeguards, not semantic safety or a clinical classifier.
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

const harmfulAdvice = /\b(?:you should|you must|you can|you could|try to|go and) (?:kill|hurt|harm|cut|shoot|stab|poison) (?:yourself|someone|them|him|her)\b/;
const medicalAdvice = /(?:\b(?:you (?:should|must|can|could)|try to) |^|[.!?]\s*)(?:stop|skip|double|increase|reduce) (?:taking )?(?:your |the )?(?:prescribed )?(?:medication|medicines?|dose|antidepressants?|insulin)\b/;
const credentialAdvice = /\b(?:ask|tell|persuade|convince) (?:the )?(?:recipient|victim|customer|user)\b.{0,60}\b(?:share|send|reveal|give)\b.{0,40}\b(?:one[- ]time (?:password|code)|otp|password)\b/;

// Output does not receive historical/negation exemptions: quoted advice can still harm.
export function containsUnsafeAdvice(text: string): boolean {
  const normalized = normalize(text);
  return [harmfulAdvice, medicalAdvice, credentialAdvice].some((pattern) => pattern.test(normalized));
}

// Check context before each match, not a blanket exemption for the entire request.
function hasCurrentMatch(text: string, pattern: RegExp): boolean {
  for (const match of text.matchAll(new RegExp(pattern.source, 'g'))) {
    const prefix = text.slice(0, match.index).split(/[.!?;]+|\b(?:but|however|yet|now)\b|\band (?=i\b|i'm\b)/).at(-1) ?? '';
    // Reporting context must immediately introduce this match, not mask later intent.
    const historical = /\b(?:i (?:used to (?:say|think|feel|believe)|previously (?:said|thought|felt|believed))|(?:last year|years ago|in the past|back then) i (?:said|thought|felt|believed)|i (?:said|thought|felt|believed) (?:last year|years ago|in the past|back then))(?: that)?[,\s:]*['"]?\s*$/;
    const negatedReport = /\b(?:it(?:'s| is) not true that|i (?:don't|do not|no longer) (?:say|think|believe)(?: that)?|i never said(?: that)?)[,\s:]*['"]?\s*$/;
    if (!historical.test(prefix) && !negatedReport.test(prefix)) return true;
  }
  return false;
}

export function needsSafetySupport(text: string): boolean {
  const normalized = normalize(text);
  const intent = /\b(?:i (?:want to|plan to|intend to|have a plan to|will|might|am going to|am about to|am planning to)|i'm (?:going to|about to|planning to)|help me|how (?:can|do) i)\s+(?:(?:really|actually)\s+)?(?:kill|hurt|harm|cut|shoot|stab|poison|burn)\s+(?:myself|you|him|her|them|someone|people|a person|my\s+(?:partner|husband|wife|boyfriend|girlfriend|father|mother|child|son|daughter|neighbou?r|boss|friend|brother|sister|colleague|wrists?|arms?|throat))\b/;
  const suicide = /\b(?:i (?:want to|plan to|have a plan to|will|might|am going to|am about to|am planning to)|i'm (?:going to|about to))\s+(?:die|end my life|end it all|take my (?:own )?life|commit suicide|self[- ]harm)\b|\b(?:i (?:feel|am)|i'm) (?:actively )?suicidal\b|\b(?:i can't|i cannot) (?:keep myself safe|stay safe)\b/;
  const danger = /\b(?:i (?:have |just )?(?:overdosed|took too many pills)|i(?:'m| am) (?:in immediate danger|being (?:abused|attacked|hit|threatened))|(?:my (?:partner|husband|wife|boyfriend|girlfriend|father|mother)|someone|he|she|they) (?:is |are )?(?:hits|hit|hitting|attacks|attacking|abusing|strangling|threatening(?: to kill)?) me)\b/;
  const dangerousRequest = /\b(?:help me|how (?:can|do|to)(?: i)?) (?:build|make|use) (?:a |an )?(?:bomb|explosive)\b|\bi(?:'m| am) going to drive drunk\b/;
  const suicidalThoughts = /\bi (?:wish i (?:was|were) dead|don't want to (?:live|be alive)|do not want to (?:live|be alive)|have suicidal thoughts)\b|\bi(?:'m| am) (?:thinking about|thinking of|considering) (?:suicide|killing myself|ending my life)\b/;
  const indirect = /\b(?:tonight|today) is my last (?:night|day)\b.{0,80}\b(?:everything|it all) (?:is )?ready\b|\bi (?:won't|will not|don't expect to|do not expect to) be alive tomorrow\b/;
  const scam = /\b(?:help me|how (?:can|do) i|i (?:want|plan|intend) to) (?:scam|defraud|phish)\b|\b(?:help me )?(?:write|create) (?:a |an )?(?:phishing|scam) (?:email|message|text)\b|\b(?:pretend to be|impersonate) (?:my |a |the )?(?:bank|support agent)\b.{0,120}\b(?:ask for|collect|steal|obtain)\b.{0,60}\b(?:one[- ]time (?:password|code)|otp|password|bank details)\b/;
  // Contrast/current clauses must still be checked after a historical or negated clause.
  const clauses = normalized.split(/[.!?;]+|\b(?:but|however|yet|now)\b|\band (?=i\b|i'm\b)/);
  return clauses.some((clause) => [intent, suicide, danger, dangerousRequest, harmfulAdvice, suicidalThoughts, scam]
    .some((pattern) => hasCurrentMatch(clause, pattern))) || hasCurrentMatch(normalized, indirect);
}
