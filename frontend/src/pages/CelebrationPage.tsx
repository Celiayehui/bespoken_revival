import React from 'react';
import { motion } from 'motion/react';
import { Card } from '../components/ui/card';
import { CheckCircle, Trophy, Star } from 'lucide-react';

interface CelebrationPageProps {
  scenarioName: string;
  onBackToScenarios: () => void;
  onTryAgain: () => void;
  feedbackHistory: any[];
}

export default function CelebrationPage({ 
  scenarioName, 
  onBackToScenarios, 
  onTryAgain,
  feedbackHistory 
}: CelebrationPageProps) {
  // Confetti particles
  const confettiColors = ['#3b82f6', '#10b981', '#fbbf24', '#f59e0b', '#ef4444'];
  const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 1,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
  }));

  return (
    <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col overflow-hidden relative">
      {/* Confetti Animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confettiPieces.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute w-2 h-2 rounded-sm"
            style={{
              left: `${piece.left}%`,
              backgroundColor: piece.color,
            }}
            initial={{ y: -20, opacity: 1, rotate: 0 }}
            animate={{
              y: 900,
              opacity: 0,
              rotate: 360,
            }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: "linear",
              repeat: Infinity,
              repeatDelay: 1,
            }}
          />
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Company Logo */}
        <div className="flex justify-center pt-12 pb-6">
          <div className="text-3xl font-bold text-blue-600">
            BeSpoken
          </div>
        </div>

        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              delay: 0.2 
            }}
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10 text-green-600" />
            </div>
          </motion.div>
        </div>

        {/* Main Heading */}
        <div className="px-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            Congratulations! You completed {scenarioName}.
          </h1>
        </div>

        {/* Stats Card */}
        <div className="px-5 mb-6">
          <Card className="bg-white shadow-md rounded-xl p-5 border border-gray-100">
            <div className="flex items-center mb-4">
              <Star className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-bold text-gray-900">Overall Stats</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Points earned</span>
                <span className="text-gray-900 font-semibold">850</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Turns completed</span>
                <span className="text-gray-900 font-semibold">{feedbackHistory.length}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Feedback Summary */}
        <div className="px-5 mb-6">
          <Card className="bg-white shadow-md rounded-xl p-5 border border-gray-100">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-bold text-gray-900">Feedback Summary</h3>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {/* Actual feedback items from practice session */}
              {feedbackHistory.length > 0 ? feedbackHistory.map((item) => (
                <div key={item.turn_index} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="mb-3">
                    <span className="text-sm font-bold text-gray-900">Turn {item.turn_index}:</span>
                    <p className="text-sm text-gray-700 mt-1">{item.turn_transcript}</p>
                  </div>
                  <div className="space-y-2 ml-2">
                    <div>
                      <span className="text-xs font-semibold text-gray-600">You said:</span>
                      <p className="text-sm text-gray-700 mt-0.5">"{item.transcript}"</p>
                    </div>
                    {item.feedback.rewrite && item.feedback.rewrite !== 'none' && (
                      <div>
                        <span className="text-xs font-semibold text-gray-600">Try instead:</span>
                        <p className="text-sm text-gray-700 mt-0.5">"{item.feedback.rewrite}"</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-semibold text-blue-600">Tips:</span>
                      <p className="text-sm text-gray-700 mt-0.5">{item.feedback.tip}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-4">No feedback available yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Buttons - Fixed */}
      <div className="px-5 pb-8 pt-4 bg-white border-t border-gray-100">
        <button 
          onClick={onBackToScenarios}
          className="w-full h-12 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center mb-3 shadow-sm"
        >
          Back to Scenarios
        </button>
        <button 
          onClick={onTryAgain}
          className="w-full h-12 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-all flex items-center justify-center"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}