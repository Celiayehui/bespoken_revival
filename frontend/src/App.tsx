import React, { useState, useEffect } from 'react';
import ScenarioLibrary from './pages/ScenarioLibrary';
import ScenarioPage from './pages/ScenarioPage';
import CelebrationPage from './pages/CelebrationPage';
import SignInPage from './pages/SignInPage';
import AccountPage from './pages/AccountPage';

type Screen = 'signIn' | 'library' | 'scenario' | 'celebration' | 'account';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bespoken-user');
      const screen = saved ? 'library' : 'signIn';
      console.log('Initializing currentScreen:', screen, 'based on user:', !!saved);
      return screen;
    }
    return 'signIn';
  });
  const [scenarioId, setScenarioId] = useState('coffee_shop');
  const [currentTurn, setCurrentTurn] = useState(1);
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);
  const [user, setUser] = useState<{user_id: string, email: string, name: string} | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bespoken-user');
      console.log('Loading user from localStorage:', saved);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bespoken-completed-scenarios');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  const [totalTurnsCompleted, setTotalTurnsCompleted] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bespoken-total-turns');
      return saved ? parseInt(saved) : 0;
    }
    return 0;
  });

  const [weeklyActivity, setWeeklyActivity] = useState<Array<{day: string, turns: number}>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bespoken-weekly-activity');
      return saved ? JSON.parse(saved) : [
        {day: 'Mon', turns: 0}, {day: 'Tue', turns: 0}, {day: 'Wed', turns: 0},
        {day: 'Thu', turns: 0}, {day: 'Fri', turns: 0}, {day: 'Sat', turns: 0}, {day: 'Sun', turns: 0}
      ];
    }
    return [
      {day: 'Mon', turns: 0}, {day: 'Tue', turns: 0}, {day: 'Wed', turns: 0},
      {day: 'Thu', turns: 0}, {day: 'Fri', turns: 0}, {day: 'Sat', turns: 0}, {day: 'Sun', turns: 0}
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bespoken-completed-scenarios', JSON.stringify(Array.from(completedScenarios)));
    }
  }, [completedScenarios]);

  // Persist user state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (user) {
        console.log('Saving user to localStorage:', user);
        localStorage.setItem('bespoken-user', JSON.stringify(user));
      } else {
        console.log('Removing user from localStorage');
        localStorage.removeItem('bespoken-user');
      }
    }
  }, [user]);

  // Persist totalTurnsCompleted to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bespoken-total-turns', totalTurnsCompleted.toString());
    }
  }, [totalTurnsCompleted]);

  // Persist weeklyActivity to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bespoken-weekly-activity', JSON.stringify(weeklyActivity));
    }
  }, [weeklyActivity]);

  // Initialize Google Identity Services once when component mounts
  useEffect(() => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.warn('Google Client ID not configured');
      return;
    }

    // Wait for Google Identity Services to load
    const initializeGoogle = () => {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
        const google = (window as any).google;
        
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          
          // Render the Google Sign-In button
          const buttonDiv = document.getElementById('googleSignInButton');
          if (buttonDiv) {
            google.accounts.id.renderButton(buttonDiv, {
              theme: "outline",
              size: "large",
              text: "signin_with",
              width: 240
            });
            console.log('Google Sign-In button rendered');
          } else {
            console.warn('Google Sign-In button div not found');
          }
          
          console.log('Google Identity Services initialized');
        } catch (error) {
          console.error('Failed to initialize Google Identity Services:', error);
        }
      } else {
        // Retry after a short delay if Google services aren't loaded yet
        setTimeout(initializeGoogle, 100);
      }
    };

    // Start initialization
    initializeGoogle();
  }, []); // Empty dependency array - run only once on mount

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
    // Add 8 to total turns completed
    setTotalTurnsCompleted(prev => prev + 8);
    
    // Update today's weekly activity
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayMap = [6, 0, 1, 2, 3, 4, 5]; // Map Sunday=0 to index 6, Monday=1 to index 0, etc.
    const dayIndex = dayMap[today];
    
    setWeeklyActivity(prev => prev.map((day, index) => 
      index === dayIndex ? { ...day, turns: day.turns + 8 } : day
    ));
    
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

  const handleNavigateToAccount = () => { 
    setCurrentScreen('account'); 
  };

  const handleLogout = () => { 
    setUser(null); 
    setCurrentScreen('signIn'); 
  };


  const handleCredentialResponse = async (response: any) => {
    try {
      console.log('Google credential received:', response.credential);
      
      // Send credential to backend
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const backendResponse = await fetch(`${apiUrl}/auth/google/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential
        })
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const userData = await backendResponse.json();
      console.log('User authenticated:', userData);
      
      // Save user info in state
      setUser({
        user_id: userData.user_id,
        email: userData.email,
        name: userData.name
      });
      
      // Navigate to library
      setCurrentScreen('library');
      
    } catch (error) {
      console.error('Google sign-in error:', error);
      alert(`Sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleContinueAsGuest = () => {
    // Navigate to library without authentication
    setCurrentScreen('library');
  };

  if (currentScreen === 'signIn') {
  return (
      <SignInPage 
        onContinueAsGuest={handleContinueAsGuest}
      />
    );
  }

  if (currentScreen === 'celebration') {
    return (
      <CelebrationPage 
        scenarioName={scenarioNames[scenarioId] || scenarioId}
        onBackToScenarios={handleBackToScenarios}
        onTryAgain={handleTryAgain}
        feedbackHistory={feedbackHistory}
        onNavigateToAccount={handleNavigateToAccount}
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
        onBackToLibrary={handleBackToScenarios}
        onNavigateToAccount={handleNavigateToAccount}
      />
    );
  }

  if (currentScreen === 'account') {
    return (
      <AccountPage 
        userName={user?.name || 'Guest User'}
        userEmail={user?.email || 'guest@bespoken.app'}
        isGuest={!user}
        completedScenariosCount={completedScenarios.size}
        totalTurnsCompleted={totalTurnsCompleted}
        weeklyActivityData={weeklyActivity}
        onLogout={handleLogout}
        onBack={handleBackToScenarios}
      />
    );
  }

  return (
    <ScenarioLibrary 
      onSelectScenario={handleSelectScenario}
      completedScenarios={completedScenarios}
      onNavigateToAccount={handleNavigateToAccount}
    />
  );
}