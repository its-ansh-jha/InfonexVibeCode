import type { Request, Response, NextFunction } from "express";
import { verifyIdToken } from "../lib/firebaseAdmin";

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    try {
      const decodedToken = await verifyIdToken(idToken);
      req.userId = decodedToken.uid;
      next();
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];
  
  verifyIdToken(idToken)
    .then((decodedToken) => {
      req.userId = decodedToken.uid;
      next();
    })
    .catch(() => {
      next(); // Continue without auth if token is invalid
    });
}
