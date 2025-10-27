import React, { useState } from 'react';
import { Menu, X, User, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HamburgerMenuProps {
  onNavigateToAccount: () => void;
}

export default function HamburgerMenu({ onNavigateToAccount }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleAccountClick = () => {
    setIsOpen(false);
    onNavigateToAccount();
  };

  return (
    <>
      {/* Hamburger Button - Fixed Position */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-all"
        aria-label="Menu"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-gray-700" />
        ) : (
          <Menu className="w-5 h-5 text-gray-700" />
        )}
      </button>

   {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

     {/* Side Menu */}
     <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 w-[280px] h-full bg-white shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="pt-20 pb-6 px-6 border-b border-gray-200">
              <div className="text-2xl font-bold text-blue-600">
                BeSpoken
              </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-4 py-4">
              <button
                onClick={handleAccountClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all"
              >
                <User className="w-5 h-5" />
                <span>My Account</span>
              </button>
              
              {/* Future Settings Option */}
              <button
                disabled
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 rounded-lg cursor-not-allowed opacity-50"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
                <span className="ml-auto text-xs bg-gray-200 px-2 py-1 rounded">Soon</span>
              </button>
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">Version 1.0.0</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}