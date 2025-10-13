import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { CheckCircle } from 'lucide-react';

interface Scenario {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  imageUrl: string;
}

interface ScenarioLibraryProps {
  onSelectScenario?: (scenarioId: string) => void;
  completedScenarios?: Set<string>;
}

export default function ScenarioLibrary({ onSelectScenario, completedScenarios = new Set() }: ScenarioLibraryProps) {
  const scenarios: Scenario[] = [
    {
      id: 'happy_hour',
      title: 'Happy Hour - First Networking Event',
      difficulty: 'Beginner',
      description: 'Practice introducing yourself and making small talk at a work happy hour with new colleagues.',
      imageUrl: 'https://images.unsplash.com/photo-1688975308004-6f10feed935f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wJTIwYmFyaXN0YXxlbnwxfHx8fDE3NjAzMjIxMTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'restaurant_reservation',
      title: 'Make a restaurant reservation',
      difficulty: 'Intermediate',
      description: 'Learn how to book a table, specify dietary requirements, and confirm details over the phone.',
      imageUrl: 'https://images.unsplash.com/photo-1651209315802-12190ccfee26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwdGFibGUlMjBkaW5pbmd8ZW58MXx8fHwxNzYwMzQ4NzI2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'hotel_checkin',
      title: 'Check in at a hotel',
      difficulty: 'Beginner',
      description: 'Master the essential phrases for checking in, asking about amenities, and getting your room key.',
      imageUrl: 'https://images.unsplash.com/photo-1759038085950-1234ca8f5fed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3RlbCUyMHJlY2VwdGlvbiUyMGRlc2t8ZW58MXx8fHwxNzYwMzcwODMxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'airport_navigation',
      title: 'Navigate the airport',
      difficulty: 'Advanced',
      description: 'Practice handling security, customs, and finding your gate in an international airport setting.',
      imageUrl: 'https://images.unsplash.com/photo-1706544132533-c2828a971fd0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwb3J0JTIwdGVybWluYWwlMjB0cmF2ZWx8ZW58MXx8fHwxNzYwMzcwODMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'business_meeting',
      title: 'Join a business meeting',
      difficulty: 'Advanced',
      description: 'Develop professional communication skills for introductions, presentations, and formal discussions.',
      imageUrl: 'https://images.unsplash.com/photo-1615914143778-1a1a6e50c5dd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjBvZmZpY2V8ZW58MXx8fHwxNzYwMzI3MTQyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

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
                    src={scenario.imageUrl}
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
