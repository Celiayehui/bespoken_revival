import React from 'react';

interface SignInPageProps {
    onSignInWithGoogle: () => void;
    onContinueAsGuest: () => void;
  }
  
  export default function SignInPage({ onSignInWithGoogle, onContinueAsGuest }: SignInPageProps) {
    return (
      <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col items-center justify-between px-6">
        {/* Logo Section - positioned from top */}
        <div className="flex-1 flex flex-col items-center justify-start pt-40">
          <div className="text-center">
            <div className="text-blue-600 mb-4">BeSpoken</div>
            <p className="text-gray-600 px-8">Practice English conversations with confidence</p>
          </div>
        </div>
  
        {/* Main CTA Section - centered and prominent */}
        <div className="flex flex-col items-center pb-32">
          <button
            onClick={onSignInWithGoogle}
            className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-md border border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-4 min-w-[240px] justify-center"
          >
            {/* Official Google logo SVG */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.591A9.996 9.996 0 0010 20z" fill="#34A853"/>
              <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
              <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.867C14.959.99 12.695 0 10 0 6.09 0 2.709 2.24 1.064 5.51l3.34 2.59C5.19 5.737 7.395 3.977 10 3.977z" fill="#EA4335"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
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
  