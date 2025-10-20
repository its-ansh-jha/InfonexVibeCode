import { createContext, useContext, useEffect, useState } from "react";
import { getRedirectResult, type User } from "firebase/auth";
import { auth, onAuthChange } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Handle redirect result from Firebase
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          // Sync user with backend (handles both signup and login)
          await apiRequest("POST", "/api/auth/sync", {
            id: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          });
          toast({
            title: "Welcome!",
            description: "Successfully signed in with Google.",
          });
          
          // Redirect to projects page after successful authentication
          if (location === "/login" || location === "/") {
            setLocation("/projects");
          }
        }
      })
      .catch((error) => {
        console.error("Auth redirect error:", error);
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
      });

    // Listen to auth state changes
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Sync user with backend on auth state change
        try {
          await apiRequest("POST", "/api/auth/sync", {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
        } catch (error) {
          console.error("Failed to sync user:", error);
        }
      } else {
        // Clear cache on sign out
        queryClient.clear();
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
