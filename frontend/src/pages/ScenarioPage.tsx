import React, { useState, useRef, useEffect } from 'react';
import { Mic } from 'lucide-react';

type RecordingStatus = 'idle' | 'starting' | 'recording' | 'recorded' | 'feedback';

interface ScenarioPageProps {
  scenarioId: string;
  onComplete: () => void;
  currentTurn: number;
  onTurnChange: (turn: number) => void;
  feedbackHistory: any[];
  onFeedbackReceived: (turnData: any) => void;
  onBackToLibrary?: () => void;
}

export default function ScenarioPage({ scenarioId, onComplete, currentTurn, onTurnChange, feedbackHistory, onFeedbackReceived, onBackToLibrary }: ScenarioPageProps) {
  const [turnData, setTurnData] = useState<any>(null);
  const [isScenarioComplete, setIsScenarioComplete] = useState(false);
  
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
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
  }, [currentTurn]);

  useEffect(() => {
    console.log('🔵 Status changed to:', status);
  }, [status]);

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
        turn_transcript: turnData?.turn_transcript || ''
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
      setFeedbackData(null);
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

  const getRecordButtonContent = () => {
    console.log('🎨 getRecordButtonContent called with status:', status);
    switch (status) {
      case 'idle':
        return <Mic className="w-8 h-8 text-white" />;
      case 'starting':
        console.log('🎨 Rendering starting button content');
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-white font-medium mt-1">FIRING UP</span>
          </div>
        );
      case 'recording':
        console.log('🎨 Rendering recording button content');
        return (
          <div className="flex flex-col items-center justify-center">
            <Mic className="w-8 h-8 text-white animate-pulse" style={{ animation: 'voiceMemoPulse 1.5s ease-in-out infinite' }} />
            <span className="text-xs text-white font-medium mt-1">STOP</span>
          </div>
        );
      case 'recorded':
        return <span className="text-sm text-white font-medium">SUBMIT</span>;
      case 'feedback':
        return <span className="text-sm text-white font-medium">NEXT</span>;
      default:
        console.warn('⚠️ Unknown status:', status);
        return <Mic className="w-8 h-8 text-white" />;
    }
  };

  const getRecordButtonStyle = () => {
    const baseClasses = "w-[70px] h-[70px] flex items-center justify-center transition-all shadow-lg";
    
    console.log('🎨 getRecordButtonStyle called with status:', status);
    switch (status) {
      case 'idle':
        return `${baseClasses} rounded-full bg-red-500 hover:bg-red-600`;
      case 'starting':
        console.log('🎨 Applying starting button styles');
        return `${baseClasses} rounded-2xl bg-orange-500`;
      case 'recording':
        console.log('🎨 Applying recording button styles');
        return `${baseClasses} rounded-2xl bg-red-600 hover:bg-red-700 active:bg-red-800`;
      case 'recorded':
      case 'feedback':
        return `${baseClasses} rounded-full bg-blue-500 hover:bg-blue-600`;
      default:
        console.warn('⚠️ Unknown status for button style:', status);
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
      <div className="flex justify-center mb-8">
        <button 
          className={getRecordButtonStyle()}
          onClick={handleRecordClick}
          disabled={isLoading}
          style={{
            backgroundColor: status === 'recording' ? '#dc2626' : status === 'starting' ? '#f97316' : status === 'idle' ? '#ef4444' : status === 'recorded' || status === 'feedback' ? '#3b82f6' : '#6b7280',
            borderRadius: status === 'recording' || status === 'starting' ? '0.5rem' : '9999px',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            cursor: status === 'starting' ? 'wait' : 'pointer'
          }}
        >
          {getRecordButtonContent()}
        </button>
      </div>

      {/* Feedback Section */}
      <div className="px-5 mb-8">
        <div className="w-full min-h-[250px] bg-white rounded-xl border border-gray-200 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600">Processing your recording...</p>
              </div>
            </div>
          ) : feedbackData ? (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-semibold text-gray-700">You said:</span>
                <p className="text-gray-900 mt-1 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                  "{feedbackData.transcript}"
                </p>
              </div>
              {feedbackData.feedback.rewrite && feedbackData.feedback.rewrite !== 'none' && (
                <div>
                  <span className="text-sm font-semibold text-gray-700">Try instead:</span>
                  <p className="text-gray-900 mt-1 p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                    "{feedbackData.feedback.rewrite}"
                  </p>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-blue-600">Tips:</span>
                <p className="text-gray-700 mt-1 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                  {feedbackData.feedback.tip}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-gray-500 text-center">
                Your feedback will appear here...
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}