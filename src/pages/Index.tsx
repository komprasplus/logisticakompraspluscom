import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import RoleSelector from "@/components/RoleSelector";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      </AnimatePresence>

      {!showSplash && <RoleSelector />}
    </>
  );
};

export default Index;
