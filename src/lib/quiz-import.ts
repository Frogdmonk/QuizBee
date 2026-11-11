import { LEARNING_LIMITS } from '@/lib/learning';
import { LIMITS, newOption, newQuestion, questionIssues } from '@/lib/quiz-rules';
import { CODE_LIMITS, normaliseLanguage } from '@/lib/code';
import type { QuestionCode, QuestionDifficulty, QuestionDraft } from '@/types/quiz';

/*
 * Importing questions written by ChatGPT (or by hand) as JSON.
 *
 * Rally never calls an AI service. The teacher copies the prompt built here, gives it to ChatGPT
 * with their presentation, and pastes the JSON answer back. This module checks that JSON against
 * the schema below and turns it into ordinary editor questions (QuestionDraft), so imported
 * questions are saved by save_quiz, validated by the server and played exactly like hand-made ones.
 */

export const IMPORT_LIMITS = {
  /** Bigger than any real quiz of 100 questions; stops a runaway paste from freezing the page. */
  maxChars: 300_000,
  promptCounts: [5, 10, 15, 20, 25, 30, 40, 50] as const,
  audienceMax: 80,
} as const;

export type ImportMix = 'mostly_mc' | 'balanced' | 'mc_only' | 'tf_only';

export const MIX_LABELS: Record<ImportMix, string> = {
  mostly_mc: 'Mostly multiple choice',
  balanced: 'Half and half',
  mc_only: 'Multiple choice only',
  tf_only: 'True/false only',
};

const MIX_TF_SHARE: Record<ImportMix, number> = { mostly_mc: 0.3, balanced: 0.5, mc_only: 0, tf_only: 1 };

/** How many multiple-choice and true/false questions to ask ChatGPT for. */
export function mixCounts(count: number, mix: ImportMix): { mc: number; tf: number } {
  const tf = Math.round(count * MIX_TF_SHARE[mix]);
  return { mc: count - tf, tf };
}

/** The canonical schema, shown to ChatGPT and offered to the teacher as a sample. */
export const SAMPLE_IMPORT = {
  quiz_title: 'Python Dictionaries',
  description: 'Questions generated from the provided presentation.',
  questions: [
    {
      question_text: 'Which method returns all key-value pairs in a dictionary?',
      question_type: 'multiple_choice',
      options: [
        { id: 'A', text: 'keys()' },
        { id: 'B', text: 'values()' },
        { id: 'C', text: 'items()' },
        { id: 'D', text: 'get()' },
      ],
      correct_answer: 'C',
      explanation: "The items() method returns the dictionary's key-value pairs.",
      difficulty: 'medium',
      topic: 'Dictionary Methods',
    },
    {
      question_text: 'A Python dictionary stores data in key-value pairs.',
      question_type: 'true_false',
      options: [
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ],
      correct_answer: 'A',
      explanation: 'A dictionary stores each value using a unique key.',
      difficulty: 'easy',
      topic: 'Dictionary Fundamentals',
    },
    {
      question_text: 'What will be the output of the following Python program?',
      question_type: 'multiple_choice',
      code: {
        language: 'python',
        content: 'stock = {"apples": 3, "pears": 5}\nstock["apples"] += 2\n\nprint(stock["apples"] + stock["pears"])',
      },
      options: [
        { id: 'A', text: '8' },
        { id: 'B', text: '10' },
        { id: 'C', text: '5' },
        { id: 'D', text: '7' },
      ],
      correct_answer: 'B',
      explanation: 'stock["apples"] becomes 3 + 2 = 5, and 5 + stock["pears"] (5) prints 10.',
      difficulty: 'medium',
      topic: 'Updating Dictionaries',
    },
  ],
} as const;

export const SAMPLE_JSON = JSON.stringify(SAMPLE_IMPORT, null, 2);

export type PromptOptions = { count: number; mix: ImportMix; audience: string };

