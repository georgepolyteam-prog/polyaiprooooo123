import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import polyLogo from "@/assets/poly-logo-new.png";

const CheckEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'your email';

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
          
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
            Check your email
          </h1>
          
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            We've sent a confirmation link to:
          </p>
          
          <p className="text-gray-900 dark:text-white font-medium mb-6 break-all">
            {email}
          </p>
          
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click the link in your email to verify your account. 
              Check your spam folder if you don't see it.
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={() => navigate('/auth')}
            className="w-full h-12 rounded-xl border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default CheckEmail;
