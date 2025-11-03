/**
 * --- FIGMA REFERENCE STYLE ---
 * Below is the simplified Figma-generated UI code for reference.
 * Use it only for styling and layout cues (colors, spacing, text, button states).
 * DO NOT copy or change logic — keep all functions and hooks intact.
 * The goal is to match the visual design from the Figma prototype while keeping all logic, hooks, and backend calls intact.
 *
 * Figma → Current Code Mapping:
 * - Figma 'idle'          → current 'idle'
 * - Figma 'preparing'     → current 'starting'
 * - Figma 'recording'     → current 'recording'
 * - Figma 'readyToSubmit' → current 'recorded'
 * - Figma 'processing' + 'completed' → current 'feedback'
 *
 * So the complete flow in our code is:
 * idle → starting → recording → recorded → feedback
 *
 * --- FEEDBACK STATE BEHAVIOR ---
 * In our implementation, Figma’s "processing" and "completed" states are merged into one called 'feedback'.
 * - When feedback is still being generated (`isLoading === true` and no `feedbackData` yet), show a "Processing..." spinner.
 * - Once feedback is available (`isLoading === false` and `feedbackData` exists), show the feedback results and display the "Next" button.
 *
 * This logic is already implemented in the existing Feedback Section using `isLoading` and `feedbackData`.
 * Do NOT add new states for processing or completed — just restyle the existing UI to match Figma's visuals.
 *
 * --- TASK INSTRUCTIONS FOR CURSOR ---
 * 1. Keep all existing logic exactly as-is, including:
 *    - MediaRecorder behavior (start, stop, submit)
 *    - Feedback and turn handling
 *    - State transitions and API calls
 */

/*
// Recording button states (from Figma reference):
switch (recordingState) {
  case 'idle':
    <button className="w-[70px] h-[70px] bg-red-500 rounded-full ..."><Mic /></button>
  case 'preparing':
    <button disabled className="w-[70px] h-[70px] bg-orange-500 ..."><Loader2 /></button>
  case 'recording':
    <button className="w-[70px] h-[70px] bg-red-600 animate-pulse ...">🔴 Recording...</button>
  case 'readyToSubmit':
    <button className="w-full h-12 bg-blue-500 text-white rounded-lg ...">Submit</button>
    <button className="text-sm text-blue-600 mt-3 hover:underline">Record again</button>
  case 'processing':
    <button disabled className="w-full h-12 bg-blue-400 text-white ...">Processing...</button>
  case 'completed':
    <button className="w-full h-12 bg-blue-500 text-white ...">Next</button>
}
*/


import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Loader2, Circle } from 'lucide-react';
import HamburgerMenu from './HamburgerMenu';

type RecordingStatus = 'idle' | 'starting' | 'recording' | 'recorded' | 'feedback';

interface ScenarioPageProps {
  scenarioId: string;
  onComplete: () => void;
  currentTurn: number;
  onTurnChange: (turn: number) => void;
  feedbackHistory: any[];
  onFeedbackReceived: (turnData: any) => void;
  onBackToLibrary?: () => void;
  onNavigateToAccount?: () => void;
}

