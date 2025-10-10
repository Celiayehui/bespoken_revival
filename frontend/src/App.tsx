import React, { useState } from 'react';
import ScenarioPage from './pages/ScenarioPage';
import CelebrationPage from './pages/CelebrationPage';

export default function App() {
  const [showCelebration, setShowCelebration] = useState(false);
  const [scenarioId, setScenarioId] = useState('happy_hour');
  const [currentTurn, setCurrentTurn] = useState(1);

  const handleComplete = () => {
    setShowCelebration(true);
  };

  const handleBackToScenarios = () => {
    // Placeholder for navigation to homepage
    window.location.href = '/';
  };

  const handleTryAgain = () => {
    // Reset state and go back to scenario
    setShowCelebration(false);
    setCurrentTurn(1);
  };

  if (showCelebration) {
    return (
      <CelebrationPage 
        scenarioName="Happy Hour - First Networking Event"
        onBackToScenarios={handleBackToScenarios}
        onTryAgain={handleTryAgain}
      />
    );
  }

  return (
    <ScenarioPage 
      scenarioId={scenarioId}
      onComplete={handleComplete}
      currentTurn={currentTurn}
      onTurnChange={setCurrentTurn}
    />
  );
}