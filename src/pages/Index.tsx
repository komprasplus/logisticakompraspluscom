import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import RoleSelector from "@/components/RoleSelector";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const handleSelectRole = (role: "driver" | "customer") => {
    if (role === "driver") {
      navigate("/repartidor");
    } else {
      navigate("/rastreo");
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      </AnimatePresence>

      {!showSplash && <RoleSelector onSelectRole={handleSelectRole} />}
    </>
  );
};

export default Index;