export default function ScenarioPage({ scenarioId, onComplete, currentTurn, onTurnChange, feedbackHistory, onFeedbackReceived, onBackToLibrary, onNavigateToAccount }: ScenarioPageProps) {
  const [turnData, setTurnData] = useState<any>(null);
  const [isScenarioComplete, setIsScenarioComplete] = useState(false);
  
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExampleVideo, setShowExampleVideo] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fetchTurnData = async () => {
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/turn?scenario_id=${scenarioId}&turn_index=${currentTurn}`);
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
    // Reset feedback-related state when turn changes
    setFeedbackData(null);
    setShowExampleVideo(false);
    setStatus('idle');
  }, [currentTurn]);





  // Handle video playback when turn data changes
  useEffect(() => {
    if (turnData?.video_url && videoRef.current) {
      // Only play the video if we're not currently recording or starting to record
      if (status === 'idle' || status === 'feedback') {
        videoRef.current.play().catch(error => {
          console.log('Video autoplay prevented:', error);
        });
      }
    }
  }, [turnData, status]);

  const startRecording = async () => {
    try {
      console.log('🎙️ Starting recording...');
      setStatus('starting'); // Set to 'starting' immediately
      
      // Pause video to prevent it from replaying when microphone permission is granted
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to find a supported mime type
      let options: { mimeType?: string } = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      }
      
      console.log('📹 Creating MediaRecorder with options:', options);
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Data available, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Recording stopped');
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
        setAudioBlob(audioBlob);
        console.log('Audio recorded, blob size:', audioBlob?.size, 'bytes');
        setStatus('recorded');
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => {
          console.log('🔇 Stopping track:', track.kind);
          track.stop();
        });
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setStatus('idle'); // Reset to idle on error
      };

      console.log('▶️ Starting MediaRecorder...');
      mediaRecorder.start(1000); // Collect data every 1 second
      
      // Wait longer for MediaRecorder to fully initialize and start capturing audio
      setTimeout(() => {
        console.log('✅ MediaRecorder ready, setting status to recording');
        setStatus('recording');
      }, 2500); // 2500ms delay to ensure recording has fully started
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      alert('Microphone access denied. Please allow microphone access and try again.');
      setStatus('idle'); // Reset to idle on error
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
      // Get user_id from Google authentication stored in localStorage after sign-in
      const userData = localStorage.getItem('bespoken-user');
      const userId = userData ? JSON.parse(userData).user_id : 'guest_user';
      formData.append('user_id', userId);
      formData.append('scenario_id', scenarioId);
      formData.append('turn_index', currentTurn.toString());
      
      // POST to Flask backend
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/upload`, {
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
      setFeedbackData({
        transcript: data.transcript,
        feedback: data.feedback,
        turn_transcript: turnData?.turn_transcript || '',
        example_video_url: turnData?.example_video_url || null  // Preserve example_video_url from current turn
      });
      setStatus('feedback');
      
      // Store feedback data in history
      onFeedbackReceived({
        turn_index: currentTurn,
        transcript: data.transcript,
        feedback: data.feedback,
        turn_transcript: turnData?.turn_transcript || ''
      });
      
      // Check if the next turn exists
      const checkNextTurn = async () => {
        try {
          const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
          const nextTurnResponse = await fetch(`${apiUrl}/api/turn?scenario_id=${scenarioId}&turn_index=${currentTurn + 1}`);
          if (nextTurnResponse.status === 404) {
            // No next turn exists, this was the final turn
            setIsScenarioComplete(true);
          }
        } catch (error) {
          console.error('Error checking next turn:', error);
          // If there's an error checking, assume this might be the final turn
          setIsScenarioComplete(true);
        }
      };
      
      checkNextTurn();
    } catch (error) {
      console.error('Error submitting recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setFeedback(`Sorry, there was an error processing your recording: ${errorMessage}. Please try again.`);
      // Set feedbackData with error info so the feedback section renders
      setFeedbackData({
        transcript: 'Error: Could not process recording',
        feedback: {
          tip: errorMessage.includes('502') 
            ? 'The server is not responding. Please make sure the backend server is running and try again.'
            : 'There was an error processing your recording. Please try again.',
          rewrite: 'none'
        },
        turn_transcript: turnData?.turn_transcript || '',
        example_video_url: turnData?.example_video_url || null  // Preserve example_video_url even on error
      });
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
      setFeedbackData(null);
      setShowExampleVideo(false);  // Reset example video when moving to next turn
    }
  };


  const handleRecordClick = () => {
    switch (status) {
      case 'idle':
        startRecording();
        break;
      case 'starting':
        // Do nothing - user should wait for recording to start
        console.log('⏳ Recording is starting, please wait...');
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

  // Helper function to get button content based on status
  const getRecordButtonContent = () => {
    switch (status) {
      case 'idle':
        return <Mic className="w-8 h-8 text-white" />;
      case 'starting':
        return <Loader2 className="w-8 h-8 text-white animate-spin" />;
      case 'recording':
        return <Circle className="w-6 h-6 text-white" fill="white" />;
      case 'recorded':
        return <span className="text-base font-medium text-white">Submit</span>;
      case 'feedback':
        return <span className="text-base font-medium text-white">Next</span>;
      default:
        return <Mic className="w-8 h-8 text-white" />;
    }
  };

  // Helper to ensure button always has visible content
  const getButtonDisplayContent = () => {
    if (isLoading && (status === 'recorded' || status === 'feedback')) {
      return 'Processing...';
    }
    return getRecordButtonContent();
  };

  // Helper function to get helper text below button
  const getHelperText = () => {
    switch (status) {
      case 'starting':
        return <p className="text-sm text-orange-600 mt-3 text-center">Preparing...</p>;
      case 'recording':
        return <p className="text-sm text-red-600 mt-3 text-center">🔴 Recording...</p>;
      case 'recorded':
        return (
          <button
            onClick={() => {
              setStatus('idle');
              setAudioBlob(null);
            }}
            className="text-sm text-blue-600 mt-3 hover:underline transition-colors"
          >
            Record again
          </button>
        );
      default:
        return null;
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
      <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col relative">
      {onNavigateToAccount && <HamburgerMenu onNavigateToAccount={onNavigateToAccount} />}
      {/* Company Logo */}
      <div className="flex justify-center pt-12 pb-8">
        <div 
          className="text-3xl font-bold text-blue-600 cursor-pointer hover:text-blue-700 transition-colors"
          onClick={onBackToLibrary}
        >
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
            ref={videoRef}
            src={turnData.video_url}
            controls
            playsInline
            className="w-full h-[200px] rounded-lg object-contain bg-black"
          />
        ) : (
          <div className="w-full h-[200px] bg-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Loading video...</p>
          </div>
        )}
      </div>

      {/* Record Button */}
      <div className="px-5 mb-8">
        {(status === 'recorded' || status === 'feedback') ? (
          // Full-width button for recorded and feedback states
          <div className="flex flex-col items-center">
            <button
              onClick={handleRecordClick}
              disabled={isLoading}
              className={`w-full h-12 rounded-lg font-medium text-white transition-all shadow-lg flex items-center justify-center min-h-[48px] ${
                isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
              }`}
            >
              {getButtonDisplayContent() || <span className="text-base font-medium text-white">Next</span>}
            </button>
            {status === 'recorded' && getHelperText()}
          </div>
        ) : (
          // Circular/square button for idle, starting, and recording states
          <div className="flex flex-col items-center">
            <button
              onClick={handleRecordClick}
              disabled={isLoading || status === 'starting'}
              className={`w-[70px] h-[70px] flex items-center justify-center transition-all shadow-lg ${
                status === 'idle'
                  ? 'rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700'
                  : status === 'starting'
                  ? 'rounded-full bg-orange-500 cursor-wait animate-pulse'
                  : status === 'recording'
                  ? 'rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 animate-pulse'
                  : 'rounded-full bg-gray-500'
              }`}
            >
              {getRecordButtonContent() || <Mic className="w-8 h-8 text-white" />}
            </button>
            {getHelperText()}
          </div>
        )}
      </div>

      {/* Feedback Section */}
      {feedbackData && (
        <div className="px-5 mb-8">
          <div className="w-full bg-white rounded-lg border border-gray-200 p-5">
            <div className="space-y-4">
              <div>
                <span className="text-sm font-semibold text-gray-900">You said:</span>
                <p className="text-gray-900 mt-2 p-3 bg-gray-50 rounded-md border-l-4 border-gray-300">
                  "{feedbackData.transcript}"
                </p>
              </div>
              {feedbackData.feedback.rewrite && feedbackData.feedback.rewrite !== 'none' && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">Try instead:</span>
                  <p className="text-gray-900 mt-2 p-3 bg-green-50 rounded-md border-l-4 border-green-400">
                    "{feedbackData.feedback.rewrite}"
                  </p>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-blue-600">Tips:</span>
                <p className="text-gray-700 mt-2 p-3 bg-blue-50 rounded-md border-l-4 border-blue-400">
                  {feedbackData.feedback.tip}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Native Speaker Example Video Section - Only show after feedback */}
      {(() => {
        const hasExampleVideo = feedbackData && (feedbackData.example_video_url || turnData?.example_video_url);
        return hasExampleVideo ? (
          <div className="px-5 mb-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              💡 Native Speaker Example (Optional)
            </h3>
            <div className="w-full h-[200px] rounded-lg flex items-center justify-center relative bg-gradient-to-br from-purple-900 to-purple-700">
              <button 
                onClick={() => setShowExampleVideo(true)}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all bg-white bg-opacity-20 hover:bg-opacity-30 active:bg-opacity-40"
              >
                <Play className="w-6 h-6 text-white ml-1" fill="white" stroke="white" strokeWidth={2} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">
              Watch how a native speaker would respond to this scenario
            </p>
          </div>
        ) : null;
      })()}
      </div>

            {/* Example Video Player Modal */}
      {showExampleVideo && (feedbackData?.example_video_url || turnData?.example_video_url) && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
          <div className="relative w-[390px] px-5">
            <button 
              onClick={() => setShowExampleVideo(false)}
              className="absolute -top-12 right-5 text-white text-3xl font-bold hover:text-gray-300 transition-colors"
            >
              ✕
            </button>
            <video 
              src={feedbackData?.example_video_url || turnData?.example_video_url} 
              controls 
              autoPlay
              playsInline
              className="w-full rounded-lg"
              onEnded={() => setShowExampleVideo(false)}
              onError={() => setShowExampleVideo(false)}
            />
            <p className="text-white text-center text-sm mt-3">
              Native Speaker Example
            </p>
          </div>
        </div>
      )}
    </>
  );
}