/** The instructions the teacher pastes into ChatGPT together with their presentation. */
export function buildChatGptPrompt({ count, mix, audience }: PromptOptions): string {
  const { mc, tf } = mixCounts(count, mix);
  const who = audience.trim().slice(0, IMPORT_LIMITS.audienceMax);
  const mixLine =
    mc === 0
      ? `Generate only true/false questions (${tf}).`
      : tf === 0
        ? `Generate only multiple-choice questions (${mc}).`
        : `Generate both multiple-choice and true/false questions: ${mc} multiple-choice and ${tf} true/false.`;
  const lines = [
    'You are an educational assessment specialist with expertise in programming education.',
    '',
    'I have uploaded a PowerPoint presentation. Analyse its contents carefully and generate quiz questions based strictly on the information contained in the presentation.',
    '',
    `Your task is to create a set of ${count} questions that assesses students' understanding of the presentation.${who ? ` The students are: ${who}.` : ''}`,
    '',
    'Requirements:',
    '',
    '1. Use only concepts and information supported by the uploaded presentation: its definitions, concepts, examples and key learning points.',
    `2. ${mixLine}`,
    '3. Make every multiple-choice question contain four answer options.',
    '4. Ensure exactly one multiple-choice option is correct.',
    '5. Make incorrect options plausible but clearly incorrect according to the presentation.',
    '6. Provide the correct answer for every question.',
    '7. Provide a meaningful explanation for every answer.',
    '8. Do not generate duplicate or nearly identical questions.',
    '9. Avoid ambiguous wording.',
    '10. Test conceptual understanding, application and interpretation where the presentation supports these tasks, rather than copying sentences from the slides.',
    '11. Do not invent facts or introduce unsupported external information. If the presentation does not contain enough material for this many good questions, return fewer questions instead of inventing content.',
    '12. Preserve technical terminology and important definitions from the presentation.',
    `13. Use straightforward language, and make the difficulty appropriate for ${who ? 'these students' : 'the intended student level'}.`,
    '14. Do not make all correct multiple-choice answers follow the same option pattern: vary which letter is correct.',
    '15. Ensure the output follows the exact JSON schema supplied below.',
    '',
    'Programming questions:',
    '',
    'For questions involving programming, source code, program output, debugging, syntax, loops, conditions, functions, data structures or other programming concepts:',
    '',
    '1. Keep the question text separate from the code.',
    '2. Include the programming code in a separate "code" object: {"language": "…", "content": "…"}.',
    '3. Explicitly identify the programming language.',
    '4. Preserve correct syntax.',
    '5. Preserve all line breaks and indentation (use spaces for indentation).',
    '6. Use escaped newline characters (\\n) inside "content", as JSON requires.',
    '7. Never place the source code inside the "question_text" field.',
    '8. Never place source code inside the answer options unless the option itself is intentionally a code snippet.',
    '9. Ensure the code is relevant to the question.',
    '10. Do not invent code examples that introduce concepts absent from the presentation unless the task explicitly requires an application question supported by those concepts.',
    '',
    'Supported language identifiers: "python", "c", "cpp", "java".',
    '',
    'For non-programming questions, omit the "code" field entirely.',
    '',
    'If an answer option itself needs to be a code snippet, write it as {"id": "A", "code": {"language": "python", "content": "…"}} instead of "text", keeping its unique id. Keep code options short (at most 120 characters).',
    '',
    'Ensure that "correct_answer" always references the id of the correct option.',
    '',
    'Limits (questions that break them cannot be imported):',
    '',
    `- "question_text": at most ${LIMITS.promptMax} characters.`,
    `- Each option "text": at most ${LIMITS.optionLabelMax} characters.`,
    `- "code" "content": at most ${CODE_LIMITS.contentMax} characters (about 40 short lines).`,
    `- "explanation": at most ${LIMITS.explanationMax} characters.`,
    `- "topic": at most ${LEARNING_LIMITS.topicMax} characters, naming the presentation section the question tests.`,
    '- "difficulty": "easy", "medium" or "hard".',
    '- "question_type": "multiple_choice" or "true_false" only.',
    '- Multiple choice: options with ids "A", "B", "C" and "D".',
    '- True/false: exactly two options, {"id": "A", "text": "True"} and {"id": "B", "text": "False"}.',
    '- "correct_answer": the id of the single correct option, for example "C".',
    '',
    'Output requirements:',
    '',
    'Return one valid JSON object only.',
    'Do not include Markdown code fences.',
    'Do not include introductory text.',
    'Do not include explanations outside the JSON.',
    'Do not add trailing commas.',
    'Do not change field names.',
    'Do not add unsupported question types.',
    'Every question must contain an explanation.',
    '',
    'Return the result using this structure. The values below only show the format: replace them with questions about my presentation, and set "quiz_title" to the presentation\'s topic.',
    '',
    SAMPLE_JSON,
    '',
    'Before returning the result, internally validate that the JSON is syntactically valid and that every question follows the schema.',
  ];
  return lines.join('\n');
}

// ── Checking pasted JSON ──────────────────────────────────────────────────────

