import { TokenPayload } from "../core/security/jwt";

declare global {
  namespace Express {
    interface User extends TokenPayload {}

    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      };
    }
  }
}

export {};