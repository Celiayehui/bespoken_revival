import React from 'react';

interface SignInPageProps {
    onContinueAsGuest: () => void;
  }
  
  export default function SignInPage({ onContinueAsGuest }: SignInPageProps) {
    return (
      <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col items-center justify-between px-6">
        {/* Logo Section - positioned from top */}
        <div className="flex-1 flex flex-col items-center justify-start pt-40">
          <div className="text-center">
            <div 
              className="font-bold text-blue-600 mb-4" 
              style={{ fontSize: '50px', lineHeight: '1' }}
            >
              BeSpoken
            </div>
            <p className="text-gray-600 px-8">Practice English conversations with confidence</p>
          </div>
        </div>
  
        {/* Main CTA Section - centered and prominent */}
        <div className="flex flex-col items-center pb-32">
          {/* Google Sign-In Button will be rendered here */}
          <div id="googleSignInButton" className="min-w-[240px]"></div>
        </div>
  
        {/* Guest Option - near bottom, very subtle */}
        <div className="pb-16">
          <button
            onClick={onContinueAsGuest}
            className="text-gray-300 hover:text-gray-400 transition-colors text-xs"
          >
            Continue as guest
          </button>
        </div>
      </div>
    );
  }
  

