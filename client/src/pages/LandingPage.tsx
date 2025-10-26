import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Code2, Sparkles, FileCode, Terminal, Cloud, Zap, Menu, X, BookOpen, HelpCircle, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Development",
      description: "Build applications through natural conversation with our advanced AI agent powered by Google Gemini",
    },
    {
      icon: FileCode,
      title: "Intelligent File Management",
      description: "Create, edit, and manage files with AI assistance. All files are securely stored in AWS S3",
    },
    {
      icon: Terminal,
      title: "Real-Time Code Execution",
      description: "Execute code instantly in isolated E2B sandboxes with live preview and debugging capabilities",
    },
    {
      icon: Cloud,
      title: "Cloud Storage",
      description: "Secure file storage with AWS S3 integration, ensuring your projects are always safe and accessible",
    },
    {
      icon: Zap,
      title: "Instant Boilerplates",
      description: "Start quickly with pre-configured project templates including React, Vite, and Node.js setups",
    },
    {
      icon: Code2,
      title: "Multi-Language Support",
      description: "Work with Python, JavaScript, TypeScript, and more with intelligent code completion and execution",
    },
  ];

  const capabilities = [
    {
      title: "Advanced AI Chat Agent",
      items: [
        "Powered by Google Gemini 2.5 Flash Preview model",
        "Streaming responses with live tool execution feedback",
        "Real-time action tracking with visual progress indicators",
        "Proactive web search for documentation and best practices",
      ],
    },
    {
      title: "File Operations",
      items: [
        "Create complete boilerplate project structures",
        "Write, edit, and delete files across S3 and sandbox",
        "List and read file contents from secure storage",
        "Real-time file syncing between S3 and E2B sandbox",
      ],
    },
    {
      title: "Code Execution",
      items: [
        "Run Python and JavaScript code in isolated environments",
        "Execute shell commands with support for long-running processes",
        "Live preview of web applications in real-time",
        "Automatic workflow command saving for quick restarts",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              InfonexAgent
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-features">
              Features
            </a>
            <a href="#capabilities" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-capabilities">
              Capabilities
            </a>
            <a href="#docs" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-docs">
              Docs
            </a>
            <ThemeToggle />
            <Button onClick={() => setLocation("/login")} data-testid="button-get-started-header">
              Get Started
            </Button>
          </nav>

          {/* Mobile Menu */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4 mt-8">
                  <a
                    href="#features"
                    className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-features"
                  >
                    <Sparkles className="h-5 w-5" />
                    Features
                  </a>
                  <a
                    href="#capabilities"
                    className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-capabilities"
                  >
                    <Zap className="h-5 w-5" />
                    Capabilities
                  </a>
                  <a
                    href="#docs"
                    className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-docs"
                  >
                    <BookOpen className="h-5 w-5" />
                    Documentation
                  </a>
                  <a
                    href="#about"
                    className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-about"
                  >
                    <HelpCircle className="h-5 w-5" />
                    About
                  </a>
                  <a
                    href="#security"
                    className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-security"
                  >
                    <Shield className="h-5 w-5" />
                    Security
                  </a>
                  <Button onClick={() => { setMobileMenuOpen(false); setLocation("/login"); }} className="mt-4" data-testid="button-get-started-mobile">
                    Get Started
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container px-4 py-16 md:py-24">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="space-y-4 max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Build Apps with{" "}
              <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AI Power
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              InfonexAgent is an AI-powered development platform that turns your ideas into working applications through natural conversation. Build, test, and deploy instantly.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" onClick={() => setLocation("/login")} data-testid="button-get-started-hero">
              <Sparkles className="mr-2 h-5 w-5" />
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-learn-more">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container px-4 py-16 md:py-24 bg-muted/30">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Powerful Features</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build modern applications with AI assistance
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors" data-testid={`feature-card-${index}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="container px-4 py-16 md:py-24">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Advanced Capabilities</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built with cutting-edge technology for seamless development
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {capabilities.map((capability, index) => (
              <Card key={index} className="border-2" data-testid={`capability-card-${index}`}>
                <CardHeader>
                  <CardTitle>{capability.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {capability.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 mt-0.5 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="docs" className="container px-4 py-16 md:py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Get started in minutes with our intuitive workflow
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="step-card-1">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    1
                  </div>
                  <CardTitle>Sign In</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sign in securely with your Google account using Firebase authentication
                </p>
              </CardContent>
            </Card>
            <Card data-testid="step-card-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    2
                  </div>
                  <CardTitle>Create Project</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create a new project with an automatically provisioned isolated sandbox environment
                </p>
              </CardContent>
            </Card>
            <Card data-testid="step-card-3">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    3
                  </div>
                  <CardTitle>Chat with AI</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Describe your application and watch as the AI creates files, writes code, and builds your app
                </p>
              </CardContent>
            </Card>
            <Card data-testid="step-card-4">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    4
                  </div>
                  <CardTitle>Preview & Deploy</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  See your app running in real-time with live preview and instant updates as you iterate
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-16 md:py-24">
        <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-blue-500/5">
          <CardContent className="flex flex-col items-center text-center space-y-6 py-12">
            <h2 className="text-3xl md:text-4xl font-bold">Ready to Start Building?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Join InfonexAgent today and experience the future of AI-powered development
            </p>
            <Button size="lg" onClick={() => setLocation("/login")} data-testid="button-get-started-cta">
              <Sparkles className="mr-2 h-5 w-5" />
              Get Started Now
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary">
                <Code2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">InfonexAgent</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-Powered App Building Platform © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
