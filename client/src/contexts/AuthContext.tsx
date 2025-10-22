import { createContext, useContext, useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { onAuthChange } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncUser: (user: User) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  syncUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = async (firebaseUser: User) => {
    try {
      await apiRequest("POST", "/api/auth/sync", {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });
    } catch (error) {
      console.error("Failed to sync user:", error);
      throw error;
    }
  };

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Sync user with backend on auth state change
        try {
          await syncUser(firebaseUser);
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
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, syncUser }}>
      {children}
    </AuthContext.Provider>
  );
}
