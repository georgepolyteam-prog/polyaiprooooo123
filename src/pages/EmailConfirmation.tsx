import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import polyLogo from "@/assets/poly-logo-new.png";

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      // Check for error in URL params
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      
      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'Email confirmation failed');
        return;
      }

      // Check for access token (successful confirmation)
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const type = searchParams.get('type');
      
      if (type === 'signup' || type === 'email_change') {
        if (accessToken && refreshToken) {
          try {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) throw sessionError;
            
            setStatus('success');
            setMessage('Your email has been confirmed!');
            
            // Redirect after a short delay
            setTimeout(() => navigate('/'), 2000);
          } catch (err) {
            setStatus('error');
            setMessage('Failed to confirm email. Please try again.');
          }
        } else {
          setStatus('success');
          setMessage('Your email has been confirmed! You can now sign in.');
        }
      } else {
        // Just show loading briefly then redirect
        setStatus('success');
        setMessage('Redirecting...');
        setTimeout(() => navigate('/'), 1000);
      }
    };

    handleEmailConfirmation();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <img src={polyLogo} alt="Poly" className="w-10 h-10" />
          </div>
          
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Confirming your email...
              </h1>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Email Confirmed!
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
              <Button
                onClick={() => navigate('/')}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continue to App
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Confirmation Failed
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
              <Button
                onClick={() => navigate('/auth')}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default EmailConfirmation;
