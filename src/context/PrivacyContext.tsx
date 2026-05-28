import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PrivacyContextType {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  formatYen: (amount: number | string) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => !prev);
  };

  const formatYen = (amount: number | string) => {
    if (privacyMode) {
      return '**** 円';
    }
    const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
    if (isNaN(num)) return '0円';

    return `${num.toLocaleString()}円`;
  };

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacyMode, formatYen }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}
