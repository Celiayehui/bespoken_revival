import React, { useEffect, useState } from 'react';

interface SignInPageProps {
    onContinueAsGuest: () => void;
}

interface GoogleCredentialResponse {
    credential: string;
}

interface UserData {
    user_id: string;
    email: string;
    name: string;
}

export default function SignInPage({ onContinueAsGuest }: SignInPageProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
        
        if (!clientId) {
            console.error('Google Client ID not configured');
            setError('Google Sign-In is not configured. Please contact support.');
            return;
        }

        // Load Google Sign-In script dynamically
        const loadGoogleScript = () => {
            return new Promise<void>((resolve, reject) => {
                // Check if script is already loaded
                if ((window as any).google?.accounts?.id) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Google Sign-In script'));
                document.head.appendChild(script);
            });
        };

        const initializeGoogleSignIn = async () => {
            try {
                await loadGoogleScript();
                
                const google = (window as any).google;
                if (!google?.accounts?.id) {
                    throw new Error('Google Sign-In not available');
                }

                // Initialize Google Sign-In
                google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                // Render the button
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

            } catch (error) {
                console.error('Failed to initialize Google Sign-In:', error);
                setError('Failed to load Google Sign-In. Please refresh the page and try again.');
            }
        };

        initializeGoogleSignIn();
    }, []);

    const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('Google credential received');

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

            const userData: UserData = await backendResponse.json();
            console.log('User authenticated:', userData);

            // Store user data in localStorage
            localStorage.setItem('bespoken-user', JSON.stringify(userData));

            // Proceed to the app
            onContinueAsGuest();

        } catch (error) {
            console.error('Google sign-in error:', error);
            setError(`Sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

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
                
                {/* Loading indicator */}
                {isLoading && (
                    <div className="mt-4 text-sm text-gray-500">
                        Signing you in...
                    </div>
                )}
                
                {/* Error message */}
                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}
            </div>

            {/* Guest Option - near bottom, very subtle */}
            <div className="pb-16">
                <button
                    onClick={onContinueAsGuest}
                    disabled={isLoading}
                    className="text-gray-300 hover:text-gray-400 transition-colors text-xs disabled:opacity-50"
                >
                    Continue as guest
                </button>
            </div>
        </div>
    );
}