export type ImportItem = {
  /** 1-based position in the pasted JSON. */
  number: number;
  /** The question text as pasted (for the result list), or a placeholder. */
  label: string;
  errors: string[];
  /** The converted question when it has no errors. */
  draft: QuestionDraft | null;
};

export type ImportCheck = {
  /** The input could not be read as a quiz at all (not JSON, wrong shape). */
  fatal: string[];
  /** Problems with quiz_title / description. */
  quizErrors: string[];
  /** Things Rally fixed for the teacher, such as a removed code fence. */
  notes: string[];
  title: string;
  description: string;
  items: ImportItem[];
};

const SUPPORTED_TYPES = ['multiple_choice', 'true_false'] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

/** Problems that stop the whole import. */
export function importReady(check: ImportCheck): boolean {
  return check.fatal.length === 0 && check.quizErrors.length === 0 && check.items.length > 0 && check.items.every((i) => i.errors.length === 0);
}

/** Every problem as one line, e.g. "Question 4: The correct answer does not match any of the provided options." */
export function importErrorLines(check: ImportCheck): string[] {
  return [...check.fatal, ...check.quizErrors, ...check.items.flatMap((i) => i.errors.map((e) => `Question ${i.number}: ${e}`))];
}

/** Message when the questions would push the quiz past its limit, or null. */
export function roomError(adding: number, existing: number): string | null {
  const room = LIMITS.maxQuestions - existing;
  if (adding <= room) return null;
  return room <= 0
    ? `This quiz already has ${LIMITS.maxQuestions} questions, the most a quiz can have.`
    : `A quiz can have at most ${LIMITS.maxQuestions} questions. This quiz has ${existing}, so there is room for ${room} more, not ${adding}.`;
}

/** Lowercase, single-spaced, without surrounding punctuation: used to spot repeated questions. */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”‘’.,:;!?-]+|[\s"'“”‘’.,:;!?-]+$/g, '');
}

function emptyCheck(fatal: string[], notes: string[] = []): ImportCheck {
  return { fatal, quizErrors: [], notes, title: '', description: '', items: [] };
}

/** Line and column of a JSON.parse failure, when the browser says where it is. */
function syntaxLocation(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lineCol = /line (\d+) column (\d+)/i.exec(message);
  if (lineCol) return ` near line ${lineCol[1]}, column ${lineCol[2]}`;
  const position = /position (\d+)/i.exec(message);
  if (position) {
    const before = text.slice(0, Number(position[1]));
    const line = before.split('\n').length;
    const column = before.length - before.lastIndexOf('\n');
    return ` near line ${line}, column ${column}`;
  }
  return '';
}

/** True when a string or a { [ is still open at the end: the answer was cut off mid-way. */
export function looksCutOff(text: string): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return inString || depth > 0;
}

/** Parses the pasted text. Removes a Markdown code fence or chat text around the JSON, and says so. */
function readJson(raw: string): { value: unknown; notes: string[] } | { error: string } {
  let text = raw.trim();
  const notes: string[] = [];
  const fence = /^```[a-z]*\s*\n?([\s\S]*?)\n?```$/i.exec(text);
  if (fence) {
    text = fence[1].trim();
    notes.push('Removed the ``` code fence around the JSON.');
  }
  try {
    return { value: JSON.parse(text), notes };
  } catch (error) {
    // ChatGPT sometimes adds a sentence before or after the JSON: try the outermost { … }.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start > 0 || (end >= 0 && end < text.length - 1)) {
      try {
        const value = JSON.parse(text.slice(start, end + 1));
        notes.push('Ignored the text before or after the JSON. Only the part from the first { to the last } was read.');
        return { value, notes };
      } catch {
        // fall through to the original error
      }
    }
    if (/[“”]/.test(text)) {
      return { error: 'This is not valid JSON: it contains curly quotes (“ ”). JSON needs straight quotes ("). Copy the JSON again using ChatGPT’s copy button.' };
    }
    if (start === -1) return { error: 'This does not look like JSON. It should start with { and end with }. Copy the whole answer from ChatGPT.' };
    if (looksCutOff(text.slice(start))) {
      return {
        error: 'This JSON stops before it is finished, so it was probably cut off. Ask ChatGPT to “continue” or to “return the complete JSON again”, then paste the whole answer here.',
      };
    }
    return {
      error: `This is not valid JSON${syntaxLocation(text, error)}. It may be cut off or have a missing comma or bracket. Ask ChatGPT to “return the complete JSON again”, then paste it here.`,
    };
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);

