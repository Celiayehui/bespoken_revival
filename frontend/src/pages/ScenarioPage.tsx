import React, { useState, useRef, useEffect } from 'react';
import { Mic } from 'lucide-react';

type RecordingStatus = 'idle' | 'recording' | 'recorded' | 'feedback';

interface ScenarioPageProps {
  scenarioId: string;
  onComplete: () => void;
  currentTurn: number;
  onTurnChange: (turn: number) => void;
}

export default function ScenarioPage({ scenarioId, onComplete, currentTurn, onTurnChange }: ScenarioPageProps) {
  const [turnData, setTurnData] = useState<any>(null);
  const [isScenarioComplete, setIsScenarioComplete] = useState(false);
  
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchTurnData = async () => {
    try {
      const response = await fetch(`https://bespoken-revival.onrender.com/api/turn?scenario_id=${scenarioId}&turn_index=${currentTurn}`);
      if (!response.ok) {
        if (response.status === 404) {
          setIsScenarioComplete(true);
          return;
        }
        throw new Error('Failed to fetch turn data');
      }
      const data = await response.json();
      setTurnData(data);
    } catch (error) {
      console.error('Error fetching turn data:', error);
    }
  };

  useEffect(() => {
    fetchTurnData();
  }, [currentTurn]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        console.log('Audio recorded, blob size:', audioBlob?.size, 'bytes');
        setStatus('recorded');
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setStatus('recording');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const submitRecording = async () => {
    if (!audioBlob) return;
    
    setIsLoading(true);
    
    try {
      // Create FormData with required fields
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('user_id', 'test_user');
      formData.append('scenario_id', scenarioId);
      formData.append('turn_index', currentTurn.toString());
      
      // POST to Flask backend
      const response = await fetch('https://bespoken-revival.onrender.com/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format the feedback nicely
      let formattedFeedback = `You said: "${data.transcript}"\n\n${data.feedback.tip}`;
      
      if (data.feedback.rewrite && data.feedback.rewrite !== 'none') {
        formattedFeedback += `\n\nTry instead: "${data.feedback.rewrite}"`;
      }
      
      setFeedback(formattedFeedback);
      setStatus('feedback');
      
      // If this is the final turn (turn 3 for happy_hour scenario), automatically trigger celebration
      if (currentTurn === 3) {
        setTimeout(() => {
          onComplete();
        }, 2000); // Wait 2 seconds to let user see the feedback
      }
    } catch (error) {
      console.error('Error submitting recording:', error);
      setFeedback('Sorry, there was an error processing your recording. Please try again.');
      setStatus('feedback');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (isScenarioComplete) {
      onComplete();
    } else {
      onTurnChange(currentTurn + 1);
      setStatus('idle');
      setAudioBlob(null);
      setFeedback('');
    }
  };


  const handleRecordClick = () => {
    switch (status) {
      case 'idle':
        startRecording();
        break;
      case 'recording':
        stopRecording();
        break;
      case 'recorded':
        submitRecording();
        break;
      case 'feedback':
        handleNext();
        break;
    }
  };

  const getRecordButtonContent = () => {
    switch (status) {
      case 'idle':
        return <Mic className="w-8 h-8 text-white" />;
      case 'recording':
        return <Mic className="w-8 h-8 text-white animate-pulse" style={{ animation: 'voiceMemoPulse 1.5s ease-in-out infinite' }} />;
      case 'recorded':
        return <span className="text-sm text-white font-medium">SUBMIT</span>;
      case 'feedback':
        return <span className="text-sm text-white font-medium">NEXT</span>;
    }
  };

  const getRecordButtonStyle = () => {
    const baseClasses = "w-[70px] h-[70px] flex items-center justify-center transition-all shadow-lg";
    
    switch (status) {
      case 'idle':
        return `${baseClasses} rounded-full bg-red-500 hover:bg-red-600`;
      case 'recording':
        return `${baseClasses} rounded-2xl bg-red-600`;
      case 'recorded':
      case 'feedback':
        return `${baseClasses} rounded-full bg-blue-500 hover:bg-blue-600`;
      default:
        return `${baseClasses} rounded-full bg-gray-500`;
    }
  };


  return (
    <>
      <style>
        {`
          @keyframes voiceMemoPulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.05);
              opacity: 0.8;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col">
      {/* Company Logo */}
      <div className="flex justify-center pt-12 pb-8">
        <div className="text-3xl font-bold text-blue-600">
          BeSpoken
        </div>
      </div>

      {/* Title */}
      <div className="px-5 mb-6">
        <h1 className="text-lg font-bold text-gray-900">{turnData?.scenario_name || "Loading..."}</h1>
      </div>

      {/* Video Player */}
      <div className="px-5 mb-8">
        {turnData?.video_url ? (
          <video 
            src={turnData.video_url}
            controls
            autoPlay
            playsInline
            className="w-full h-[200px] rounded-lg object-cover"
          />
        ) : (
          <div className="w-full h-[200px] bg-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Loading video...</p>
          </div>
        )}
      </div>

      {/* Record Button */}
      <div className="flex justify-center mb-8">
        <button 
          className={getRecordButtonStyle()}
          onClick={handleRecordClick}
          disabled={isLoading}
        >
          {getRecordButtonContent()}
        </button>
      </div>

      {/* Feedback Section */}
      <div className="px-5 mb-8">
        <div className="w-full h-[250px] bg-gray-100 rounded-xl p-6 flex items-center justify-center">
          {isLoading ? (
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-600">Processing your recording...</p>
            </div>
          ) : feedback ? (
            <p className="text-gray-800 text-center leading-relaxed">
              {feedback}
            </p>
          ) : (
            <p className="text-gray-500 text-center">
              Your feedback will appear here...
            </p>
          )}
        </div>
      </div>

      {/* Scenario Complete Message */}
      {isScenarioComplete && (
        <div className="flex justify-center mt-auto mb-8">
          <div className="w-[350px] h-12 bg-green-500 text-white rounded-lg flex items-center justify-center">
            Scenario Complete!
          </div>
        </div>
      )}
      </div>
    </>
  );
}