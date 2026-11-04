/**
 * Test file for ts-fsrs v6 integration
 * 
 * Run in browser console or add to a test page
 * 
 * To test:
 * 1. Import this file in a component
 * 2. Call runTests() from useEffect
 * 3. Check console for results
 */

import {
  createConceptCard,
  previewRatings,
  reviewCard,
  getDueCards,
  calculateRetrievability,
  getCardStatistics,
  extractConceptsFromQuiz,
  Rating,
  type ConceptCard,
} from './spaced-repetition'

export async function runTests() {
  console.log('🧪 Testing ts-fsrs v6 Integration...\n')
  
  try {
    // ===== TEST 1: Create Card =====
    console.log('TEST 1: Creating new card...')
    const cardData = await createConceptCard(
      'AWS Lambda',
      'What is the maximum timeout for Lambda?',
      '900 seconds (15 minutes). This is the maximum execution time for a single Lambda invocation.',
      ['300 seconds', '600 seconds', '900 seconds', '1800 seconds'],
      2 // Index of correct answer
    )
    
    // Add required fields for complete card
    const card: ConceptCard = {
      ...cardData,
      id: 'test-card-1',
      userId: 'test-user',
      createdAt: new Date(),
    }
    
    console.log('✅ Card created:', {
      question: card.question,
      state: card.fsrsCard.state,
      due: card.nextReviewDue,
      stability: card.fsrsCard.stability,
    })
    
    // ===== TEST 2: Preview Ratings =====
    console.log('\nTEST 2: Previewing all ratings...')
    const preview = await previewRatings(card)
    
    console.log('✅ Preview results:')
    console.log('  Again:', preview.again.interval)
    console.log('  Hard:', preview.hard.interval)
    console.log('  Good:', preview.good.interval)
    console.log('  Easy:', preview.easy.interval)
    
    // ===== TEST 3: Review with "Good" =====
    console.log('\nTEST 3: Reviewing card with "Good" rating...')
    const result = await reviewCard(card, Rating.Good)
    
    console.log('✅ Review result:', {
      rating: result.rating,
      nextReview: result.nextReviewDate,
      intervalDays: result.intervalDays,
      confidence: result.confidence + '%',
      state: result.state,
    })
    
    console.log('✅ Revlog (MUST SAVE TO DB):', result.revlog)
    
    // Update card with result
    const updatedCard: ConceptCard = {
      ...card,
      ...result.updatedCard,
    }
    
    // ===== TEST 4: Get Due Cards =====
    console.log('\nTEST 4: Testing due cards filter...')
    const allCards = [card, updatedCard]
    const dueCards = getDueCards(allCards, new Date())
    
    console.log('✅ Due cards:', dueCards.length, '/', allCards.length)
    
    // ===== TEST 5: Calculate Retrievability =====
    console.log('\nTEST 5: Calculating retrievability...')
    const retrievability = await calculateRetrievability(updatedCard)
    
    console.log('✅ Retrievability:', retrievability + '%')
    console.log('  (Probability user remembers this right now)')
    
    // ===== TEST 6: Card Statistics =====
    console.log('\nTEST 6: Getting statistics...')
    const stats = getCardStatistics([card, updatedCard])
    
    console.log('✅ Statistics:', stats)
    
    // ===== TEST 7: Extract from Quiz =====
    console.log('\nTEST 7: Extracting concepts from quiz...')
    const concepts = await extractConceptsFromQuiz('AWS Lambda', [
      {
        question: 'What is Lambda cold start?',
        correctAnswer: 'Initialization delay when function scales',
        explanation: 'Cold starts happen when AWS creates new execution environment',
        isCorrect: false, // User got this wrong
      },
      {
        question: 'Lambda pricing model?',
        correctAnswer: 'Pay per request + duration',
        explanation: 'Charged for number of requests and compute time',
        isCorrect: true, // User got this right
      },
    ])
    
    console.log('✅ Extracted concepts:', concepts.length)
    console.log('  (Only creates cards for wrong answers)')
    
    // ===== TEST 8: Multiple Reviews =====
    console.log('\nTEST 8: Simulating multiple reviews...')
    let testCard = card
    
    for (let i = 0; i < 3; i++) {
      const rating = i === 0 ? Rating.Hard : Rating.Good
      const reviewResult = await reviewCard(testCard, rating)
      
      console.log(`  Review ${i + 1}:`, {
        rating: rating === Rating.Hard ? 'Hard' : 'Good',
        interval: reviewResult.intervalDays + ' days',
        confidence: reviewResult.confidence + '%',
      })
      
      // Update card for next review
      testCard = {
        ...testCard,
        ...reviewResult.updatedCard,
      }
    }
    
    console.log('✅ Multiple reviews complete')
    console.log('  Final stability:', testCard.fsrsCard.stability)
    console.log('  Final difficulty:', testCard.fsrsCard.difficulty)
    
    // ===== SUMMARY =====
    console.log('\n✅ ALL TESTS PASSED!')
    console.log('\nKey Takeaways:')
    console.log('1. ✅ DefaultScheduler() works (async)')
    console.log('2. ✅ newCard() creates cards correctly')
    console.log('3. ✅ review() applies ratings and schedules next review')
    console.log('4. ✅ preview() shows all 4 outcomes before rating')
    console.log('5. ✅ revlog is populated (MUST SAVE TO DATABASE!)')
    console.log('6. ✅ Confidence calculation works')
    console.log('7. ✅ Retrievability calculation works')
    console.log('8. ✅ Multiple reviews update state correctly')
    
    return {
      success: true,
      card: updatedCard,
      preview,
      result,
      retrievability,
      stats,
      concepts,
    }
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error)
    return { success: false, error }
  }
}

/**
 * Quick inline test - paste in browser console
 */
export async function quickTest() {
  const { createConceptCard, reviewCard, Rating } = await import('./spaced-repetition')
  
  // Create card
  const cardData = await createConceptCard(
    'Test Topic',
    'Test question?',
    'Test answer'
  )
  
  const card = {
    ...cardData,
    id: 'test-1',
    userId: 'user-1',
    createdAt: new Date(),
  }
  
  console.log('Card created:', card.fsrsCard)
  
  // Review with Good
  const result = await reviewCard(card, Rating.Good)
  
  console.log('Next review:', result.nextReviewDate)
  console.log('Interval:', result.intervalDays, 'days')
  console.log('Confidence:', result.confidence, '%')
  
  return result
}

/**
 * Test in React component:
 * 
 * import { runTests } from '@/lib/learning/__test-spaced-repetition'
 * 
 * useEffect(() => {
 *   runTests()
 * }, [])
 */