/** Checks pasted JSON against the import schema. Never drops a question: every one is reported. */
export function checkImport(raw: string, options: { existing?: readonly { prompt: string; code?: { content: string } | null }[] } = {}): ImportCheck {
  if (raw.trim() === '') return emptyCheck(['Paste the JSON from ChatGPT first.']);
  if (raw.length > IMPORT_LIMITS.maxChars) {
    return emptyCheck([`That is too long to be one quiz (over ${IMPORT_LIMITS.maxChars.toLocaleString('en')} characters). Paste only the JSON for one quiz.`]);
  }
  const read = readJson(raw);
  if ('error' in read) return emptyCheck([read.error]);
  const { value: root, notes } = read;

  if (Array.isArray(root)) {
    return emptyCheck(['The JSON is a list. It must be one object with "quiz_title" and a "questions" list, like the sample.'], notes);
  }
  if (!isObject(root)) return emptyCheck(['The JSON must be one object with "quiz_title" and a "questions" list, like the sample.'], notes);

  const quizErrors: string[] = [];
  const title = typeof root.quiz_title === 'string' ? root.quiz_title.trim() : '';
  if (!('quiz_title' in root)) quizErrors.push('Quiz: "quiz_title" is missing.');
  else if (typeof root.quiz_title !== 'string') quizErrors.push('Quiz: "quiz_title" must be text.');
  else if (!title) quizErrors.push('Quiz: "quiz_title" is empty.');
  else if (title.length > LIMITS.titleMax) quizErrors.push(`Quiz: "quiz_title" can be at most ${LIMITS.titleMax} characters.`);

  let description = '';
  if (root.description !== undefined && root.description !== null) {
    if (typeof root.description !== 'string') quizErrors.push('Quiz: "description" must be text.');
    else if (root.description.trim().length > LIMITS.descriptionMax) quizErrors.push(`Quiz: "description" can be at most ${LIMITS.descriptionMax} characters.`);
    else description = root.description.trim();
  }

  if (!('questions' in root)) return { ...emptyCheck(['The JSON has no "questions" list.'], notes), quizErrors, title, description };
  if (!Array.isArray(root.questions)) return { ...emptyCheck(['"questions" must be a list ([ … ]).'], notes), quizErrors, title, description };
  if (root.questions.length === 0) return { ...emptyCheck(['The "questions" list is empty.'], notes), quizErrors, title, description };
  if (root.questions.length > LIMITS.maxQuestions) {
    return { ...emptyCheck([`There are ${root.questions.length} questions. A quiz can have at most ${LIMITS.maxQuestions}.`], notes), quizErrors, title, description };
  }

  const existing = new Set((options.existing ?? []).map((q) => questionIdentity(q.prompt, q.code)).filter(Boolean));
  const seen = new Map<string, number>();
  const items = root.questions.map((q, i): ImportItem => {
    const number = i + 1;
    const item = checkQuestion(q, number);
    const rawCode = isObject(q) && isObject(q.code) && typeof q.code.content === 'string' ? { content: q.code.content } : null;
    const text = isObject(q) && typeof q.question_text === 'string' ? questionIdentity(q.question_text, rawCode) : '';
    if (text) {
      const earlier = seen.get(text);
      if (earlier !== undefined) item.errors.push(`Same question as question ${earlier}.`);
      else seen.set(text, number);
      if (existing.has(text)) item.errors.push('This question is already in your quiz.');
    }
    if (item.errors.length) item.draft = null;
    return item;
  });

  return { fatal: [], quizErrors, notes, title, description, items };
}

