import { useState, useEffect } from 'react';
import ScenarioLibrary from './pages/ScenarioLibrary';
import ScenarioPage from './pages/ScenarioPage';
import CelebrationPage from './pages/CelebrationPage';

type Screen = 'library' | 'scenario' | 'celebration';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('library');
  const [scenarioId, setScenarioId] = useState('coffee_shop');
  const [currentTurn, setCurrentTurn] = useState(1);
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);
  
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bespoken-completed-scenarios');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bespoken-completed-scenarios', JSON.stringify(Array.from(completedScenarios)));
    }
  }, [completedScenarios]);

  // Map scenario IDs to display names
  const scenarioNames: Record<string, string> = {
    'happy_hour': 'Happy Hour - First Networking Event',
    'coffee_shop': 'Order coffee at Starbucks',
    'hotel_checkin': 'Hotel check-in',
    'job_interview': 'Job interview: Tell me about yourself',
    'doctor_appointment': 'Making a doctor\'s appointment',
    'salary_negotiation': 'Negotiating a salary raise',
  };

  const handleSelectScenario = (selectedScenarioId: string) => {
    setScenarioId(selectedScenarioId);
    setCurrentTurn(1);
    setFeedbackHistory([]);
    setCurrentScreen('scenario');
  };

  const handleComplete = () => {
    setCompletedScenarios(prev => new Set([...prev, scenarioId]));
    setCurrentScreen('celebration');
  };

  const handleBackToScenarios = () => {
    setCurrentScreen('library');
  };

  const handleTryAgain = () => {
    setCurrentTurn(1);
    setFeedbackHistory([]);
    setCurrentScreen('scenario');
  };

  const handleFeedbackReceived = (turnData: any) => {
    setFeedbackHistory(prev => [...prev, turnData]);
  };

  if (currentScreen === 'celebration') {
    return (
      <CelebrationPage 
        scenarioName={scenarioNames[scenarioId] || scenarioId}
        onBackToScenarios={handleBackToScenarios}
        onTryAgain={handleTryAgain}
        feedbackHistory={feedbackHistory}
      />
    );
  }

  if (currentScreen === 'scenario') {
    return (
      <ScenarioPage 
        scenarioId={scenarioId}
        onComplete={handleComplete}
        currentTurn={currentTurn}
        onTurnChange={setCurrentTurn}
        feedbackHistory={feedbackHistory}
        onFeedbackReceived={handleFeedbackReceived}
      />
    );
  }

  return (
    <ScenarioLibrary 
      onSelectScenario={handleSelectScenario}
      completedScenarios={completedScenarios}
    />
  );
}