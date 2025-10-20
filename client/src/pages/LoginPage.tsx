import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/firebase";
import { Code2, Sparkles, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: "Success!",
        description: "You've been signed in successfully.",
      });
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Sign in failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
              <Code2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-semibold">Vibe Code</h1>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm">AI-Powered Coding Platform</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-center">
            <CardTitle className="text-xl">Get Started</CardTitle>
            <CardDescription>
              Sign in or create an account to start building with AI
            </CardDescription>
          </div>
          <Button
            onClick={handleGoogleSignIn}
            className="w-full h-12"
            size="lg"
            disabled={isLoading}
            data-testid="button-google-signin"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <SiGoogle className="mr-2 h-5 w-5" />
                Continue with Google
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
