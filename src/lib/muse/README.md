# Meta Muse AI Integration

This directory contains the client library for Meta's Muse AI services.

## Setup

1. Get your API keys from: https://developers.meta.ai/muse
2. Add them to `.env`:

```bash
# In .env file
VITE_MUSE_WONDER_API_KEY=your-wonder-api-key
VITE_MUSE_SPARK_API_KEY=your-spark-api-key
VITE_MUSE_VOICE_API_KEY=your-voice-api-key

# Or use unified key if available
VITE_MUSE_API_KEY=your-unified-api-key
```

## Usage

### Muse Wonder (Complex Reasoning)

```typescript
import { museWonder } from '@/lib/muse/client';

// Calculate job match score
const result = await museWonder.calculateJobMatch(
  jobDescription,
  userResume
);
console.log(result.score); // 0-100
console.log(result.matched_skills); // ['React', 'TypeScript']

// Tailor resume bullet
const tailored = await museWonder.tailorResume(
  'Built responsive web applications',
  'Looking for React developer with TypeScript experience'
);
console.log(tailored); // Emphasized for job
```

### Muse Spark (Orchestration)

```typescript
import { museSpark } from '@/lib/muse/client';

// Coordinate LifeShift recalculation
const result = await museSpark.coordinateLifeShift(
  currentSchedule,
  "manager added shift, only 20min tonight",
  userContext
);
console.log(result.new_schedule);
console.log(result.reasoning);
console.log(result.changes);
```

### Muse Voice (Speech I/O)

```typescript
import { museVoice } from '@/lib/muse/client';

// Transcribe audio
const transcript = await museVoice.transcribe({
  audio: audioBlob,
  language: 'en'
});
console.log(transcript.text);

// Synthesize speech
const audio = await museVoice.synthesize({
  text: "What's a Lambda cold start?",
  voice: 'default',
  speed: 1.0
});
console.log(audio.audio_url);
```

## API Models

### Muse Wonder
- **Model**: `muse-wonder`
- **Best for**: Complex reasoning, analysis, content generation
- **Use cases**: Job matching, resume tailoring, skill analysis

### Muse Spark
- **Model**: `muse-spark`
- **Best for**: Multi-step workflows, agent orchestration
- **Use cases**: LifeShift coordination, learning loop feedback

### Muse Voice
- **Service**: Speech-to-text & Text-to-speech
- **Best for**: Voice interfaces, hands-free interaction
- **Use cases**: Voice quizzes, audio learning

## Error Handling

```typescript
try {
  const result = await museWonder.complete({
    prompt: 'Your prompt here',
    temperature: 0.7
  });
} catch (error) {
  if (error.message.includes('API key not configured')) {
    // Prompt user to add API key
    console.error('Please configure VITE_MUSE_WONDER_API_KEY in .env');
  } else {
    // Handle API error
    console.error('Muse API error:', error);
  }
}
```

## Development Mode

For development/testing without API keys, the algorithms use deterministic logic:
- Scheduling: Constraint-based algorithm (no AI needed)
- Skill model: Weighted average math (no AI needed)
- Job matching: Keyword scoring (no AI needed)

Muse APIs are used for:
- Natural language parsing
- Resume tailoring
- Quiz question generation (future)
- Voice interface (future)

## Rate Limits

Check Meta's documentation for current rate limits:
- Wonder: TBD requests/minute
- Spark: TBD requests/minute
- Voice: TBD requests/minute

## Documentation

Full API documentation: https://meta.ai/docs/api
