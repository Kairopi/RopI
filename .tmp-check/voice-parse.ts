import { parseVoiceAnswer, parseVoiceAnswerFromAlternatives, parseVoiceCommand } from '@/lib/voice/speech-manager';

export default async function () {
  const lambda = ['5 minutes', '10 minutes', '15 minutes', '30 minutes'];
  const cold = [
    'Network latency between regions',
    'Lambda creating and initializing a new execution environment',
    'The function code throwing an error',
    'DynamoDB throttling the request',
  ];
  const kinds = ['A lambda function', 'A container', 'A virtual machine', 'A message queue'];

  const cases: Array<[string, string[], number]> = [
    ['B', lambda, 1],
    ['bee', lambda, 1],
    ['C.', lambda, 2],
    ['see', lambda, 2],
    ['option c', lambda, 2],
    ['the answer is D', lambda, 3],
    ["I think it's a", lambda, 0],
    ['number two', lambda, 1],
    ['3', lambda, 2],
    ['15 minutes', lambda, 2],
    ['fifteen minutes', lambda, -1], // number words for option text are not mapped: ask again, don't guess
    ['minutes', lambda, -1], // ambiguous: every option has "minutes"
    ['a new execution environment', cold, 1], // article "a" must NOT mean option A
    ['network latency', cold, 0],
    ['dynamodb throttling', cold, 3],
    ['banana', cold, -1],
    ['', cold, -1],
    // Nov 4 additions
    ["I'd go for C", lambda, 2],
    ["I'll take B", lambda, 1],
    ['the answer is a message queue', kinds, 3], // "answer is a ..." is the article, matched by option text
    ['the answer is a container', kinds, 1],
  ];

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, got?: unknown) => {
    if (ok) pass++;
    else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)}`);
  };

  for (const [said, opts, expected] of cases) {
    const got = parseVoiceAnswer(said, opts);
    check(`"${said}" -> ${expected}`, got === expected, got);
  }

  const alt = parseVoiceAnswerFromAlternatives(['banana split', 'see', 'C'], lambda);
  check('alternatives: falls through to a guess that parses', alt.index === 2 && alt.heard === 'see', alt);

  const commands: Array<[string, ReturnType<typeof parseVoiceCommand>]> = [
    ['repeat that', 'repeat'],
    ['skip', 'skip'],
    ["I don't know", 'skip'],
    ['stop the quiz', 'stop'],
    ['yes', 'yes'],
    ['nope', 'no'],
    ['what are the options', 'options'],
    ['B', null],
    ['15 minutes', null],
  ];
  for (const [said, cmd] of commands) check(`command "${said}" -> ${cmd}`, parseVoiceCommand(said) === cmd, parseVoiceCommand(said));

  console.log(`\n${pass}/${pass + fail} voice parser cases pass`);
  if (fail) process.exitCode = 1;
}
