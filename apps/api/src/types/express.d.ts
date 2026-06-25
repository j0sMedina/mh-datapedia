declare namespace Express {
  interface Request {
    user?: {
      id: string;
      role: 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';
    };
  }
}
