import React from 'react';
import { CheckCircle2, MessageSquare, TrendingUp } from 'lucide-react';
import { Confetti } from '../components/Confetti';
import { Card } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';

interface CelebrationPageProps {
  scenarioName: string;
  onBackToScenarios: () => void;
  onTryAgain: () => void;
}

export default function CelebrationPage({ 
  scenarioName, 
  onBackToScenarios, 
  onTryAgain 
}: CelebrationPageProps) {
  return (
    <div className="size-full flex items-center justify-center bg-gray-50">
      {/* Mobile container */}
      <div className="relative w-[390px] h-[844px] bg-white overflow-hidden flex flex-col">
        {/* Confetti Animation */}
        <Confetti />

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Logo */}
          <div className="pt-12 pb-6 px-6">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-blue-700">BeSpoken</h1>
            </div>
          </div>

          {/* Success Icon */}
          <div className="flex justify-center pb-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Main Heading */}
          <div className="px-6 pb-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Congratulations!
            </h2>
            <p className="text-lg text-gray-700">
              You completed {scenarioName}!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="px-6 pb-6 flex gap-3">
            <button 
              onClick={onBackToScenarios}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-md"
            >
              Back to Scenarios
            </button>
            <button 
              onClick={onTryAgain}
              className="flex-1 h-12 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold rounded-lg transition-all"
            >
              Try Again
            </button>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 pb-6">
              {/* Stats Card */}
              <Card className="p-5 shadow-md border-gray-200">
                <div className="flex items-center gap-2 pb-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="text-gray-900">Overall Stats</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Points Earned</span>
                    <span className="text-blue-600">850 pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Turns Completed</span>
                    <span className="text-blue-600">12 turns</span>
                  </div>
                </div>
              </Card>

              {/* Turn-by-Turn Feedback */}
              <Card className="p-5 shadow-md border-gray-200">
                <div className="flex items-center gap-2 pb-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <h3 className="text-gray-900">Your Feedback History</h3>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      turn: 1,
                      youSaid: "I would like one coffee please",
                      tryInstead: "I'd like a coffee, please",
                      tips: "Try using contractions for a more natural flow"
                    },
                    {
                      turn: 2,
                      youSaid: "How much cost it?",
                      tryInstead: "How much does it cost?",
                      tips: "Remember to use 'does' with the verb 'cost'"
                    },
                    {
                      turn: 3,
                      youSaid: "Thank you very much",
                      tryInstead: "Thank you very much",
                      tips: "Perfect! Natural and polite expression"
                    },
                    {
                      turn: 4,
                      youSaid: "Can I have sugar?",
                      tryInstead: "Could I have some sugar?",
                      tips: "Using 'could' and 'some' sounds more polite"
                    }
                  ].map((feedback) => (
                    <div key={feedback.turn} className="border-l-2 border-blue-500 pl-3 py-2 space-y-1">
                      <div className="flex items-center gap-2 pb-1">
                        <span className="text-gray-900">Turn {feedback.turn}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-600">
                          <span className="text-gray-700">You said:</span> "{feedback.youSaid}"
                        </p>
                        <p className="text-gray-600">
                          <span className="text-gray-700">Try instead:</span> "{feedback.tryInstead}"
                        </p>
                        <p className="text-gray-600">
                          <span className="text-gray-700">Tips:</span> {feedback.tips}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
