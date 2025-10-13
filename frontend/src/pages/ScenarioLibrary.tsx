import React, { useState, useEffect } from 'react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { CheckCircle } from 'lucide-react';

interface Scenario {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  image_url: string;
}

interface ScenarioLibraryProps {
  onSelectScenario?: (scenarioId: string) => void;
  completedScenarios?: Set<string>;
}

export default function ScenarioLibrary({ onSelectScenario, completedScenarios = new Set() }: ScenarioLibraryProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/scenarios`);
        if (!response.ok) {
          throw new Error('Failed to fetch scenarios');
        }
        const data = await response.json();
        setScenarios(data);
      } catch (error) {
        console.error('Error fetching scenarios:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScenarios();
  }, []);

  if (isLoading) {
    return (
      <div className="w-[390px] h-[844px] bg-white mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading scenarios...</p>
        </div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="w-[390px] h-[844px] bg-white mx-auto flex items-center justify-center">
        <p className="text-gray-600">No scenarios available</p>
      </div>
    );
  }

  const getDifficultyStyle = (difficulty: Scenario['difficulty']) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col">
      {/* Header Section */}
      <div className="pt-12 pb-6 px-5">
        <div className="flex justify-center mb-3">
          <div className="text-3xl font-bold text-blue-600">
            BeSpoken
          </div>
        </div>
        <p className="text-center text-gray-600">
          Choose a scenario to practice
        </p>
      </div>

      {/* Scrollable Scenario Cards */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="space-y-4">
          {scenarios.map((scenario) => {
            const isCompleted = completedScenarios.has(scenario.id);
            
            return (
              <div
                key={scenario.id}
                onClick={() => onSelectScenario?.(scenario.id)}
                className="bg-white shadow-md rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow relative"
              >
                {/* Completion Badge - Top Right */}
                {isCompleted && (
                  <div className="absolute top-3 right-3 z-10 bg-green-500 rounded-full p-1 shadow-lg">
                    <CheckCircle className="w-5 h-5 text-white" fill="white" />
                  </div>
                )}

                {/* Preview Image */}
                <div className="h-[160px] overflow-hidden">
                  <ImageWithFallback
                    src={scenario.image_url}
                    alt={scenario.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900 flex-1">
                      {scenario.title}
                    </h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ml-2 ${getDifficultyStyle(scenario.difficulty)}`}>
                      {scenario.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {scenario.description}
                  </p>
                  {isCompleted && (
                    <div className="mt-3 flex items-center text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      <span className="text-xs font-semibold">Completed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