function checkQuestion(q: unknown, number: number): ImportItem {
  const errors: string[] = [];
  const fail = (label: string): ImportItem => ({ number, label, errors, draft: null });
  if (!isObject(q)) {
    errors.push('This is not a question object ({ … }).');
    return fail('Not a question');
  }

  // Text
  const prompt = typeof q.question_text === 'string' ? q.question_text.trim() : '';
  if (q.question_text === undefined) errors.push('Question text ("question_text") is missing.');
  else if (typeof q.question_text !== 'string') errors.push('"question_text" must be text.');
  else if (!prompt) errors.push('The question text is empty.');
  else if (prompt.length > LIMITS.promptMax) errors.push(`The question text is ${prompt.length} characters; the limit is ${LIMITS.promptMax}.`);
  const label = prompt || 'Untitled question';

  // Type
  const rawType = typeof q.question_type === 'string' ? q.question_type.trim().toLowerCase() : null;
  let type: SupportedType | null = null;
  if (q.question_type === undefined) errors.push('Question type ("question_type") is missing.');
  else if (rawType === null) errors.push('"question_type" must be text.');
  else if ((SUPPORTED_TYPES as readonly string[]).includes(rawType)) type = rawType as SupportedType;
  else errors.push(`Unsupported question type "${String(q.question_type)}". Use "multiple_choice" or "true_false".`);

  // Code shown with the question (optional)
  const code = checkCode(q.code, 'Code', errors);
  if (prompt.includes('```')) errors.push('The question text contains a code fence (```). Put the code in the "code" object instead.');

  // Options (an option is text, or a short code snippet: { "id", "code": { "language", "content" } })
  type Opt = { id: string; text: string; isCode: boolean };
  const opts: Opt[] = [];
  if (q.options === undefined) errors.push('Answer options ("options") are missing.');
  else if (!Array.isArray(q.options)) errors.push('"options" must be a list.');
  else {
    q.options.forEach((o, j) => {
      const at = `Option ${j + 1}`;
      if (!isObject(o)) return void errors.push(`${at} must be an object with "id" and "text".`);
      const id = str(o.id)?.trim() ?? '';
      const plain = str(o.text)?.trim() ?? '';
      const snippet = o.code === undefined || o.code === null ? null : checkCode(o.code, `${at} code`, errors);
      if (snippet && plain && plain !== snippet.content.trim()) errors.push(`${at} has both "text" and "code". Give one of them.`);
      const text = snippet ? snippet.content.trim() : plain;
      if (!id) errors.push(`${at} has no "id".`);
      if (o.code !== undefined && o.code !== null && !snippet) {
        // checkCode already reported the problem.
      } else if (!text) errors.push(`${at} has no "text".`);
      else if (text.length > LIMITS.optionLabelMax) errors.push(`${at} is ${text.length} characters; an answer can be at most ${LIMITS.optionLabelMax}.`);
      opts.push({ id, text, isCode: Boolean(snippet) });
    });
    if (type === 'true_false' && opts.some((o) => o.isCode)) errors.push('True/false answers cannot be code.');
    const ids = opts.map((o) => o.id.toUpperCase()).filter(Boolean);
    if (new Set(ids).size !== ids.length) errors.push('Two options have the same id.');
    const texts = opts.map((o) => o.text.toLowerCase()).filter(Boolean);
    if (new Set(texts).size !== texts.length) errors.push('Two options have the same text.');
    if (type === 'multiple_choice') {
      if (opts.length < LIMITS.minOptions) errors.push(`A multiple-choice question needs at least ${LIMITS.minOptions} options.`);
      if (opts.length > LIMITS.maxOptions) errors.push(`Rally questions can have at most ${LIMITS.maxOptions} options; this one has ${opts.length}.`);
    }
    if (type === 'true_false') {
      const words = opts.map((o) => o.text.toLowerCase()).sort();
      if (opts.length !== 2 || words[0] !== 'false' || words[1] !== 'true') errors.push('A true/false question needs exactly two options: "True" and "False".');
    }
  }

  // Correct answer
  let correctIndex = -1;
  if (q.correct_answer === undefined || q.correct_answer === null || q.correct_answer === '') errors.push('The correct answer ("correct_answer") is missing.');
  else if (Array.isArray(q.correct_answer)) errors.push('Give exactly one correct answer, not a list.');
  else {
    const answer = str(q.correct_answer)?.trim() ?? '';
    correctIndex = opts.findIndex((o) => o.id && o.id.toUpperCase() === answer.toUpperCase());
    if (correctIndex === -1 && opts.length > 0) {
      const byText = opts.findIndex((o) => o.text.toLowerCase() === answer.toLowerCase());
      errors.push(
        byText >= 0 && opts[byText].id
          ? `The correct answer must be an option's id. "${answer}" is the text of option ${opts[byText].id}; use "${opts[byText].id}".`
          : 'The correct answer does not match any of the provided options.',
      );
    }
  }

  // Explanation
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';
  if (q.explanation === undefined || q.explanation === null || (typeof q.explanation === 'string' && !explanation)) errors.push('Explanation is missing.');
  else if (typeof q.explanation !== 'string') errors.push('"explanation" must be text.');
  else if (explanation.length > LIMITS.explanationMax) errors.push(`The explanation is ${explanation.length} characters; the limit is ${LIMITS.explanationMax}.`);

  // Optional metadata
  let difficulty: QuestionDifficulty | null = null;
  if (q.difficulty !== undefined && q.difficulty !== null && q.difficulty !== '') {
    const d = typeof q.difficulty === 'string' ? q.difficulty.trim().toLowerCase() : '';
    if (d === 'easy' || d === 'medium' || d === 'hard') difficulty = d;
    else errors.push(`Difficulty "${String(q.difficulty)}" is not supported. Use "easy", "medium" or "hard".`);
  }
  let topic = '';
  if (q.topic !== undefined && q.topic !== null) {
    if (typeof q.topic !== 'string') errors.push('"topic" must be text.');
    else if (q.topic.trim().length > LEARNING_LIMITS.topicMax) errors.push(`The topic can be at most ${LEARNING_LIMITS.topicMax} characters.`);
    else topic = q.topic.trim();
  }

  if (errors.length || !type) return fail(label);

  const base = newQuestion(type);
  const correctText = opts[correctIndex].text.toLowerCase();
  const draft: QuestionDraft = {
    ...base,
    prompt,
    explanation,
    difficulty,
    topic,
    code,
    options:
      type === 'true_false'
        ? // Rally always shows True first; keep whichever one ChatGPT marked correct.
          base.options.map((o) => ({ ...o, isCorrect: o.label.toLowerCase() === correctText }))
        : opts.map((o, j) => ({ ...newOption(o.text), isCorrect: j === correctIndex, isCode: o.isCode })),
  };
  return { number, label, errors: [], draft };
}

