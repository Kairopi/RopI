/**
 * Built-in quizzes (work without the Muse API).
 *
 * Each quiz tests 3 concepts with 2 questions each. Weak spots need at least
 * 2 attempts per concept (see skill-tracker.ts), so ONE quiz is enough to
 * detect a real weak spot instead of guessing from a single miss.
 *
 * Facts checked against AWS documentation (Lambda quotas and pricing pages,
 * VPC user guide) as of 2026.
 */

import type { Quiz } from '@/lib/learning/quiz-generator';

const base = { userId: '', generatedFromSources: [], createdAt: new Date(0) };

export const BUILT_IN_QUIZZES: Record<string, Quiz> = {
  'quiz-1': {
    ...base,
    id: 'quiz-1',
    topic: 'AWS Lambda',
    title: 'AWS Lambda Fundamentals',
    difficulty: 'medium',
    timeLimit: 10,
    questions: [
      {
        id: 'l1',
        concept: 'Lambda execution limits',
        difficulty: 'easy',
        question: 'What is the maximum timeout you can set for a single Lambda invocation?',
        options: ['5 minutes', '10 minutes', '15 minutes', '30 minutes'],
        correctAnswerIndex: 2,
        explanation: 'The maximum Lambda timeout is 900 seconds (15 minutes). Longer jobs need Step Functions, ECS or Batch.',
      },
      {
        id: 'l2',
        concept: 'Lambda execution limits',
        difficulty: 'medium',
        question: 'What is the maximum memory you can allocate to a Lambda function?',
        options: ['3,008 MB', '10,240 MB', '16,384 MB', '512 MB'],
        correctAnswerIndex: 1,
        explanation: 'Lambda supports 128 MB to 10,240 MB of memory. CPU is allocated in proportion to memory.',
      },
      {
        id: 'l3',
        concept: 'Lambda cold starts',
        difficulty: 'medium',
        question: 'What causes a Lambda cold start?',
        options: [
          'Network latency between regions',
          'Lambda creating and initializing a new execution environment',
          'The function code throwing an error',
          'DynamoDB throttling the request',
        ],
        correctAnswerIndex: 1,
        explanation: 'A cold start happens when Lambda must create a new execution environment: download the code, start the runtime and run your init code.',
      },
      {
        id: 'l4',
        concept: 'Lambda cold starts',
        difficulty: 'hard',
        question: 'Which feature keeps execution environments initialized ahead of time to avoid cold starts?',
        options: ['Reserved concurrency', 'Provisioned concurrency', 'Lambda layers', 'Dead-letter queues'],
        correctAnswerIndex: 1,
        explanation: 'Provisioned concurrency pre-initializes environments. Reserved concurrency only caps or guarantees capacity; it does not pre-warm.',
      },
      {
        id: 'l5',
        concept: 'Lambda pricing model',
        difficulty: 'medium',
        question: 'How is standard Lambda usage billed?',
        options: [
          'Per invocation only',
          'Per GB-second of compute only',
          'Per request plus duration in GB-seconds',
          'A monthly flat rate per function',
        ],
        correctAnswerIndex: 2,
        explanation: 'You pay per request and for duration, measured in GB-seconds (memory allocated x execution time).',
      },
      {
        id: 'l6',
        concept: 'Lambda pricing model',
        difficulty: 'hard',
        question: 'A function is configured with 1 GB of memory and runs for 2 seconds. How many GB-seconds is that?',
        options: ['0.5 GB-seconds', '1 GB-second', '2 GB-seconds', '2,048 GB-seconds'],
        correctAnswerIndex: 2,
        explanation: 'GB-seconds = memory in GB x duration in seconds = 1 x 2 = 2 GB-seconds.',
      },
    ],
  },

  'quiz-2': {
    ...base,
    id: 'quiz-2',
    topic: 'AWS VPC',
    title: 'VPC Networking Basics',
    difficulty: 'medium',
    timeLimit: 10,
    questions: [
      {
        id: 'v1',
        concept: 'Public vs private subnets',
        difficulty: 'easy',
        question: 'What makes a subnet "public"?',
        options: [
          'It has a public CIDR block',
          'Its route table has a route to an internet gateway',
          'It is in the first Availability Zone',
          'It has no network ACL',
        ],
        correctAnswerIndex: 1,
        explanation: 'A subnet is public when its route table sends 0.0.0.0/0 traffic to an internet gateway.',
      },
      {
        id: 'v2',
        concept: 'Public vs private subnets',
        difficulty: 'medium',
        question: 'Can one subnet span two Availability Zones?',
        options: ['Yes, always', 'Only in large regions', 'No, a subnet lives in exactly one AZ', 'Only for private subnets'],
        correctAnswerIndex: 2,
        explanation: 'Each subnet belongs to a single Availability Zone. Use one subnet per AZ for high availability.',
      },
      {
        id: 'v3',
        concept: 'Security groups vs NACLs',
        difficulty: 'medium',
        question: 'Which statement about security groups is correct?',
        options: [
          'They are stateless and need explicit return rules',
          'They are stateful: return traffic is allowed automatically',
          'They can contain explicit deny rules',
          'They apply to a whole subnet',
        ],
        correctAnswerIndex: 1,
        explanation: 'Security groups are stateful, instance-level and allow-only. Network ACLs are stateless, subnet-level and support deny rules.',
      },
      {
        id: 'v4',
        concept: 'Security groups vs NACLs',
        difficulty: 'hard',
        question: 'You must block one specific IP address from reaching every instance in a subnet. What should you use?',
        options: ['A security group deny rule', 'A network ACL deny rule', 'A route table entry', 'An internet gateway policy'],
        correctAnswerIndex: 1,
        explanation: 'Only network ACLs support explicit deny rules, and they apply to the whole subnet.',
      },
      {
        id: 'v5',
        concept: 'NAT gateways',
        difficulty: 'medium',
        question: 'What does a NAT gateway let instances in a private subnet do?',
        options: [
          'Accept inbound connections from the internet',
          'Start outbound connections to the internet without being reachable from it',
          'Talk to other VPCs without peering',
          'Get public IP addresses',
        ],
        correctAnswerIndex: 1,
        explanation: 'A NAT gateway allows outbound-initiated traffic (e.g. downloading updates) while blocking unsolicited inbound connections.',
      },
      {
        id: 'v6',
        concept: 'NAT gateways',
        difficulty: 'hard',
        question: 'Where must a public NAT gateway be placed?',
        options: ['In the private subnet it serves', 'In a public subnet', 'Outside the VPC', 'In any subnet with a NACL'],
        correctAnswerIndex: 1,
        explanation: 'A public NAT gateway sits in a public subnet with an Elastic IP; private subnets route 0.0.0.0/0 to it.',
      },
    ],
  },
};

export const BUILT_IN_QUIZ_LIST = Object.values(BUILT_IN_QUIZZES);