/**
 * A code object: { "language": "python" | "c" | "cpp" | "java" | "text", "content": "…" }.
 * The content is kept exactly as JSON decoded it (newlines, indentation, quotes, backslashes);
 * only Windows line endings become plain newlines. Nothing is compiled or run.
 */
function checkCode(value: unknown, what: string, errors: string[]): QuestionCode | null {
  if (value === undefined || value === null) return null;
  if (!isObject(value)) {
    errors.push(`${what} must be an object with "language" and "content".`);
    return null;
  }
  const before = errors.length;
  let language: string | null = null;
  if (value.language === undefined || value.language === null || value.language === '') errors.push(`${what}: the language ("language") is missing.`);
  else if (typeof value.language !== 'string') errors.push(`${what}: "language" must be text.`);
  else {
    language = normaliseLanguage(value.language);
    if (!language) errors.push(`${what}: unsupported language identifier "${value.language}". Use ${SUPPORTED_LANGUAGE_LIST}.`);
  }
  const content = typeof value.content === 'string' ? value.content.replace(/\r\n?/g, '\n') : null;
  if (value.content === undefined || value.content === null || (content !== null && content.trim() === '')) errors.push(`${what} content is missing.`);
  else if (content === null) errors.push(`${what} content must be text (with \\n for new lines).`);
  else if (content.length > CODE_LIMITS.contentMax) errors.push(`${what} is ${content.length} characters; the limit is ${CODE_LIMITS.contentMax}.`);
  return errors.length > before || !language || content === null ? null : { language, content };
}

const SUPPORTED_LANGUAGE_LIST = '"python", "c", "cpp" or "java"';

/** What makes two questions "the same": the text plus any code (the same text can ask about different code). */
export function questionIdentity(prompt: string, code: { content: string } | null | undefined): string {
  const text = normaliseText(prompt);
  if (!text) return '';
  return code ? `${text}\u0000${code.content.replace(/\s+/g, ' ').trim()}` : text;
}

/** Problems with a question while it is reviewed before import (after the teacher's edits). */
export function reviewIssues(q: QuestionDraft): string[] {
  const issues = questionIssues(q);
  if (q.code && q.code.content.length > CODE_LIMITS.contentMax) issues.push(`Shorten the code to ${CODE_LIMITS.contentMax} characters.`);
  if (q.prompt.trim().length > LIMITS.promptMax) issues.push(`Shorten the question to ${LIMITS.promptMax} characters.`);
  if (q.options.some((o) => o.label.trim().length > LIMITS.optionLabelMax)) issues.push(`Shorten answers to ${LIMITS.optionLabelMax} characters.`);
  if (!q.explanation.trim()) issues.push('Add an explanation.');
  if (q.explanation.trim().length > LIMITS.explanationMax) issues.push(`Shorten the explanation to ${LIMITS.explanationMax} characters.`);
  return issues;
}
